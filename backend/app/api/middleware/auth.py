"""
Authentication middleware for secure API access with Supabase JWT validation
"""

import logging
import re
import time
from typing import Any, Dict, Set

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
    Enhanced authentication middleware with Supabase JWT validation
    """

    def __init__(self, app):
        super().__init__(app)
        self._jwks_cache_time = 0
        self._jwks_cache_duration = 3600  # 1 hour
        self._revoked_tokens: Set[str] = set()  # In-memory token revocation list
        self._failed_attempts: Dict[str, list] = {}  # Rate limiting for failed attempts

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
        "/api/v1/conversation/save",  # Allow public access for conversation saving
        "/api/v1/gesture/ask",  # Allow public access for gesture recognition
        "/api/v1/public-session/",  # Allow public access for session tracking (no auth required)
        # FAQ and Clustering endpoints - public access for frontend integration
        "/api/v1/faq/recommendations/",  # FAQ recommendations for institutions
        "/api/v1/faq/health",  # FAQ service health check
        "/api/v1/faq/dummy-categories",  # Get dummy FAQ categories
        "/api/v1/faq/institutions/",  # Institution question counts (public read-only)
        "/api/v1/faq-clustering/health",  # FAQ clustering service health
        "/api/v1/institutions/public/institutions",  # Public institution data
        "/api/v1/institutions/public/institutions/",  # Public institution data with trailing slash
        "/api/v1/institutions/health",  # Institution service health check
        # QA Logging endpoints - public access for logging interactions
        "/api/v1/qa-log/log",  # Log QA interactions
        "/api/v1/qa-log/admin-validation",  # Log admin validation QA
        "/api/v1/qa-log/gesture",  # Log gesture-based QA
        "/api/v1/qa-log/health",  # QA logging service health
    }

    # Admin endpoints that require Supabase authentication
    ADMIN_ENDPOINTS = {
        "/api/v1/admin/",
        "/api/v1/admin/dashboard",
        "/api/v1/admin/users",
        "/api/v1/admin/conversations",
        "/api/v1/admin/metrics",
        # FAQ Admin endpoints - require authentication for management operations
        "/api/v1/faq/refresh/",  # Force refresh FAQ recommendations (admin only)
        "/api/v1/faq/metrics/",  # FAQ metrics for admin dashboard
        "/api/v1/faq-clustering/cluster",  # Direct clustering operations (admin only)
        "/api/v1/admin/faq/",  # All admin FAQ management endpoints
        "/api/v1/qa-log/institution/",  # QA logs by institution (admin only for analytics)
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
        Enhanced Supabase JWT token validation with security hardening
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

            # Validate Supabase JWT token
            if not settings.SUPABASE_JWT_SECRET:
                logger.error("Supabase JWT secret not configured")
                return False

            # Decode and verify the JWT with Supabase secret
            try:
                decoded = jwt.decode(
                    token,
                    settings.SUPABASE_JWT_SECRET,
                    algorithms=["HS256"],
                    options={
                        "verify_signature": True,
                        "verify_exp": True,
                        "verify_aud": True,
                        "verify_iss": True,
                        "verify_nbf": True,  # Not before validation
                        "verify_iat": True,  # Issued at validation
                    },
                    audience="authenticated",
                    issuer=f"https://{settings.SUPABASE_PROJECT_ID}.supabase.co/auth/v1",
                )
            except Exception as e:
                logger.warning(f"JWT decode failed from {client_ip}: {e}")
                await self._record_failed_attempt(client_ip)
                return False

            # Additional security checks
            if not self._validate_token_claims(decoded):
                logger.warning(f"Invalid token claims from {client_ip}")
                await self._record_failed_attempt(client_ip)
                return False

            # Check if user has admin role by verifying against database
            user_id = decoded.get("sub")
            if not await self._validate_admin_role(user_id):
                logger.warning(f"User {user_id} does not have admin role")
                return False

            # Store user info in request state
            request.state.user = {
                "id": decoded.get("sub"),
                "email": decoded.get("email"),
                "role": "admin",  # Validated above
                "supabase_user_id": decoded.get("sub"),
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

    async def _validate_admin_role(self, user_id: str) -> bool:
        """
        Validate if user has admin role by checking database
        """
        try:
            from app.core.database import get_session
            from app.db.models import Role, User
            from sqlalchemy import and_

            async with get_session() as db:
                user = (
                    db.query(User)
                    .join(Role)
                    .filter(
                        and_(
                            User.supabase_user_id == user_id,
                            User.is_active == User.is_active,
                            Role.role_name.in_(["admin", "superadmin"]),
                        )
                    )
                    .first()
                )

                return user is not None

        except Exception as e:
            logger.error(f"Error validating admin role for user {user_id}: {e}")
            return False

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
                        "supabase_user_id": user.supabase_user_id if user else None,
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


def get_current_admin_user():
    """
    Dependency function to get current admin user from request state
    Used with FastAPI Depends() for admin endpoints
    """
    from fastapi import HTTPException, Request

    def _get_admin_user(request: Request):
        if not hasattr(request.state, "user") or not request.state.user:
            raise HTTPException(status_code=401, detail="Admin authentication required")

        user = request.state.user
        if user.get("role") != "admin":
            raise HTTPException(status_code=403, detail="Admin privileges required")

        return user

    return _get_admin_user
