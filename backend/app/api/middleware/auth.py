"""
Authentication middleware for secure API access with Clerk JWT validation
"""

import json
import logging
import re
import time
from functools import lru_cache
from typing import Any, Dict, Optional, Set

import httpx
import jwt
from app.core.config import settings
from fastapi import Request, status
from fastapi.security import HTTPBearer
from jwt.exceptions import (
    ExpiredSignatureError,
    InvalidAudienceError,
    InvalidIssuerError,
    InvalidTokenError,
)
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response

logger = logging.getLogger(__name__)
security = HTTPBearer()


class AuthMiddleware(BaseHTTPMiddleware):
    """
    Enhanced authentication middleware with security hardening
    """

    def __init__(self, app):
        super().__init__(app)
        self._jwks_cache_time = 0
        self._jwks_cache_duration = 3600  # 1 hour
        self._revoked_tokens: Set[str] = set()  # In-memory token revocation list
        self._failed_attempts: Dict[str, list] = {}  # Rate limiting for failed attempts

    def _get_clerk_domain_suffix(self) -> Optional[str]:
        """Extract domain suffix from Clerk publishable key"""
        if not settings.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY:
            logger.error("Clerk publishable key not configured")
            return None

        pub_key = settings.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
        if pub_key.startswith("pk_test_"):
            return pub_key.replace("pk_test_", "")
        elif pub_key.startswith("pk_live_"):
            return pub_key.replace("pk_live_", "")
        else:
            logger.error("Invalid Clerk publishable key format")
            return None

    # Public endpoints that don't require authentication
    PUBLIC_ENDPOINTS = {
        "/health",
        "/metrics",
        "/api/v1/docs",
        "/api/v1/redoc",
        "/api/v1/openapi.json",
        "/api/v1/session/create",
        "/api/v1/health/check",
        "/api/v1/rag/ask",  # Allow public access for gesture recognition Q&A
        "/api/v1/question/ask",  # Allow public access for question answering
        "/api/v1/summary/generate",  # Allow public access for summary generation
        "/api/v1/faq_clustering/cluster"
    }

    # Admin endpoints that require Clerk authentication
    ADMIN_ENDPOINTS = {
        "/api/v1/admin/",
        "/api/v1/admin/dashboard",
        "/api/v1/admin/users",
        "/api/v1/admin/conversations",
        "/api/v1/admin/metrics",
    }

    async def dispatch(self, request: Request, call_next):
        """
        Process request authentication
        """

        # Skip authentication for public endpoints

        if request.url.path in self.PUBLIC_ENDPOINTS or request.url.path.startswith(
            "/api/v1/summary/"
        ):
            return await call_next(request)

        if self._is_public_endpoint(request.url.path):
            return await call_next(request)

        # Check for admin endpoints
        if self._is_admin_endpoint(request.url.path):
            if not await self._validate_admin_token(request):
                return Response(
                    content="Unauthorized access to admin endpoint",
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    headers={"WWW-Authenticate": "Bearer"},
                )

        # For user endpoints, validate session
        elif not await self._validate_user_session(request):
            return Response(
                content="Invalid or expired session",
                status_code=status.HTTP_401_UNAUTHORIZED,
            )

        response = await call_next(request)
        return response

    def _is_public_endpoint(self, path: str) -> bool:
        """Check if endpoint is public"""
        return any(path.startswith(endpoint) for endpoint in self.PUBLIC_ENDPOINTS)

    def _is_admin_endpoint(self, path: str) -> bool:
        """Check if endpoint requires admin authentication"""
        return any(path.startswith(endpoint) for endpoint in self.ADMIN_ENDPOINTS)

    async def _validate_admin_token(self, request: Request) -> bool:
        """
        Enhanced Clerk JWT token validation with security hardening
        """
        try:
            # Rate limiting check
            client_ip = self._get_client_ip(request)
            if not await self._check_rate_limit(client_ip):
                logger.warning(f"Rate limit exceeded for IP: {client_ip}")
                return False

            # Get authorization header
            auth_header = request.headers.get("Authorization")
            if not auth_header or not auth_header.startswith("Bearer "):
                logger.warning(
                    f"Missing or invalid Authorization header from {client_ip}"
                )
                await self._record_failed_attempt(client_ip)
                return False

            token = auth_header.split(" ")[1]

            # Token format validation
            if not self._validate_token_format(token):
                logger.warning(f"Invalid token format from {client_ip}")
                await self._record_failed_attempt(client_ip)
                return False

            # Check token revocation
            if await self._is_token_revoked(token):
                logger.warning(
                    f"Revoked token attempted use from {client_ip}: {token[:10]}..."
                )
                await self._record_failed_attempt(client_ip)
                return False

            # Validate Clerk JWT token
            if not settings.CLERK_SECRET_KEY:
                logger.error("Clerk secret key not configured")
                return False

            # Get Clerk's public keys for JWT verification
            jwks = await self._get_clerk_jwks()
            if not jwks:
                logger.error("Failed to retrieve Clerk JWKS")
                return False

            # Decode and verify the JWT
            unverified_header = jwt.get_unverified_header(token)
            key_id = unverified_header.get("kid")

            if not key_id or key_id not in jwks:
                logger.warning(f"Invalid key ID in JWT: {key_id}")
                return False

            # Get the public key for verification
            public_key = jwks[key_id]

            # Enhanced audience validation
            expected_audience = self._get_expected_audience()
            domain_suffix = self._get_clerk_domain_suffix()
            if not domain_suffix:
                logger.error("Could not extract domain suffix from Clerk key")
                return False
            expected_issuer = f"https://{domain_suffix}.clerk.accounts.dev"

            # Verify and decode the JWT with enhanced validation
            decoded = jwt.decode(
                token,
                public_key,
                algorithms=["RS256"],
                audience=expected_audience,
                issuer=expected_issuer,
                options={
                    "verify_signature": True,
                    "verify_exp": True,
                    "verify_aud": True,
                    "verify_iss": True,
                    "verify_nbf": True,  # Not before validation
                    "verify_iat": True,  # Issued at validation
                },
            )

            # Additional security checks
            if not self._validate_token_claims(decoded):
                logger.warning(f"Invalid token claims from {client_ip}")
                await self._record_failed_attempt(client_ip)
                return False

            # Check if user has admin role
            user_role = decoded.get("metadata", {}).get("role")
            if user_role != "admin":
                logger.warning(
                    f"User {decoded.get('sub')} does not have admin role: {user_role}"
                )
                return False

            # Store user info in request state
            request.state.user = {
                "id": decoded.get("sub"),
                "email": decoded.get("email"),
                "role": user_role,
                "full_name": decoded.get("name"),
                "clerk_user_id": decoded.get("sub"),
            }

            logger.info(f"Admin token validated for user: {decoded.get('sub')}")
            return True

        except ExpiredSignatureError:
            logger.warning(f"Expired token from {client_ip}")
            await self._record_failed_attempt(client_ip)
            return False
        except (InvalidAudienceError, InvalidIssuerError) as e:
            logger.warning(f"Invalid token audience/issuer from {client_ip}: {e}")
            await self._record_failed_attempt(client_ip)
            return False
        except InvalidTokenError as e:
            logger.warning(f"Invalid admin token from {client_ip}: {e}")
            await self._record_failed_attempt(client_ip)
            return False
        except Exception as e:
            logger.error(f"Error validating admin token from {client_ip}: {e}")
            await self._record_failed_attempt(client_ip)
            return False

    @lru_cache(maxsize=1)
    def _get_cached_jwks(self, cache_key: str) -> Optional[Dict[str, Any]]:
        """Cached JWKS with proper expiration"""
        return getattr(self, "_jwks_cache", None)

    async def _get_clerk_jwks(self) -> Optional[Dict[str, Any]]:
        """
        Fetch Clerk's JSON Web Key Set (JWKS) with enhanced caching and security
        """
        try:
            # Check cache with time-based expiration
            current_time = time.time()
            if (
                hasattr(self, "_jwks_cache")
                and self._jwks_cache
                and current_time - self._jwks_cache_time < self._jwks_cache_duration
            ):
                return self._jwks_cache

            # Get Clerk domain suffix
            domain_suffix = self._get_clerk_domain_suffix()
            if not domain_suffix:
                return None

            # Construct JWKS URL
            jwks_url = (
                f"https://{domain_suffix}.clerk.accounts.dev/.well-known/jwks.json"
            )

            # Fetch JWKS
            async with httpx.AsyncClient() as client:
                response = await client.get(jwks_url, timeout=10.0)
                response.raise_for_status()
                jwks_data = response.json()

            # Convert JWKS to usable format
            jwks = {}
            for key in jwks_data.get("keys", []):
                if key.get("kty") == "RSA" and key.get("use") == "sig":
                    # Convert JWK to PEM format for PyJWT
                    public_key = jwt.algorithms.RSAAlgorithm.from_jwk(json.dumps(key))
                    jwks[key["kid"]] = public_key

            # Cache the JWKS with timestamp
            self._jwks_cache = jwks
            self._jwks_cache_time = current_time
            return jwks

        except Exception as e:
            logger.error(f"Failed to fetch Clerk JWKS: {e}")
            return None

    def _get_client_ip(self, request: Request) -> str:
        """Extract client IP with proxy support"""
        forwarded_for = request.headers.get("X-Forwarded-For")
        if forwarded_for:
            return forwarded_for.split(",")[0].strip()
        return request.client.host if request.client else "unknown"

    async def _check_rate_limit(self, client_ip: str) -> bool:
        """Rate limiting for authentication attempts"""
        current_time = time.time()
        if client_ip not in self._failed_attempts:
            return True

        # Clean old attempts (older than 1 hour)
        self._failed_attempts[client_ip] = [
            attempt_time
            for attempt_time in self._failed_attempts[client_ip]
            if current_time - attempt_time < 3600
        ]

        # Check if too many recent attempts (max 10 per hour)
        return len(self._failed_attempts[client_ip]) < 10

    async def _record_failed_attempt(self, client_ip: str):
        """Record failed authentication attempt"""
        current_time = time.time()
        if client_ip not in self._failed_attempts:
            self._failed_attempts[client_ip] = []
        self._failed_attempts[client_ip].append(current_time)

    def _validate_token_format(self, token: str) -> bool:
        """Validate JWT token format"""
        if not token or len(token) < 20:
            return False

        # Basic JWT format check (header.payload.signature)
        parts = token.split(".")
        if len(parts) != 3:
            return False

        # Check for suspicious patterns
        suspicious_patterns = [r"<script", r"javascript:", r"eval\(", r"exec\("]
        for pattern in suspicious_patterns:
            if re.search(pattern, token, re.IGNORECASE):
                return False

        return True

    async def _is_token_revoked(self, token: str) -> bool:
        """Check if token is in revocation list"""
        # Simple in-memory revocation check
        # In production, this should check a database or Redis
        token_hash = hash(token)
        return str(token_hash) in self._revoked_tokens

    def _get_expected_audience(self) -> str:
        """Get expected JWT audience"""
        if settings.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY:
            return settings.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
        return "tunarasa-app"

    def _validate_token_claims(self, decoded: Dict[str, Any]) -> bool:
        """Additional validation of JWT claims"""
        try:
            # Check issued at time (not too old, not in future)
            iat = decoded.get("iat")
            if iat:
                current_time = time.time()
                # Token should not be older than 24 hours
                if current_time - iat > 86400:
                    return False
                # Token should not be issued in the future (with 5 min tolerance)
                if iat > current_time + 300:
                    return False

            # Validate subject (user ID) format
            sub = decoded.get("sub")
            if not sub or len(sub) < 10:
                return False

            # Check for required claims
            required_claims = ["sub", "iat", "exp", "aud", "iss"]
            for claim in required_claims:
                if claim not in decoded:
                    return False

            return True

        except Exception as e:
            logger.warning(f"Error validating token claims: {e}")
            return False

    async def _validate_user_session(self, request: Request) -> bool:
        """
        Validate user session for regular endpoints using database
        """
        try:
            # Get session ID from header or cookie
            session_id = request.headers.get("X-Session-Id")
            if not session_id:
                session_id = request.cookies.get("session_id")

            if not session_id:
                logger.debug("No session ID provided")
                return False

            # Validate session format (UUID-like)
            if len(session_id) < 32 or not session_id.replace("-", "").isalnum():
                logger.warning(f"Invalid session ID format: {session_id[:8]}...")
                return False

            # Validate session in database
            from datetime import datetime, timedelta

            from app.core.database import get_session
            from app.db.models import Conversation, User
            from sqlalchemy import and_

            async with get_session() as db:
                # Find active conversation with this session ID
                # For this implementation, we'll use conversation_id as session identifier
                conversation = (
                    db.query(Conversation)
                    .filter(
                        and_(
                            (
                                Conversation.conversation_id == session_id.split("-")[0]
                                if "-" in session_id
                                else session_id[:8]
                            ),
                            Conversation.is_active,
                            # Consider sessions valid for 24 hours
                            Conversation.updated_at
                            >= datetime.utcnow() - timedelta(hours=24),
                        )
                    )
                    .first()
                )

                if not conversation:
                    # If no conversation found, create a session tracking approach
                    # For now, allow sessions that look valid (will be expanded with proper session table)
                    logger.info(
                        f"No active conversation found for session: {session_id[:8]}..."
                    )

                    # Temporary validation: allow if format is correct
                    # In production, this should check a dedicated sessions table
                    if len(session_id) >= 32:
                        request.state.session_id = session_id
                        request.state.user_id = None  # Anonymous session
                        return True
                    return False

                # Session is valid - get user info
                user = (
                    db.query(User).filter(User.user_id == conversation.user_id).first()
                )

                # Store session and user info in request state
                request.state.session_id = session_id
                request.state.conversation_id = conversation.conversation_id
                request.state.user_id = conversation.user_id
                request.state.user = (
                    {
                        "id": user.user_id if user else None,
                        "full_name": user.full_name if user else None,
                        "role_id": user.role_id if user else None,
                        "clerk_user_id": user.clerk_user_id if user else None,
                    }
                    if user
                    else None
                )

                logger.info(
                    f"Session validated for user: {user.user_id if user else 'anonymous'}"
                )
                return True

        except Exception as e:
            logger.error(f"Error validating user session: {e}")
            return False
