"""
Session management endpoints for user tracking
"""

import logging
import uuid
from datetime import datetime, timedelta
from typing import Optional, Dict, Any
import redis
import json

from fastapi import APIRouter, HTTPException, status, Request, Depends
from pydantic import BaseModel

from app.core.config import settings

logger = logging.getLogger(__name__)
router = APIRouter()


class SessionCreateRequest(BaseModel):
    """Session creation request"""
    user_agent: Optional[str] = None
    platform: Optional[str] = None
    language: Optional[str] = "en"
    accessibility_features: Optional[Dict[str, Any]] = None


class SessionResponse(BaseModel):
    """Session response model"""
    session_id: str
    created_at: datetime
    expires_at: datetime
    status: str = "active"


class SessionUpdateRequest(BaseModel):
    """Session update request"""
    last_activity: Optional[datetime] = None
    accessibility_features: Optional[Dict[str, Any]] = None
    preferences: Optional[Dict[str, Any]] = None


class SessionManager:
    """Session management service"""
    
    def __init__(self):
        self.redis_client = None
        self.session_timeout = 3600  # 1 hour
        
        # Try to connect to Redis
        try:
            self.redis_client = redis.from_url(settings.REDIS_URL)
            self.redis_client.ping()
            logger.info("Connected to Redis for session management")
        except Exception as e:
            logger.warning(f"Redis connection failed, using memory store: {e}")
            self.memory_store = {}
    
    async def create_session(self, request_data: SessionCreateRequest, client_ip: str) -> SessionResponse:
        """Create a new user session"""
        
        session_id = str(uuid.uuid4())
        created_at = datetime.utcnow()
        expires_at = created_at + timedelta(seconds=self.session_timeout)
        
        session_data = {
            "session_id": session_id,
            "created_at": created_at.isoformat(),
            "expires_at": expires_at.isoformat(),
            "client_ip": client_ip,
            "user_agent": request_data.user_agent,
            "platform": request_data.platform,
            "language": request_data.language,
            "accessibility_features": request_data.accessibility_features or {},
            "status": "active",
            "last_activity": created_at.isoformat(),
            "conversation_count": 0,
            "gesture_count": 0
        }
        
        # Store session
        if self.redis_client:
            try:
                await self._store_session_redis(session_id, session_data)
            except Exception as e:
                logger.error(f"Failed to store session in Redis: {e}")
                self._store_session_memory(session_id, session_data)
        else:
            self._store_session_memory(session_id, session_data)
        
        return SessionResponse(
            session_id=session_id,
            created_at=created_at,
            expires_at=expires_at,
            status="active"
        )
    
    async def get_session(self, session_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve session data"""
        
        if self.redis_client:
            try:
                return await self._get_session_redis(session_id)
            except Exception as e:
                logger.error(f"Failed to get session from Redis: {e}")
                return self._get_session_memory(session_id)
        else:
            return self._get_session_memory(session_id)
    
    async def update_session(self, session_id: str, update_data: SessionUpdateRequest) -> bool:
        """Update session data"""
        
        session_data = await self.get_session(session_id)
        if not session_data:
            return False
        
        # Update fields
        if update_data.last_activity:
            session_data["last_activity"] = update_data.last_activity.isoformat()
        else:
            session_data["last_activity"] = datetime.utcnow().isoformat()
        
        if update_data.accessibility_features:
            session_data["accessibility_features"].update(update_data.accessibility_features)
        
        if update_data.preferences:
            session_data["preferences"] = update_data.preferences
        
        # Extend expiration
        expires_at = datetime.utcnow() + timedelta(seconds=self.session_timeout)
        session_data["expires_at"] = expires_at.isoformat()
        
        # Store updated session
        if self.redis_client:
            try:
                await self._store_session_redis(session_id, session_data)
            except Exception as e:
                logger.error(f"Failed to update session in Redis: {e}")
                self._store_session_memory(session_id, session_data)
        else:
            self._store_session_memory(session_id, session_data)
        
        return True
    
    async def _store_session_redis(self, session_id: str, session_data: Dict[str, Any]):
        """Store session in Redis"""
        key = f"session:{session_id}"
        await self.redis_client.setex(
            key,
            self.session_timeout,
            json.dumps(session_data, default=str)
        )
    
    async def _get_session_redis(self, session_id: str) -> Optional[Dict[str, Any]]:
        """Get session from Redis"""
        key = f"session:{session_id}"
        data = await self.redis_client.get(key)
        if data:
            return json.loads(data)
        return None
    
    def _store_session_memory(self, session_id: str, session_data: Dict[str, Any]):
        """Store session in memory"""
        self.memory_store[session_id] = session_data
    
    def _get_session_memory(self, session_id: str) -> Optional[Dict[str, Any]]:
        """Get session from memory"""
        return self.memory_store.get(session_id)


# Initialize session manager
session_manager = SessionManager()


@router.post("/create", response_model=SessionResponse)
async def create_session(
    request: Request,
    session_data: SessionCreateRequest
):
    """
    Create a new user session for gesture recognition
    """
    try:
        # Get client IP
        client_ip = request.client.host
        forwarded_for = request.headers.get("X-Forwarded-For")
        if forwarded_for:
            client_ip = forwarded_for.split(",")[0].strip()
        
        session = await session_manager.create_session(session_data, client_ip)
        
        logger.info(f"Created session {session.session_id} for client {client_ip}")
        return session
        
    except Exception as e:
        logger.error(f"Error creating session: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create session"
        )


@router.get("/{session_id}")
async def get_session(session_id: str):
    """
    Retrieve session information
    """
    try:
        session_data = await session_manager.get_session(session_id)
        
        if not session_data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Session not found"
            )
        
        # Check if session is expired
        expires_at = datetime.fromisoformat(session_data["expires_at"])
        if datetime.utcnow() > expires_at:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Session expired"
            )
        
        return session_data
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error retrieving session: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve session"
        )


@router.put("/{session_id}")
async def update_session(
    session_id: str,
    update_data: SessionUpdateRequest
):
    """
    Update session data and extend expiration
    """
    try:
        success = await session_manager.update_session(session_id, update_data)
        
        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Session not found"
            )
        
        return {"message": "Session updated successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating session: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update session"
        )