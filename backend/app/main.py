"""
Tunarasa FastAPI Backend
Main application entry point for the sign language recognition platform.
"""

import time

import uvicorn
from app.api.middleware.auth import AuthMiddleware
from app.api.middleware.rate_limit import RateLimitMiddleware
from app.api.v1.api import api_router
from app.core.config import (
    get_allowed_hosts,
    get_cors_origins,
    settings,
    test_database_connection,
)
from app.core.logging import setup_logging
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from prometheus_client import Counter, Histogram, generate_latest
from prometheus_fastapi_instrumentator import Instrumentator

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
            if hasattr(collector, "_name") and collector._name in [
                "tunarasa_http_requests_total",
                "tunarasa_http_request_duration_seconds",
            ]:
                collectors_to_remove.append(collector)

        for collector in collectors_to_remove:
            REGISTRY.unregister(collector)

        # Now create new metrics
        REQUEST_COUNT = Counter(
            "tunarasa_http_requests_total",
            "Total HTTP requests",
            ["method", "endpoint", "status_code"],
        )
        REQUEST_DURATION = Histogram(
            "tunarasa_http_request_duration_seconds",
            "HTTP request duration",
            ["method", "endpoint"],
        )
        _metrics_initialized = True
    except Exception as e:
        # Fallback: create dummy metrics that don't interfere
        print(f"Warning: Could not initialize Prometheus metrics: {e}")

        class DummyMetric:
            def labels(self, *args, **kwargs):
                return self

            def inc(self, *args, **kwargs):
                pass

            def observe(self, *args, **kwargs):
                pass

            def time(self):
                return self

            def __enter__(self):
                return self

            def __exit__(self, *args):
                pass

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
        openapi_url=(
            "/api/v1/openapi.json" if settings.ENVIRONMENT == "development" else None
        ),
    )

    # Security middleware
    if settings.ENVIRONMENT == "production":
        app.add_middleware(TrustedHostMiddleware, allowed_hosts=get_allowed_hosts())

    # CORS middleware
    app.add_middleware(
        CORSMiddleware,
        allow_origins=get_cors_origins(),
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
            status_code=response.status_code,
        ).inc()

        REQUEST_DURATION.labels(
            method=request.method, endpoint=request.url.path
        ).observe(duration)

        return response

    # Include API router
    app.include_router(api_router, prefix="/api/v1")

    # Initialize Prometheus FastAPI Instrumentator
    instrumentator = Instrumentator(
        should_group_status_codes=False,
        should_ignore_untemplated=True,
        should_respect_env_var=True,
        should_instrument_requests_inprogress=True,
        excluded_handlers=[".*admin.*", "/metrics", "/health"],
        env_var_name="ENABLE_METRICS",
        inprogress_name="tunarasa_requests_inprogress",
        inprogress_labels=True,
        custom_labels={"service": "tunarasa", "version": "1.0.0"},
    )

    # Add custom metrics for Tunarasa-specific functionality

    # Startup and shutdown events for database
    @app.on_event("startup")
    async def startup_event():
        """Test database connection and initialize monitoring on startup"""
        try:
            test_database_connection()
            # Initialize Prometheus instrumentator
            instrumentator.instrument(app).expose(
                app, endpoint="/metrics", include_in_schema=False
            )
            print("Prometheus instrumentator initialized successfully")
        except Exception as e:
            print(f"Startup initialization failed: {e}")

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
