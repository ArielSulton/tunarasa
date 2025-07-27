"""
Response Middleware for Standardized API Responses
Handles request timing, IDs, and response enhancement
"""

import logging
import time
import uuid
from typing import Any, Callable, Dict

from app.models.api_response import (
    ApiResponse,
    error_response,
    internal_error_response,
    validation_error_response,
)
from fastapi import Request, Response, status
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.middleware.base import BaseHTTPMiddleware

logger = logging.getLogger(__name__)


class StandardResponseMiddleware(BaseHTTPMiddleware):
    """Middleware to standardize all API responses"""

    def __init__(self, app, exclude_paths: list = None):
        super().__init__(app)
        self.exclude_paths = exclude_paths or [
            "/docs",
            "/redoc",
            "/openapi.json",
            "/health",
        ]

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # Skip middleware for certain paths
        if any(request.url.path.startswith(path) for path in self.exclude_paths):
            return await call_next(request)

        # Generate request ID
        request_id = str(uuid.uuid4())
        request.state.request_id = request_id

        # Add request timing
        start_time = time.time()

        try:
            response = await call_next(request)

            # Calculate processing time
            end_time = time.time()
            processing_time_ms = (end_time - start_time) * 1000

            # Add timing and request ID headers
            response.headers["X-Request-ID"] = request_id
            response.headers["X-Processing-Time-MS"] = str(round(processing_time_ms, 2))

            # If response is already standardized, enhance it
            if hasattr(response, "body") and response.media_type == "application/json":
                try:
                    # For standardized responses, we don't need to modify
                    pass
                except Exception:
                    # If we can't parse JSON, leave response as-is
                    pass

            return response

        except StarletteHTTPException as exc:
            # Handle HTTP exceptions with standardized format
            end_time = time.time()
            processing_time_ms = (end_time - start_time) * 1000

            error_resp = error_response(
                code="HTTP_ERROR",
                message=exc.detail,
                details={"status_code": exc.status_code},
                request_id=request_id,
            )

            # Add processing time
            error_resp.metadata.processing_time_ms = processing_time_ms

            return JSONResponse(
                status_code=exc.status_code,
                content=error_resp.dict(),
                headers={
                    "X-Request-ID": request_id,
                    "X-Processing-Time-MS": str(round(processing_time_ms, 2)),
                },
            )

        except Exception as exc:
            # Handle unexpected exceptions
            end_time = time.time()
            processing_time_ms = (end_time - start_time) * 1000

            logger.error(
                f"Unhandled exception in request {request_id}: {exc}", exc_info=True
            )

            error_resp = internal_error_response(
                message="An unexpected error occurred",
                details={"error_type": type(exc).__name__},
                request_id=request_id,
            )

            # Add processing time
            error_resp.metadata.processing_time_ms = processing_time_ms

            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content=error_resp.dict(),
                headers={
                    "X-Request-ID": request_id,
                    "X-Processing-Time-MS": str(round(processing_time_ms, 2)),
                },
            )


# FastAPI dependencies for request context
async def get_request_id(request: Request) -> str:
    """Get the current request ID"""
    return getattr(request.state, "request_id", str(uuid.uuid4()))


async def get_request_timing(request: Request) -> Dict[str, Any]:
    """Get request timing information"""
    start_time = getattr(request.state, "start_time", time.time())
    current_time = time.time()

    return {
        "start_time": start_time,
        "current_time": current_time,
        "elapsed_ms": (current_time - start_time) * 1000,
    }


# Response factory with enhanced features
class ResponseFactory:
    """Factory for creating standardized responses with context"""

    def __init__(self, request: Request):
        self.request = request
        self.request_id = getattr(request.state, "request_id", str(uuid.uuid4()))
        self.start_time = getattr(request.state, "start_time", time.time())

    def success(self, data: Any, message: str = None) -> ApiResponse:
        """Create success response with request context"""
        response = ApiResponse(
            success=True,
            data=data,
            metadata={
                "timestamp": time.time(),
                "request_id": self.request_id,
                "processing_time_ms": (time.time() - self.start_time) * 1000,
            },
        )

        if message:
            response.metadata["message"] = message

        return response

    def error(
        self,
        code: str,
        message: str,
        details: Dict[str, Any] = None,
        status_code: int = status.HTTP_500_INTERNAL_SERVER_ERROR,
    ) -> ApiResponse:
        """Create error response with request context"""
        return error_response(
            code=code,
            message=message,
            details=details,
            status_code=status_code,
            request_id=self.request_id,
        )

    def not_found(self, resource: str, resource_id: Any) -> ApiResponse:
        """Create not found response"""
        return error_response(
            code="NOT_FOUND",
            message=f"{resource} with ID {resource_id} not found",
            details={"resource": resource, "id": str(resource_id)},
            status_code=status.HTTP_404_NOT_FOUND,
            request_id=self.request_id,
        )

    def validation_error(
        self, errors: list, message: str = "Validation failed"
    ) -> ApiResponse:
        """Create validation error response"""
        return validation_error_response(
            validation_errors=errors, message=message, request_id=self.request_id
        )

    def paginated(self, items: list, page: int, limit: int, total: int) -> ApiResponse:
        """Create paginated response"""
        from app.models.api_response import paginated_response

        return paginated_response(
            items=items, page=page, limit=limit, total=total, request_id=self.request_id
        )


# Exception handlers for common FastAPI exceptions
async def validation_exception_handler(request: Request, exc):
    """Handle Pydantic validation exceptions"""
    request_id = getattr(request.state, "request_id", str(uuid.uuid4()))

    validation_errors = []
    for error in exc.errors():
        validation_errors.append(
            {
                "field": ".".join(str(loc) for loc in error["loc"]),
                "message": error["msg"],
                "code": error["type"],
                "value": error.get("input"),
            }
        )

    error_resp = validation_error_response(
        validation_errors=validation_errors,
        message="Request validation failed",
        request_id=request_id,
    )

    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, content=error_resp.dict()
    )


async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    """Handle HTTP exceptions"""
    request_id = getattr(request.state, "request_id", str(uuid.uuid4()))

    # Map HTTP status codes to error codes
    status_code_map = {
        400: "BAD_REQUEST",
        401: "UNAUTHORIZED",
        403: "FORBIDDEN",
        404: "NOT_FOUND",
        405: "METHOD_NOT_ALLOWED",
        409: "CONFLICT",
        422: "UNPROCESSABLE_ENTITY",
        429: "RATE_LIMIT_EXCEEDED",
        500: "INTERNAL_ERROR",
        502: "BAD_GATEWAY",
        503: "SERVICE_UNAVAILABLE",
        504: "GATEWAY_TIMEOUT",
    }

    error_code = status_code_map.get(exc.status_code, "HTTP_ERROR")

    error_resp = error_response(
        code=error_code,
        message=exc.detail,
        details={"status_code": exc.status_code},
        status_code=exc.status_code,
        request_id=request_id,
    )

    return JSONResponse(status_code=exc.status_code, content=error_resp.dict())


# Request context manager for manual timing
class RequestContext:
    """Context manager for tracking request processing"""

    def __init__(self, request: Request):
        self.request = request
        self.request_id = str(uuid.uuid4())
        self.start_time = None

    def __enter__(self):
        self.start_time = time.time()
        self.request.state.request_id = self.request_id
        self.request.state.start_time = self.start_time
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        end_time = time.time()
        processing_time = (end_time - self.start_time) * 1000

        logger.info(
            f"Request {self.request_id} completed in {processing_time:.2f}ms",
            extra={
                "request_id": self.request_id,
                "processing_time_ms": processing_time,
                "path": self.request.url.path,
                "method": self.request.method,
                "success": exc_type is None,
            },
        )

        if exc_type:
            logger.error(
                f"Request {self.request_id} failed with {exc_type.__name__}: {exc_val}",
                extra={"request_id": self.request_id},
                exc_info=(exc_type, exc_val, exc_tb),
            )


# Dependency factory
def create_response_factory(request: Request) -> ResponseFactory:
    """Dependency to create response factory with request context"""
    return ResponseFactory(request)
