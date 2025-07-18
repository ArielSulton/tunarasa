"""
Authentication middleware for secure API access
"""

import logging
from fastapi import Request, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response
from typing import Optional
import jwt
from jwt.exceptions import InvalidTokenError

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
        Validate Clerk JWT token for admin access
        """
        try:
            # Get authorization header
            auth_header = request.headers.get("Authorization")
            if not auth_header or not auth_header.startswith("Bearer "):
                return False
            
            token = auth_header.split(" ")[1]
            
            # Validate Clerk JWT token
            # Note: In production, you would verify the token signature
            # with Clerk's public key
            if not settings.CLERK_SECRET_KEY:
                logger.warning("Clerk secret key not configured")
                return False
            
            # For now, basic validation - in production use proper JWT validation
            decoded = jwt.decode(
                token,
                settings.SECRET_KEY,
                algorithms=["HS256"],
                options={"verify_signature": False}  # Remove in production
            )
            
            # Store user info in request state
            request.state.user = decoded
            return True
            
        except InvalidTokenError as e:
            logger.warning(f"Invalid admin token: {e}")
            return False
        except Exception as e:
            logger.error(f"Error validating admin token: {e}")
            return False
    
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