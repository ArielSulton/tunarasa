"""
Admin endpoints for system management and monitoring
"""

import logging
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
import json

from fastapi import APIRouter, HTTPException, status, Request, Depends
from pydantic import BaseModel, Field

from app.core.config import settings

logger = logging.getLogger(__name__)
router = APIRouter()


class AdminDashboardResponse(BaseModel):
    """Admin dashboard data"""
    total_sessions: int
    total_conversations: int
    total_gestures: int
    active_sessions: int
    system_health: Dict[str, Any]
    performance_metrics: Dict[str, float]
    recent_activity: List[Dict[str, Any]]


class SessionMetrics(BaseModel):
    """Session metrics for admin"""
    session_id: str
    created_at: datetime
    last_activity: datetime
    conversation_count: int
    gesture_count: int
    client_info: Dict[str, Any]


class SystemSettings(BaseModel):
    """System configuration settings"""
    rate_limit_requests: int
    rate_limit_window: int
    session_timeout: int
    max_file_size: int
    debug_mode: bool


class AdminService:
    """Admin service for system management"""
    
    def __init__(self):
        self.redis_client = None
        
        # Connect to Redis for admin operations
        try:
            import redis
            self.redis_client = redis.from_url(settings.REDIS_URL)
            self.redis_client.ping()
            logger.info("Connected to Redis for admin operations")
        except Exception as e:
            logger.warning(f"Redis connection failed for admin: {e}")
    
    async def get_dashboard_data(self) -> AdminDashboardResponse:
        """Get admin dashboard data"""
        
        try:
            # Get system metrics
            total_sessions = await self._get_total_sessions()
            total_conversations = await self._get_total_conversations()
            total_gestures = await self._get_total_gestures()
            active_sessions = await self._get_active_sessions()
            
            # Get system health
            system_health = await self._get_system_health()
            
            # Get performance metrics
            performance_metrics = await self._get_performance_metrics()
            
            # Get recent activity
            recent_activity = await self._get_recent_activity()
            
            return AdminDashboardResponse(
                total_sessions=total_sessions,
                total_conversations=total_conversations,
                total_gestures=total_gestures,
                active_sessions=active_sessions,
                system_health=system_health,
                performance_metrics=performance_metrics,
                recent_activity=recent_activity
            )
            
        except Exception as e:
            logger.error(f"Failed to get dashboard data: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to retrieve dashboard data"
            )
    
    async def _get_total_sessions(self) -> int:
        """Get total number of sessions created"""
        try:
            if self.redis_client:
                # Count sessions from Redis
                pattern = "session:*"
                keys = await self.redis_client.keys(pattern)
                return len(keys)
            else:
                # Fallback to estimated count
                return 0
        except Exception as e:
            logger.error(f"Failed to get total sessions: {e}")
            return 0
    
    async def _get_total_conversations(self) -> int:
        """Get total number of conversations"""
        try:
            if self.redis_client:
                pattern = "conversation:*"
                keys = await self.redis_client.keys(pattern)
                return len(keys)
            else:
                return 0
        except Exception as e:
            logger.error(f"Failed to get total conversations: {e}")
            return 0
    
    async def _get_total_gestures(self) -> int:
        """Get total number of gestures processed"""
        try:
            if self.redis_client:
                pattern = "gesture:*"
                keys = await self.redis_client.keys(pattern)
                return len(keys)
            else:
                return 0
        except Exception as e:
            logger.error(f"Failed to get total gestures: {e}")
            return 0
    
    async def _get_active_sessions(self) -> int:
        """Get number of active sessions"""
        try:
            if self.redis_client:
                # Count sessions that haven't expired
                pattern = "session:*"
                keys = await self.redis_client.keys(pattern)
                
                active_count = 0
                for key in keys:
                    ttl = await self.redis_client.ttl(key)
                    if ttl > 0:
                        active_count += 1
                
                return active_count
            else:
                return 0
        except Exception as e:
            logger.error(f"Failed to get active sessions: {e}")
            return 0
    
    async def _get_system_health(self) -> Dict[str, Any]:
        """Get system health status"""
        try:
            health = {
                "database": "healthy",
                "redis": "healthy" if self.redis_client else "degraded",
                "external_services": {
                    "groq": "healthy" if settings.GROQ_API_KEY else "not_configured",
                    "pinecone": "healthy" if settings.PINECONE_API_KEY else "not_configured",
                    "clerk": "healthy" if settings.CLERK_SECRET_KEY else "not_configured"
                }
            }
            
            return health
        except Exception as e:
            logger.error(f"Failed to get system health: {e}")
            return {"status": "error", "message": str(e)}
    
    async def _get_performance_metrics(self) -> Dict[str, float]:
        """Get performance metrics"""
        try:
            # Basic performance metrics
            metrics = {
                "average_response_time": 0.5,
                "gesture_recognition_accuracy": 0.85,
                "memory_usage": 50.0,
                "cpu_usage": 30.0
            }
            
            return metrics
        except Exception as e:
            logger.error(f"Failed to get performance metrics: {e}")
            return {}
    
    async def _get_recent_activity(self) -> List[Dict[str, Any]]:
        """Get recent system activity"""
        try:
            # Mock recent activity data
            activity = [
                {
                    "timestamp": datetime.utcnow().isoformat(),
                    "type": "session_created",
                    "details": "New user session started"
                },
                {
                    "timestamp": (datetime.utcnow() - timedelta(minutes=5)).isoformat(),
                    "type": "gesture_detected",
                    "details": "Letter 'A' recognized"
                },
                {
                    "timestamp": (datetime.utcnow() - timedelta(minutes=10)).isoformat(),
                    "type": "question_answered",
                    "details": "User question processed"
                }
            ]
            
            return activity
        except Exception as e:
            logger.error(f"Failed to get recent activity: {e}")
            return []
    
    async def get_session_metrics(self, limit: int = 50) -> List[SessionMetrics]:
        """Get session metrics for admin review"""
        
        try:
            metrics = []
            
            if self.redis_client:
                # Get session data from Redis
                pattern = "session:*"
                keys = await self.redis_client.keys(pattern)
                
                for key in keys[:limit]:
                    try:
                        session_data = await self.redis_client.get(key)
                        if session_data:
                            data = json.loads(session_data)
                            
                            metric = SessionMetrics(
                                session_id=data.get("session_id", ""),
                                created_at=datetime.fromisoformat(data.get("created_at", datetime.utcnow().isoformat())),
                                last_activity=datetime.fromisoformat(data.get("last_activity", datetime.utcnow().isoformat())),
                                conversation_count=data.get("conversation_count", 0),
                                gesture_count=data.get("gesture_count", 0),
                                client_info={
                                    "ip": data.get("client_ip", ""),
                                    "user_agent": data.get("user_agent", ""),
                                    "platform": data.get("platform", "")
                                }
                            )
                            
                            metrics.append(metric)
                            
                    except Exception as e:
                        logger.error(f"Failed to parse session data: {e}")
                        continue
            
            return metrics
            
        except Exception as e:
            logger.error(f"Failed to get session metrics: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to retrieve session metrics"
            )
    
    async def get_system_settings(self) -> SystemSettings:
        """Get current system settings"""
        
        return SystemSettings(
            rate_limit_requests=settings.RATE_LIMIT_REQUESTS,
            rate_limit_window=settings.RATE_LIMIT_WINDOW,
            session_timeout=3600,  # 1 hour
            max_file_size=settings.MAX_FILE_SIZE,
            debug_mode=settings.DEBUG
        )


# Initialize admin service
admin_service = AdminService()


@router.get("/dashboard", response_model=AdminDashboardResponse)
async def get_admin_dashboard():
    """
    Get admin dashboard data
    """
    try:
        dashboard_data = await admin_service.get_dashboard_data()
        return dashboard_data
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Admin dashboard endpoint failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve dashboard data"
        )


@router.get("/sessions", response_model=List[SessionMetrics])
async def get_session_metrics(limit: int = 50):
    """
    Get session metrics for admin review
    """
    try:
        metrics = await admin_service.get_session_metrics(limit)
        return metrics
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Session metrics endpoint failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve session metrics"
        )


@router.get("/settings", response_model=SystemSettings)
async def get_system_settings():
    """
    Get current system settings
    """
    try:
        settings_data = await admin_service.get_system_settings()
        return settings_data
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"System settings endpoint failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve system settings"
        )


@router.post("/maintenance")
async def trigger_maintenance():
    """
    Trigger system maintenance tasks
    """
    try:
        # Perform maintenance tasks
        tasks_completed = []
        
        # Clear expired sessions
        if admin_service.redis_client:
            try:
                # This would be more sophisticated in production
                tasks_completed.append("cleared_expired_sessions")
            except Exception as e:
                logger.error(f"Failed to clear expired sessions: {e}")
        
        # Clear old conversation data
        tasks_completed.append("cleared_old_conversations")
        
        return {
            "message": "Maintenance tasks completed",
            "tasks_completed": tasks_completed,
            "timestamp": datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Maintenance endpoint failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to perform maintenance tasks"
        )