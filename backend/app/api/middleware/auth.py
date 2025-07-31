"""
Authentication middleware for secure API access with Clerk JWT validation
"""

import logging
import json
import httpx
from fastapi import Request, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response
from typing import Optional, Dict, Any
import jwt
from jwt.exceptions import InvalidTokenError, ExpiredSignatureError

from app.core.config import settings

logger = logging.getLogger(__name__)
security = HTTPBearer()


class AuthMiddleware(BaseHTTPMiddleware):
    """
    Authentication middleware for request validation
    """
    
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
        "/api/v1/summary/generate",  # Allow public access for gesture recognition Q&A
        # "/api/v1/summary/{access_token}",
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

        if (
            request.url.path in self.PUBLIC_ENDPOINTS
            or request.url.path.startswith("/api/v1/summary/")
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
                    headers={"WWW-Authenticate": "Bearer"}
                )
        
        # For user endpoints, validate session
        elif not await self._validate_user_session(request):
            return Response(
                content="Invalid or expired session",
                status_code=status.HTTP_401_UNAUTHORIZED
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
        Validate Clerk JWT token for admin access with proper signature verification
        """
        try:
            # Get authorization header
            auth_header = request.headers.get("Authorization")
            if not auth_header or not auth_header.startswith("Bearer "):
                logger.warning("Missing or invalid Authorization header")
                return False
            
            token = auth_header.split(" ")[1]
            
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
            
            # Verify and decode the JWT
            decoded = jwt.decode(
                token,
                public_key,
                algorithms=["RS256"],
                audience=settings.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
                options={
                    "verify_signature": True,
                    "verify_exp": True,
                    "verify_aud": True,
                    "verify_iss": True
                }
            )
            
            # Check if user has admin role
            user_role = decoded.get("metadata", {}).get("role")
            if user_role != "admin":
                logger.warning(f"User {decoded.get('sub')} does not have admin role: {user_role}")
                return False
            
            # Store user info in request state
            request.state.user = {
                "id": decoded.get("sub"),
                "email": decoded.get("email"),
                "role": user_role,
                "full_name": decoded.get("name"),
                "clerk_user_id": decoded.get("sub")
            }
            
            logger.info(f"Admin token validated for user: {decoded.get('sub')}")
            return True
            
        except ExpiredSignatureError:
            logger.warning("Token has expired")
            return False
        except InvalidTokenError as e:
            logger.warning(f"Invalid admin token: {e}")
            return False
        except Exception as e:
            logger.error(f"Error validating admin token: {e}")
            return False
    
    async def _get_clerk_jwks(self) -> Optional[Dict[str, Any]]:
        """
        Fetch Clerk's JSON Web Key Set (JWKS) for JWT verification
        """
        try:
            # Cache JWKS for 1 hour to avoid repeated requests
            if hasattr(self, '_jwks_cache') and self._jwks_cache:
                return self._jwks_cache
            
            # Get Clerk domain from publishable key
            if not settings.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY:
                logger.error("Clerk publishable key not configured")
                return None
            
            # Extract instance ID from publishable key (format: pk_test_xxx or pk_live_xxx)
            pub_key = settings.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
            if pub_key.startswith("pk_test_"):
                domain_suffix = pub_key.replace("pk_test_", "")
            elif pub_key.startswith("pk_live_"):
                domain_suffix = pub_key.replace("pk_live_", "") 
            else:
                logger.error("Invalid Clerk publishable key format")
                return None
            
            # Construct JWKS URL
            jwks_url = f"https://{domain_suffix}.clerk.accounts.dev/.well-known/jwks.json"
            
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
            
            # Cache the JWKS
            self._jwks_cache = jwks
            return jwks
            
        except Exception as e:
            logger.error(f"Failed to fetch Clerk JWKS: {e}")
            return None
    
    async def _validate_user_session(self, request: Request) -> bool:
        """
        Validate user session for regular endpoints
        """
        try:
            # Get session ID from header or cookie
            session_id = request.headers.get("X-Session-Id")
            if not session_id:
                session_id = request.cookies.get("session_id")
            
            if not session_id:
                return False
            
            # TODO: Validate session in Redis/Database
            # For now, basic validation
            if len(session_id) < 10:
                return False
            
            # Store session info in request state
            request.state.session_id = session_id
            return True
            
        except Exception as e:
            logger.error(f"Error validating user session: {e}")
            return False