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
from app.core.config import test_database_connection

# Initialize metrics with global variables to prevent re-creation
_metrics_initialized = False
REQUEST_COUNT = None
REQUEST_DURATION = None

if not _metrics_initialized:
    try:
        # Clear any existing metrics with the same name
        from prometheus_client import REGISTRY
        collectors_to_remove = []
        for collector in list(REGISTRY._collector_to_names.keys()):
            if hasattr(collector, '_name') and collector._name in ['tunarasa_http_requests_total', 'tunarasa_http_request_duration_seconds']:
                collectors_to_remove.append(collector)
        
        for collector in collectors_to_remove:
            REGISTRY.unregister(collector)
        
        # Now create new metrics
        REQUEST_COUNT = Counter('tunarasa_http_requests_total', 'Total HTTP requests', ['method', 'endpoint', 'status_code'])
        REQUEST_DURATION = Histogram('tunarasa_http_request_duration_seconds', 'HTTP request duration', ['method', 'endpoint'])
        _metrics_initialized = True
    except Exception as e:
        # Fallback: create dummy metrics that don't interfere
        print(f"Warning: Could not initialize Prometheus metrics: {e}")
        class DummyMetric:
            def labels(self, *args, **kwargs): return self
            def inc(self, *args, **kwargs): pass
            def observe(self, *args, **kwargs): pass
            def time(self): return self
            def __enter__(self): return self
            def __exit__(self, *args): pass
        
        REQUEST_COUNT = DummyMetric()
        REQUEST_DURATION = DummyMetric()

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
        """Test database connection on startup"""
        try:
            test_database_connection()
        except Exception as e:
            print(f"Database connection test failed: {e}")
    
    @app.on_event("shutdown")
    async def shutdown_event():
        """Application shutdown"""
        print("Application shutdown complete")
    
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