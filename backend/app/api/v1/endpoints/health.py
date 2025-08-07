"""
Health check endpoints for monitoring and status
"""

import logging
import time
from typing import Any, Dict

import redis
from app.core.config import settings
from fastapi import APIRouter
from pydantic import BaseModel

logger = logging.getLogger(__name__)
router = APIRouter()


class HealthResponse(BaseModel):
    """Health check response model"""

    status: str
    timestamp: float
    service: str
    version: str = "1.0.0"
    checks: Dict[str, Any] = {}


class DetailedHealthResponse(BaseModel):
    """Detailed health check response"""

    status: str
    timestamp: float
    service: str
    version: str = "1.0.0"
    uptime: float
    checks: Dict[str, Any]
    environment: str
    database: Dict[str, Any]
    redis: Dict[str, Any]
    external_services: Dict[str, Any]


@router.get("/check", response_model=HealthResponse)
async def health_check():
    """
    Basic health check endpoint
    """
    return HealthResponse(
        status="healthy",
        timestamp=time.time(),
        service="tunarasa-backend",
        checks={"api": "healthy", "startup": "complete"},
    )


@router.get("/detailed", response_model=DetailedHealthResponse)
async def detailed_health_check():
    """
    Detailed health check with dependency validation
    """
    start_time = time.time()
    checks = {}

    # Check Redis connection
    redis_status = await _check_redis()
    checks["redis"] = redis_status

    # Check database connection
    database_status = await _check_database()
    checks["database"] = database_status

    # Check external services
    external_services = await _check_external_services()
    checks["external_services"] = external_services

    # Determine overall status
    overall_status = "healthy"
    if any(check.get("status") == "unhealthy" for check in checks.values()):
        overall_status = "unhealthy"
    elif any(check.get("status") == "degraded" for check in checks.values()):
        overall_status = "degraded"

    return DetailedHealthResponse(
        status=overall_status,
        timestamp=time.time(),
        service="tunarasa-backend",
        uptime=time.time() - start_time,
        checks=checks,
        environment=settings.ENVIRONMENT,
        database=checks.get("database", {}),
        redis=checks.get("redis", {}),
        external_services=checks.get("external_services", {}),
    )


async def _check_redis() -> Dict[str, Any]:
    """Check Redis connection and performance"""
    try:
        redis_client = redis.from_url(settings.REDIS_URL)

        # Test connection
        start_time = time.time()
        redis_client.ping()
        response_time = time.time() - start_time

        # Get basic info
        info = redis_client.info()
        memory_usage = info.get("used_memory_human", "unknown")

        return {
            "status": "healthy",
            "response_time": response_time,
            "memory_usage": memory_usage,
            "connected_clients": info.get("connected_clients", 0),
        }

    except Exception as e:
        logger.error(f"Redis health check failed: {e}")
        return {"status": "unhealthy", "error": str(e)}


async def _check_database() -> Dict[str, Any]:
    """Check database connection and performance"""
    try:
        from app.core.config import test_database_connection

        # Test connection using new SQLAlchemy setup
        connection_success = test_database_connection()

        if connection_success:
            return {
                "status": "healthy",
                "provider": "supabase",
                "schema": "postgresql+psycopg2",
                "connection": "connected",
                "type": "SQLAlchemy",
            }
        else:
            return {"status": "unhealthy", "error": "Connection test failed"}

    except Exception as e:
        logger.error(f"Database health check failed: {e}")
        return {"status": "unhealthy", "error": str(e)}


async def _check_external_services() -> Dict[str, Any]:
    """Check external service availability"""
    services = {}

    # Check Groq API
    services["groq"] = await _check_groq_api()

    # Check Pinecone
    services["pinecone"] = await _check_pinecone()

    # Check Supabase
    services["supabase"] = await _check_supabase()

    return services


async def _check_groq_api() -> Dict[str, Any]:
    """Check Groq API availability"""
    try:
        if not settings.GROQ_API_KEY:
            return {"status": "not_configured"}

        # Implement actual Groq API health check
        import httpx

        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    "https://api.groq.com/openai/v1/models",
                    headers={"Authorization": f"Bearer {settings.GROQ_API_KEY}"},
                    timeout=5.0,
                )

                if response.status_code == 200:
                    models = response.json()
                    return {
                        "status": "healthy",
                        "models_available": len(models.get("data", [])),
                        "response_time_ms": response.elapsed.total_seconds() * 1000,
                    }
                else:
                    return {
                        "status": "unhealthy",
                        "error": f"API returned {response.status_code}",
                        "response_time_ms": response.elapsed.total_seconds() * 1000,
                    }
        except httpx.TimeoutException:
            return {"status": "unhealthy", "error": "Request timeout"}
        except Exception as api_error:
            return {"status": "unhealthy", "error": str(api_error)}

    except Exception as e:
        return {"status": "unhealthy", "error": str(e)}


async def _check_pinecone() -> Dict[str, Any]:
    """Check Pinecone availability"""
    try:
        if not settings.PINECONE_API_KEY:
            return {"status": "not_configured"}

        # Implement actual Pinecone health check
        import httpx

        try:
            async with httpx.AsyncClient() as client:
                # Check if Pinecone index exists and is accessible
                response = await client.get(
                    f"https://api.pinecone.io/indexes/{settings.PINECONE_INDEX_NAME}",
                    headers={
                        "Api-Key": settings.PINECONE_API_KEY,
                        "accept": "application/json",
                    },
                    timeout=5.0,
                )

                if response.status_code == 200:
                    index_info = response.json()
                    return {
                        "status": "healthy",
                        "index_name": settings.PINECONE_INDEX_NAME,
                        "dimension": index_info.get("dimension"),
                        "metric": index_info.get("metric"),
                        "response_time_ms": response.elapsed.total_seconds() * 1000,
                    }
                else:
                    return {
                        "status": "unhealthy",
                        "error": f"Index check returned {response.status_code}",
                        "response_time_ms": response.elapsed.total_seconds() * 1000,
                    }
        except httpx.TimeoutException:
            return {"status": "unhealthy", "error": "Request timeout"}
        except Exception as api_error:
            return {"status": "unhealthy", "error": str(api_error)}

    except Exception as e:
        return {"status": "unhealthy", "error": str(e)}


async def _check_supabase() -> Dict[str, Any]:
    """Check Supabase service availability"""
    try:
        if not settings.SUPABASE_URL or not settings.SUPABASE_SERVICE_ROLE_KEY:
            return {"status": "not_configured"}

        # Implement actual Supabase health check
        import httpx

        try:
            async with httpx.AsyncClient() as client:
                # Check Supabase REST API
                response = await client.get(
                    f"{settings.SUPABASE_URL}/rest/v1/",
                    headers={
                        "apikey": settings.SUPABASE_SERVICE_ROLE_KEY,
                        "Authorization": f"Bearer {settings.SUPABASE_SERVICE_ROLE_KEY}",
                        "Content-Type": "application/json",
                    },
                    timeout=5.0,
                )

                if response.status_code == 200:
                    return {
                        "status": "healthy",
                        "url": settings.SUPABASE_URL,
                        "auth_enabled": bool(settings.SUPABASE_JWT_SECRET),
                        "response_time_ms": response.elapsed.total_seconds() * 1000,
                    }
                else:
                    return {
                        "status": "unhealthy",
                        "error": f"Supabase API returned {response.status_code}",
                        "response_time_ms": response.elapsed.total_seconds() * 1000,
                    }
        except httpx.TimeoutException:
            return {"status": "unhealthy", "error": "Request timeout"}
        except Exception as api_error:
            return {"status": "unhealthy", "error": str(api_error)}

    except Exception as e:
        return {"status": "unhealthy", "error": str(e)}
