"""
Admin validation middleware for enhanced security and quality control
"""

import json
import logging
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Optional, Tuple

import redis
from app.core.config import settings
from fastapi import HTTPException, Request, status
from pydantic import BaseModel, field_validator

logger = logging.getLogger(__name__)


class ValidationLevel(Enum):
    """Validation severity levels"""

    INFO = "info"
    WARNING = "warning"
    ERROR = "error"
    CRITICAL = "critical"


class ValidationCategory(Enum):
    """Validation categories"""

    SECURITY = "security"
    PERFORMANCE = "performance"
    QUALITY = "quality"
    CONTENT = "content"
    SYSTEM = "system"


@dataclass
class ValidationResult:
    """Validation result data structure"""

    category: ValidationCategory
    level: ValidationLevel
    message: str
    score: float
    details: Optional[Dict[str, Any]] = None
    timestamp: datetime = None

    def __post_init__(self):
        if self.timestamp is None:
            self.timestamp = datetime.now(timezone.utc)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "category": self.category.value,
            "level": self.level.value,
            "message": self.message,
            "score": self.score,
            "details": self.details or {},
            "timestamp": self.timestamp.isoformat(),
        }


class AdminValidationSettings(BaseModel):
    """Admin validation settings model"""

    # Security Settings
    max_login_attempts: int = 5
    session_timeout: int = 60
    enable_two_factor: bool = True
    ip_whitelisting: bool = False

    # LLM Quality Settings
    confidence_threshold: float = 0.7
    response_time_limit: int = 10
    enable_content_filtering: bool = True
    max_tokens_per_request: int = 1024

    # Gesture Recognition Settings
    gesture_accuracy_threshold: float = 0.8
    enable_gesture_smoothing: bool = True
    debounce_time: int = 500

    # Monitoring Settings
    enable_real_time_monitoring: bool = True
    alert_threshold: float = 0.9
    notification_email: Optional[str] = None

    # Content Moderation
    enable_content_moderation: bool = True
    blocked_keywords: Optional[str] = None
    auto_moderation: bool = False

    @field_validator(
        "confidence_threshold", "gesture_accuracy_threshold", "alert_threshold"
    )
    @classmethod
    def validate_threshold_range(cls, v):
        if not 0.1 <= v <= 1.0:
            raise ValueError("Threshold must be between 0.1 and 1.0")
        return v

    @field_validator("max_login_attempts")
    @classmethod
    def validate_login_attempts(cls, v):
        if not 1 <= v <= 10:
            raise ValueError("Max login attempts must be between 1 and 10")
        return v

    @field_validator("session_timeout")
    @classmethod
    def validate_session_timeout(cls, v):
        if not 5 <= v <= 720:  # 5 minutes to 12 hours
            raise ValueError("Session timeout must be between 5 and 720 minutes")
        return v

    @field_validator("response_time_limit")
    @classmethod
    def validate_response_time(cls, v):
        if not 1 <= v <= 30:
            raise ValueError("Response time limit must be between 1 and 30 seconds")
        return v

    @field_validator("max_tokens_per_request")
    @classmethod
    def validate_max_tokens(cls, v):
        if not 100 <= v <= 4000:
            raise ValueError("Max tokens must be between 100 and 4000")
        return v

    @field_validator("debounce_time")
    @classmethod
    def validate_debounce_time(cls, v):
        if not 100 <= v <= 2000:
            raise ValueError("Debounce time must be between 100 and 2000ms")
        return v


class AdminValidationService:
    """Comprehensive admin validation service"""

    def __init__(self):
        self.redis_client = None
        self._blocked_keywords = set()
        self._validation_cache = {}
        self._initialize_redis()
        self._load_blocked_keywords()

    def _initialize_redis(self):
        """Initialize Redis connection for caching"""
        try:
            self.redis_client = redis.from_url(settings.REDIS_URL)
            self.redis_client.ping()
            logger.info("Redis connected for admin validation service")
        except Exception as e:
            logger.warning(f"Redis connection failed: {e}")
            self.redis_client = None

    def _load_blocked_keywords(self):
        """Load blocked keywords from configuration"""
        try:
            # Load from Redis cache if available
            if self.redis_client:
                cached_keywords = self.redis_client.get("admin:blocked_keywords")
                if cached_keywords:
                    self._blocked_keywords = set(json.loads(cached_keywords))
                    return

            # Default blocked keywords for Indonesian government services
            default_keywords = {
                "spam",
                "scam",
                "fraud",
                "hack",
                "exploit",
                "vulnerability",
                "penipuan",
                "spam",
                "bohong",
                "palsu",
                "illegal",
            }
            self._blocked_keywords = default_keywords

        except Exception as e:
            logger.error(f"Failed to load blocked keywords: {e}")
            self._blocked_keywords = set()

    async def validate_admin_request(
        self, request: Request, operation: str, data: Optional[Dict[str, Any]] = None
    ) -> List[ValidationResult]:
        """Comprehensive admin request validation"""

        results = []

        # Security validation
        security_results = await self._validate_security(request, operation)
        results.extend(security_results)

        # Performance validation
        if data:
            performance_results = await self._validate_performance(data)
            results.extend(performance_results)

        # Content validation
        if data and isinstance(data, dict):
            content_results = await self._validate_content(data)
            results.extend(content_results)

        # Rate limiting validation
        rate_limit_results = await self._validate_rate_limits(request)
        results.extend(rate_limit_results)

        return results

    async def _validate_security(
        self, request: Request, operation: str
    ) -> List[ValidationResult]:
        """Validate security aspects of admin request"""

        results = []

        try:
            # IP address validation
            client_ip = request.client.host if request.client else "unknown"
            ip_result = await self._validate_ip_address(client_ip)
            if ip_result:
                results.append(ip_result)

            # Session validation
            session_result = await self._validate_admin_session(request)
            if session_result:
                results.append(session_result)

            # Operation permission validation
            operation_result = await self._validate_operation_permissions(
                request, operation
            )
            if operation_result:
                results.append(operation_result)

        except Exception as e:
            logger.error(f"Security validation failed: {e}")
            results.append(
                ValidationResult(
                    category=ValidationCategory.SECURITY,
                    level=ValidationLevel.ERROR,
                    message=f"Security validation error: {str(e)}",
                    score=0.0,
                )
            )

        return results

    async def _validate_ip_address(self, ip_address: str) -> Optional[ValidationResult]:
        """Validate IP address against whitelist"""

        # For demo purposes, accept all IPs but log suspicious ones
        suspicious_patterns = ["127.0.0.1", "localhost"]

        if ip_address in suspicious_patterns:
            return ValidationResult(
                category=ValidationCategory.SECURITY,
                level=ValidationLevel.WARNING,
                message=f"Request from local IP: {ip_address}",
                score=0.7,
                details={"ip_address": ip_address, "pattern": "local"},
            )

        return ValidationResult(
            category=ValidationCategory.SECURITY,
            level=ValidationLevel.INFO,
            message=f"IP validation passed for {ip_address}",
            score=1.0,
            details={"ip_address": ip_address},
        )

    async def _validate_admin_session(
        self, request: Request
    ) -> Optional[ValidationResult]:
        """Validate admin session integrity"""

        try:
            # Check if user is authenticated and has admin role
            user = getattr(request.state, "user", None)

            if not user:
                return ValidationResult(
                    category=ValidationCategory.SECURITY,
                    level=ValidationLevel.CRITICAL,
                    message="No authenticated user found",
                    score=0.0,
                )

            # Check admin role (simplified - in real implementation, check against database)
            user_role = user.get("role", "")
            if user_role not in ["admin", "super_admin"]:
                return ValidationResult(
                    category=ValidationCategory.SECURITY,
                    level=ValidationLevel.ERROR,
                    message=f"Insufficient permissions. Role: {user_role}",
                    score=0.2,
                    details={"user_role": user_role, "required_role": "admin"},
                )

            return ValidationResult(
                category=ValidationCategory.SECURITY,
                level=ValidationLevel.INFO,
                message=f"Admin session validated for {user.get('email', 'unknown')}",
                score=1.0,
                details={"user_id": user.get("id"), "role": user_role},
            )

        except Exception as e:
            return ValidationResult(
                category=ValidationCategory.SECURITY,
                level=ValidationLevel.ERROR,
                message=f"Session validation failed: {str(e)}",
                score=0.0,
            )

    async def _validate_operation_permissions(
        self, request: Request, operation: str
    ) -> Optional[ValidationResult]:
        """Validate operation-specific permissions"""

        # Define operation risk levels
        high_risk_operations = {
            "delete_user",
            "modify_system_settings",
            "export_data",
            "reset_passwords",
            "modify_permissions",
        }

        medium_risk_operations = {
            "update_user",
            "view_sensitive_data",
            "send_notifications",
        }

        if operation in high_risk_operations:
            return ValidationResult(
                category=ValidationCategory.SECURITY,
                level=ValidationLevel.WARNING,
                message=f"High-risk operation: {operation}",
                score=0.6,
                details={"operation": operation, "risk_level": "high"},
            )
        elif operation in medium_risk_operations:
            return ValidationResult(
                category=ValidationCategory.SECURITY,
                level=ValidationLevel.INFO,
                message=f"Medium-risk operation: {operation}",
                score=0.8,
                details={"operation": operation, "risk_level": "medium"},
            )

        return ValidationResult(
            category=ValidationCategory.SECURITY,
            level=ValidationLevel.INFO,
            message=f"Operation {operation} validated",
            score=1.0,
            details={"operation": operation, "risk_level": "low"},
        )

    async def _validate_performance(
        self, data: Dict[str, Any]
    ) -> List[ValidationResult]:
        """Validate performance-related settings"""

        results = []

        # Check response time settings
        response_time = data.get("response_time_limit", 10)
        if response_time > 15:
            results.append(
                ValidationResult(
                    category=ValidationCategory.PERFORMANCE,
                    level=ValidationLevel.WARNING,
                    message=f"Response time limit too high: {response_time}s",
                    score=0.6,
                    details={
                        "response_time_limit": response_time,
                        "recommended": "≤15s",
                    },
                )
            )
        else:
            results.append(
                ValidationResult(
                    category=ValidationCategory.PERFORMANCE,
                    level=ValidationLevel.INFO,
                    message=f"Response time limit acceptable: {response_time}s",
                    score=1.0,
                    details={"response_time_limit": response_time},
                )
            )

        # Check token limits
        max_tokens = data.get("max_tokens_per_request", 1024)
        if max_tokens > 2000:
            results.append(
                ValidationResult(
                    category=ValidationCategory.PERFORMANCE,
                    level=ValidationLevel.WARNING,
                    message=f"Token limit high: {max_tokens}",
                    score=0.7,
                    details={"max_tokens": max_tokens, "recommended": "≤2000"},
                )
            )

        return results

    async def _validate_content(self, data: Dict[str, Any]) -> List[ValidationResult]:
        """Validate content and moderation settings"""

        results = []

        # Check blocked keywords
        keywords = data.get("blocked_keywords", "")
        if keywords:
            keyword_list = [k.strip().lower() for k in keywords.split(",")]

            # Check for inappropriate or ineffective keywords
            if len(keyword_list) > 100:
                results.append(
                    ValidationResult(
                        category=ValidationCategory.CONTENT,
                        level=ValidationLevel.WARNING,
                        message=f"Too many blocked keywords: {len(keyword_list)}",
                        score=0.7,
                        details={
                            "keyword_count": len(keyword_list),
                            "recommended": "≤100",
                        },
                    )
                )

            # Check for empty keywords
            empty_keywords = [k for k in keyword_list if not k.strip()]
            if empty_keywords:
                results.append(
                    ValidationResult(
                        category=ValidationCategory.CONTENT,
                        level=ValidationLevel.WARNING,
                        message=f"Found {len(empty_keywords)} empty keywords",
                        score=0.8,
                        details={"empty_keyword_count": len(empty_keywords)},
                    )
                )

        # Check content filtering settings
        if not data.get("enable_content_filtering", True):
            results.append(
                ValidationResult(
                    category=ValidationCategory.CONTENT,
                    level=ValidationLevel.WARNING,
                    message="Content filtering is disabled",
                    score=0.5,
                    details={
                        "recommendation": "Enable content filtering for better security"
                    },
                )
            )

        return results

    async def _validate_rate_limits(self, request: Request) -> List[ValidationResult]:
        """Validate rate limiting compliance"""

        results = []

        try:
            if not self.redis_client:
                return results

            # Get client identifier
            client_ip = request.client.host if request.client else "unknown"
            user = getattr(request.state, "user", None)
            client_id = f"admin:{user.get('id') if user else client_ip}"

            # Check rate limit
            current_time = int(time.time())
            window = 60  # 1 minute window
            max_requests = 100  # Max requests per window

            # Use sliding window rate limiting
            pipe = self.redis_client.pipeline()
            key = f"rate_limit:{client_id}"

            # Remove old entries
            pipe.zremrangebyscore(key, 0, current_time - window)
            # Add current request
            pipe.zadd(key, {str(current_time): current_time})
            # Count requests in window
            pipe.zcard(key)
            # Set expiry
            pipe.expire(key, window)

            responses = pipe.execute()
            request_count = responses[2]

            if request_count > max_requests:
                results.append(
                    ValidationResult(
                        category=ValidationCategory.SYSTEM,
                        level=ValidationLevel.ERROR,
                        message=f"Rate limit exceeded: {request_count}/{max_requests}",
                        score=0.0,
                        details={
                            "request_count": request_count,
                            "limit": max_requests,
                            "window": window,
                            "client_id": client_id,
                        },
                    )
                )
            elif request_count > max_requests * 0.8:
                results.append(
                    ValidationResult(
                        category=ValidationCategory.SYSTEM,
                        level=ValidationLevel.WARNING,
                        message=f"Approaching rate limit: {request_count}/{max_requests}",
                        score=0.7,
                        details={
                            "request_count": request_count,
                            "limit": max_requests,
                            "client_id": client_id,
                        },
                    )
                )

        except Exception as e:
            logger.error(f"Rate limit validation failed: {e}")
            results.append(
                ValidationResult(
                    category=ValidationCategory.SYSTEM,
                    level=ValidationLevel.ERROR,
                    message=f"Rate limit check failed: {str(e)}",
                    score=0.5,
                )
            )

        return results

    async def calculate_overall_validation_score(
        self, results: List[ValidationResult]
    ) -> Tuple[float, Dict[str, Any]]:
        """Calculate overall validation score and summary"""

        if not results:
            return 0.0, {
                "status": "no_validation",
                "message": "No validation performed",
            }

        # Weight categories differently
        category_weights = {
            ValidationCategory.SECURITY: 0.4,
            ValidationCategory.PERFORMANCE: 0.25,
            ValidationCategory.QUALITY: 0.2,
            ValidationCategory.CONTENT: 0.1,
            ValidationCategory.SYSTEM: 0.05,
        }

        # Calculate weighted score
        total_score = 0.0
        total_weight = 0.0
        category_scores = {}

        for category in ValidationCategory:
            category_results = [r for r in results if r.category == category]
            if category_results:
                category_score = sum(r.score for r in category_results) / len(
                    category_results
                )
                weight = category_weights.get(category, 0.1)
                total_score += category_score * weight
                total_weight += weight
                category_scores[category.value] = {
                    "score": category_score,
                    "count": len(category_results),
                    "weight": weight,
                }

        overall_score = total_score / total_weight if total_weight > 0 else 0.0

        # Determine status
        if overall_score >= 0.9:
            status = "excellent"
        elif overall_score >= 0.7:
            status = "good"
        elif overall_score >= 0.5:
            status = "needs_improvement"
        else:
            status = "critical"

        # Count issues by level
        level_counts = {}
        for level in ValidationLevel:
            count = len([r for r in results if r.level == level])
            if count > 0:
                level_counts[level.value] = count

        summary = {
            "overall_score": round(overall_score, 3),
            "status": status,
            "total_validations": len(results),
            "category_scores": category_scores,
            "level_counts": level_counts,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

        return overall_score, summary

    async def enforce_validation_rules(
        self, results: List[ValidationResult], strict_mode: bool = False
    ):
        """Enforce validation rules and raise exceptions for critical issues"""

        critical_issues = [r for r in results if r.level == ValidationLevel.CRITICAL]
        error_issues = [r for r in results if r.level == ValidationLevel.ERROR]

        if critical_issues:
            messages = [r.message for r in critical_issues]
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Critical validation failures: {'; '.join(messages)}",
            )

        if strict_mode and error_issues:
            messages = [r.message for r in error_issues]
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Validation errors in strict mode: {'; '.join(messages)}",
            )

    async def update_blocked_keywords(self, keywords: str):
        """Update blocked keywords list"""
        try:
            if keywords:
                keyword_list = [k.strip().lower() for k in keywords.split(",")]
                self._blocked_keywords = set(keyword_list)
            else:
                self._blocked_keywords = set()

            # Cache in Redis
            if self.redis_client:
                self.redis_client.setex(
                    "admin:blocked_keywords",
                    86400,  # 24 hours
                    json.dumps(list(self._blocked_keywords)),
                )

            logger.info(
                f"Updated blocked keywords: {len(self._blocked_keywords)} keywords"
            )

        except Exception as e:
            logger.error(f"Failed to update blocked keywords: {e}")
            raise


# Global validation service instance
_admin_validation_service = None


def get_admin_validation_service() -> AdminValidationService:
    """Get admin validation service singleton"""
    global _admin_validation_service
    if _admin_validation_service is None:
        _admin_validation_service = AdminValidationService()
    return _admin_validation_service


# Dependency for FastAPI
async def validate_admin_operation(
    request: Request,
    operation: str = "general",
    data: Optional[Dict[str, Any]] = None,
    strict_mode: bool = False,
) -> List[ValidationResult]:
    """FastAPI dependency for admin validation"""

    validation_service = get_admin_validation_service()

    # Perform validation
    results = await validation_service.validate_admin_request(request, operation, data)

    # Enforce rules
    await validation_service.enforce_validation_rules(results, strict_mode)

    return results
