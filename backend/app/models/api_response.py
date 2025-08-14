"""
Standardized API Response Models
Provides consistent response format across all endpoints
"""

from datetime import datetime
from typing import Any, Dict, Generic, List, Optional, TypeVar, Union

from fastapi import status
from pydantic import BaseModel, Field

T = TypeVar("T")


class ResponseMetadata(BaseModel):
    """Metadata for API responses"""

    timestamp: str = Field(default_factory=lambda: datetime.utcnow().isoformat())
    request_id: Optional[str] = None
    version: str = "1.0.0"
    processing_time_ms: Optional[float] = None
    message: Optional[str] = None


class PaginationInfo(BaseModel):
    """Pagination information for list responses"""

    page: int = Field(ge=1, description="Current page number")
    limit: int = Field(ge=1, le=1000, description="Items per page")
    total: int = Field(ge=0, description="Total number of items")
    has_next: bool = Field(description="Whether there are more pages")
    has_prev: bool = Field(description="Whether there are previous pages")

    @classmethod
    def create(cls, page: int, limit: int, total: int) -> "PaginationInfo":
        """Create pagination info from basic parameters"""
        return cls(
            page=page,
            limit=limit,
            total=total,
            has_next=(page * limit) < total,
            has_prev=page > 1,
        )


class ValidationError(BaseModel):
    """Validation error details"""

    field: str
    message: str
    code: str
    value: Optional[Any] = None


class ApiError(BaseModel):
    """Standardized error information"""

    code: str = Field(description="Error code for programmatic handling")
    message: str = Field(description="Human-readable error message")
    details: Optional[Dict[str, Any]] = Field(
        default=None, description="Additional error details"
    )
    validation_errors: Optional[List[ValidationError]] = Field(
        default=None, description="Field validation errors"
    )
    trace_id: Optional[str] = Field(
        default=None, description="Request trace ID for debugging"
    )


class ApiResponse(BaseModel, Generic[T]):
    """Standardized API response format"""

    success: bool = Field(description="Indicates if the request was successful")
    data: Optional[T] = Field(default=None, description="Response data")
    error: Optional[ApiError] = Field(
        default=None, description="Error information if success=false"
    )
    metadata: ResponseMetadata = Field(default_factory=ResponseMetadata)

    class Config:
        json_encoders = {datetime: lambda v: v.isoformat()}


class PaginatedResponse(BaseModel, Generic[T]):
    """Paginated list response"""

    items: List[T] = Field(description="List of items")
    pagination: PaginationInfo = Field(description="Pagination information")


# Specific response types for common use cases
class SuccessResponse(ApiResponse[T]):
    """Success response with data"""

    success: bool = True

    def __init__(self, data: T, message: Optional[str] = None, **kwargs):
        super().__init__(success=True, data=data, **kwargs)
        if message:
            self.metadata.message = message


class ErrorResponse(ApiResponse[None]):
    """Error response without data"""

    success: bool = False
    data: None = None

    def __init__(self, error: ApiError, **kwargs):
        super().__init__(success=False, error=error, **kwargs)


class ListResponse(ApiResponse[PaginatedResponse[T]]):
    """Paginated list response"""

    @classmethod
    def create(
        cls, items: List[T], page: int, limit: int, total: int
    ) -> "ListResponse[T]":
        """Create a paginated list response"""
        pagination = PaginationInfo.create(page, limit, total)
        paginated_data = PaginatedResponse(items=items, pagination=pagination)
        return cls(success=True, data=paginated_data)


# Response factory functions for common patterns
def success_response(
    data: T, message: Optional[str] = None, request_id: Optional[str] = None
) -> ApiResponse[T]:
    """Create a success response"""
    metadata = ResponseMetadata(request_id=request_id)
    return ApiResponse(success=True, data=data, metadata=metadata)


def error_response(
    code: str,
    message: str,
    details: Optional[Dict[str, Any]] = None,
    status_code: int = status.HTTP_500_INTERNAL_SERVER_ERROR,
    validation_errors: Optional[List[ValidationError]] = None,
    request_id: Optional[str] = None,
) -> ApiResponse[None]:
    """Create an error response"""
    error = ApiError(
        code=code,
        message=message,
        details=details or {},
        validation_errors=validation_errors,
        trace_id=request_id,
    )
    metadata = ResponseMetadata(request_id=request_id)
    return ApiResponse(success=False, error=error, metadata=metadata)


def validation_error_response(
    validation_errors: List[ValidationError],
    message: str = "Validation failed",
    request_id: Optional[str] = None,
) -> ApiResponse[None]:
    """Create a validation error response"""
    return error_response(
        code="VALIDATION_ERROR",
        message=message,
        validation_errors=validation_errors,
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        request_id=request_id,
    )


def not_found_response(
    resource: str, resource_id: Union[str, int], request_id: Optional[str] = None
) -> ApiResponse[None]:
    """Create a not found error response"""
    return error_response(
        code="NOT_FOUND",
        message=f"{resource} with ID {resource_id} not found",
        details={"resource": resource, "id": str(resource_id)},
        status_code=status.HTTP_404_NOT_FOUND,
        request_id=request_id,
    )


def unauthorized_response(
    message: str = "Authentication required", request_id: Optional[str] = None
) -> ApiResponse[None]:
    """Create an unauthorized error response"""
    return error_response(
        code="UNAUTHORIZED",
        message=message,
        status_code=status.HTTP_401_UNAUTHORIZED,
        request_id=request_id,
    )


def forbidden_response(
    message: str = "Access denied", request_id: Optional[str] = None
) -> ApiResponse[None]:
    """Create a forbidden error response"""
    return error_response(
        code="FORBIDDEN",
        message=message,
        status_code=status.HTTP_403_FORBIDDEN,
        request_id=request_id,
    )


def internal_error_response(
    message: str = "Internal server error",
    details: Optional[Dict[str, Any]] = None,
    request_id: Optional[str] = None,
) -> ApiResponse[None]:
    """Create an internal server error response"""
    return error_response(
        code="INTERNAL_ERROR",
        message=message,
        details=details,
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        request_id=request_id,
    )


def rate_limit_response(
    message: str = "Rate limit exceeded",
    retry_after: Optional[int] = None,
    request_id: Optional[str] = None,
) -> ApiResponse[None]:
    """Create a rate limit error response"""
    details = {"retry_after_seconds": retry_after} if retry_after else None
    return error_response(
        code="RATE_LIMIT_EXCEEDED",
        message=message,
        details=details,
        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
        request_id=request_id,
    )


# Helper for creating paginated responses
def paginated_response(
    items: List[T], page: int, limit: int, total: int, request_id: Optional[str] = None
) -> ApiResponse[PaginatedResponse[T]]:
    """Create a paginated response"""
    pagination = PaginationInfo.create(page, limit, total)
    paginated_data = PaginatedResponse(items=items, pagination=pagination)
    metadata = ResponseMetadata(request_id=request_id)
    return ApiResponse(success=True, data=paginated_data, metadata=metadata)


# Response middleware for request timing
class ResponseEnhancer:
    """Utility class for enhancing responses with additional metadata"""

    @staticmethod
    def add_timing(
        response: ApiResponse, start_time: float, end_time: float
    ) -> ApiResponse:
        """Add processing time to response"""
        response.metadata.processing_time_ms = (end_time - start_time) * 1000
        return response

    @staticmethod
    def add_request_id(response: ApiResponse, request_id: str) -> ApiResponse:
        """Add request ID to response"""
        response.metadata.request_id = request_id
        if response.error:
            response.error.trace_id = request_id
        return response


# Common response types for specific endpoints
class HealthCheckData(BaseModel):
    """Health check response data"""

    status: str = Field(description="Service health status")
    service: str = Field(description="Service name")
    version: str = Field(description="Service version")
    uptime: Optional[float] = Field(description="Service uptime in seconds")
    checks: Dict[str, Any] = Field(
        default_factory=dict, description="Individual health checks"
    )


class StatsData(BaseModel):
    """Dashboard statistics data"""

    total_users: int = 0
    total_conversations: int = 0
    total_messages: int = 0
    active_conversations: int = 0
    user_messages: int = 0
    ai_messages: int = 0
    avg_messages_per_conversation: float = 0.0
    last_updated: str = Field(default_factory=lambda: datetime.utcnow().isoformat())


class UserData(BaseModel):
    """User data response"""

    user_id: int
    supabase_user_id: Optional[str] = None
    full_name: Optional[str] = None
    role: Optional[str] = None
    created_at: str
    updated_at: str
    conversation_count: int = 0


class ConversationData(BaseModel):
    """Conversation data response"""

    conversation_id: int
    is_active: bool
    created_at: str
    updated_at: str
    message_count: int = 0
    last_message_at: Optional[str] = None


# Type aliases for common response patterns
HealthResponse = ApiResponse[HealthCheckData]
StatsResponse = ApiResponse[StatsData]
UserResponse = ApiResponse[UserData]
UserListResponse = ApiResponse[PaginatedResponse[UserData]]
ConversationResponse = ApiResponse[ConversationData]
ConversationListResponse = ApiResponse[PaginatedResponse[ConversationData]]
