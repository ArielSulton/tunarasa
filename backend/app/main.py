"""
Tunarasa FastAPI Backend
Main application entry point for the sign language recognition platform.
"""

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from prometheus_client import generate_latest, Counter, Histogram
import time
import uvicorn

from app.core.config import settings
from app.api.v1.api import api_router
from app.api.middleware.auth import AuthMiddleware
from app.api.middleware.rate_limit import RateLimitMiddleware
from app.core.logging import setup_logging
from app.core.database import db_manager

# Initialize metrics
REQUEST_COUNT = Counter('tunarasa_http_requests_total', 'Total HTTP requests', ['method', 'endpoint', 'status_code'])
REQUEST_DURATION = Histogram('tunarasa_http_request_duration_seconds', 'HTTP request duration', ['method', 'endpoint'])

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
        openapi_url="/api/v1/openapi.json" if settings.ENVIRONMENT == "development" else None,
    )
    
    # Security middleware
    if settings.ENVIRONMENT == "production":
        app.add_middleware(
            TrustedHostMiddleware, 
            allowed_hosts=settings.ALLOWED_HOSTS
        )
    
    # CORS middleware
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allow_headers=["*"],
    )
    
    # Custom middleware
    app.add_middleware(RateLimitMiddleware)
    app.add_middleware(AuthMiddleware)
    
    # Metrics middleware
    @app.middleware("http")
    async def metrics_middleware(request: Request, call_next):
        start_time = time.time()
        
        response = await call_next(request)
        
        # Record metrics
        duration = time.time() - start_time
        REQUEST_COUNT.labels(
            method=request.method,
            endpoint=request.url.path,
            status_code=response.status_code
        ).inc()
        
        REQUEST_DURATION.labels(
            method=request.method,
            endpoint=request.url.path
        ).observe(duration)
        
        return response
    
    # Include API router
    app.include_router(api_router, prefix="/api/v1")
    
    # Startup and shutdown events for database
    @app.on_event("startup")
    async def startup_event():
        """Initialize database connection on startup"""
        try:
            await db_manager.connect()
            await db_manager.create_tables()
        except Exception as e:
            print(f"Failed to initialize database: {e}")
    
    @app.on_event("shutdown")
    async def shutdown_event():
        """Close database connections on shutdown"""
        try:
            await db_manager.disconnect()
        except Exception as e:
            print(f"Failed to close database connections: {e}")
    
    # Health check endpoint
    @app.get("/health")
    async def health_check():
        return {"status": "healthy", "service": "tunarasa-backend"}
    
    # Metrics endpoint
    @app.get("/metrics")
    async def metrics():
        return generate_latest()
    
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