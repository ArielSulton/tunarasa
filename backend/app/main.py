"""
Tunarasa FastAPI Backend
Main application entry point for the sign language recognition platform.
"""

import time
from datetime import datetime

import uvicorn
from app.api.middleware.auth import AuthMiddleware
from app.api.middleware.rate_limit import RateLimitMiddleware
from app.api.v1.api import api_router
from app.core.config import (
    get_cors_origins,
    settings,
)
from app.core.database import close_database, db_manager, init_database
from app.core.logging import setup_logging
from app.services.metrics_service import metrics_service
from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from prometheus_client import generate_latest

# Setup logging
setup_logging()


def create_application() -> FastAPI:
    """Create and configure FastAPI application"""

    app = FastAPI(
        title="Tunarasa API",
        description="Sign Language Recognition and AI-Powered Q&A Platform",
        version="1.0.0",
        docs_url="/api/v1/docs" if settings.ENVIRONMENT == "development" else None,
        redoc_url="/api/v1/redoc" if settings.ENVIRONMENT == "development" else None,
        openapi_url=(
            "/api/v1/openapi.json" if settings.ENVIRONMENT == "development" else None
        ),
    )

    # Security middleware - temporarily disabled for Prometheus debugging
    # if settings.ENVIRONMENT == "production":
    #     app.add_middleware(TrustedHostMiddleware, allowed_hosts=get_allowed_hosts())

    # CORS middleware
    app.add_middleware(
        CORSMiddleware,
        allow_origins=get_cors_origins(),
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allow_headers=["*"],
    )

    # Metrics middleware - using real metrics service (BEFORE auth middleware)
    @app.middleware("http")
    async def metrics_middleware(request: Request, call_next):
        start_time = time.time()

        response = await call_next(request)

        # Record metrics using metrics service
        try:
            duration = time.time() - start_time
            metrics_service.record_http_request(
                method=request.method,
                endpoint=request.url.path,
                status_code=response.status_code,
                duration=duration,
            )
        except Exception as e:
            print(f"⚠️  [Metrics] Error: {e}")

        return response

    # Custom middleware (AFTER metrics middleware)
    app.add_middleware(RateLimitMiddleware)
    app.add_middleware(AuthMiddleware)

    # Include API router
    app.include_router(api_router, prefix="/api/v1")

    # Note: Metrics service is initialized via import at module level

    # Startup and shutdown events for database
    @app.on_event("startup")
    async def startup_event():
        """Initialize database connection and monitoring on startup"""
        try:
            # Initialize database connection
            await init_database()
            print("✅ Database connection initialized successfully")

            # Metrics service is already initialized via import
            print("✅ Prometheus metrics service ready")
        except Exception as e:
            print(f"❌ Startup initialization failed: {e}")

    @app.on_event("shutdown")
    async def shutdown_event():
        """Application shutdown"""
        try:
            await close_database()
            print("✅ Database connections closed")
        except Exception as e:
            print(f"❌ Shutdown error: {e}")
        print("Application shutdown complete")

    # Health check endpoint
    @app.get("/health")
    async def health_check():
        # Get database health status
        db_health = await db_manager.health_check()

        return {
            "status": "healthy" if db_health["status"] == "healthy" else "degraded",
            "service": "tunarasa-backend",
            "database": db_health,
        }

    # Metrics endpoint (before middleware)
    @app.get("/metrics")
    async def metrics(request: Request):
        try:
            client_ip = request.client.host if request.client else "unknown"
            print(f"🔍 [Metrics] Request from {client_ip} at {datetime.now()}")
            print(f"🔍 [Metrics] Host header: {request.headers.get('host', 'none')}")

            metrics_data = generate_latest()
            print(f"✅ [Metrics] Generated {len(metrics_data)} bytes of metrics data")
            return Response(
                content=metrics_data,
                media_type="text/plain; version=0.0.4; charset=utf-8",
            )
        except Exception as e:
            print(f"❌ [Metrics] Error generating metrics: {e}")
            import traceback

            print(f"❌ [Metrics] Traceback: {traceback.format_exc()}")
            return Response(
                content=f"Error generating metrics: {str(e)}",
                status_code=500,
                media_type="text/plain",
            )

    return app


app = create_application()

if __name__ == "__main__":
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.ENVIRONMENT == "development",
        log_level="info",
    )
