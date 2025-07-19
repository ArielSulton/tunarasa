"""
Prometheus metrics collection service for Tunarasa
"""

import logging
from typing import Dict, Any, Optional
from datetime import datetime
import time

from prometheus_client import Counter, Histogram, Gauge, Info
from app.core.config import settings

logger = logging.getLogger(__name__)

# Define Prometheus metrics
tunarasa_http_requests_total = Counter(
    'tunarasa_http_requests_total',
    'Total HTTP requests',
    ['method', 'endpoint', 'status_code']
)

tunarasa_http_request_duration_seconds = Histogram(
    'tunarasa_http_request_duration_seconds',
    'HTTP request duration in seconds',
    ['method', 'endpoint']
)

tunarasa_active_sessions_total = Gauge(
    'tunarasa_active_sessions_total',
    'Number of active user sessions'
)

tunarasa_gesture_recognitions_total = Counter(
    'tunarasa_gesture_recognitions_total',
    'Total gesture recognitions performed',
    ['gesture_type', 'confidence_level']
)

tunarasa_gesture_recognition_accuracy = Gauge(
    'tunarasa_gesture_recognition_accuracy',
    'Current gesture recognition accuracy'
)

tunarasa_ai_requests_total = Counter(
    'tunarasa_ai_requests_total',
    'Total AI requests processed',
    ['model', 'request_type']
)

tunarasa_ai_request_errors_total = Counter(
    'tunarasa_ai_request_errors_total',
    'Total AI request errors',
    ['model', 'error_type']
)

tunarasa_ai_response_confidence_avg = Gauge(
    'tunarasa_ai_response_confidence_avg',
    'Average AI response confidence'
)

tunarasa_ai_response_time_seconds = Histogram(
    'tunarasa_ai_response_time_seconds',
    'AI response time in seconds',
    ['model', 'request_type']
)

tunarasa_qr_codes_generated_total = Counter(
    'tunarasa_qr_codes_generated_total',
    'Total QR codes generated',
    ['qr_type']
)

tunarasa_database_connections_active = Gauge(
    'tunarasa_database_connections_active',
    'Number of active database connections'
)

tunarasa_deepeval_scores = Histogram(
    'tunarasa_deepeval_scores',
    'DeepEval quality scores',
    ['metric_type']
)

# Application info
tunarasa_info = Info(
    'tunarasa_info',
    'Application information'
)

# Set application info
tunarasa_info.info({
    'version': '0.4.0',
    'environment': settings.ENVIRONMENT,
    'ai_model': settings.LLM_MODEL
})


class MetricsService:
    """Service for collecting and managing Prometheus metrics"""
    
    def __init__(self):
        self.start_time = time.time()
        self.gesture_accuracy_window = []
        self.ai_confidence_window = []
        
    def record_http_request(
        self,
        method: str,
        endpoint: str,
        status_code: int,
        duration: float
    ):
        """Record HTTP request metrics"""
        try:
            tunarasa_http_requests_total.labels(
                method=method,
                endpoint=endpoint,
                status_code=str(status_code)
            ).inc()
            
            tunarasa_http_request_duration_seconds.labels(
                method=method,
                endpoint=endpoint
            ).observe(duration)
            
        except Exception as e:
            logger.error(f"Failed to record HTTP metrics: {e}")
    
    def update_active_sessions(self, count: int):
        """Update active sessions gauge"""
        try:
            tunarasa_active_sessions_total.set(count)
        except Exception as e:
            logger.error(f"Failed to update active sessions: {e}")
    
    def record_gesture_recognition(
        self,
        gesture_type: str,
        confidence: float,
        accuracy: Optional[float] = None
    ):
        """Record gesture recognition metrics"""
        try:
            # Determine confidence level
            if confidence >= 0.9:
                confidence_level = "high"
            elif confidence >= 0.7:
                confidence_level = "medium"
            else:
                confidence_level = "low"
            
            tunarasa_gesture_recognitions_total.labels(
                gesture_type=gesture_type,
                confidence_level=confidence_level
            ).inc()
            
            # Update accuracy if provided
            if accuracy is not None:
                self.gesture_accuracy_window.append(accuracy)
                # Keep only last 100 values
                if len(self.gesture_accuracy_window) > 100:
                    self.gesture_accuracy_window.pop(0)
                
                avg_accuracy = sum(self.gesture_accuracy_window) / len(self.gesture_accuracy_window)
                tunarasa_gesture_recognition_accuracy.set(avg_accuracy)
            
        except Exception as e:
            logger.error(f"Failed to record gesture metrics: {e}")
    
    def record_ai_request(
        self,
        model: str,
        request_type: str,
        duration: float,
        confidence: Optional[float] = None,
        error_type: Optional[str] = None
    ):
        """Record AI request metrics"""
        try:
            if error_type:
                tunarasa_ai_request_errors_total.labels(
                    model=model,
                    error_type=error_type
                ).inc()
            else:
                tunarasa_ai_requests_total.labels(
                    model=model,
                    request_type=request_type
                ).inc()
                
                tunarasa_ai_response_time_seconds.labels(
                    model=model,
                    request_type=request_type
                ).observe(duration)
            
            # Update confidence average
            if confidence is not None:
                self.ai_confidence_window.append(confidence)
                # Keep only last 100 values
                if len(self.ai_confidence_window) > 100:
                    self.ai_confidence_window.pop(0)
                
                avg_confidence = sum(self.ai_confidence_window) / len(self.ai_confidence_window)
                tunarasa_ai_response_confidence_avg.set(avg_confidence)
            
        except Exception as e:
            logger.error(f"Failed to record AI metrics: {e}")
    
    def record_qr_generation(self, qr_type: str):
        """Record QR code generation"""
        try:
            tunarasa_qr_codes_generated_total.labels(qr_type=qr_type).inc()
        except Exception as e:
            logger.error(f"Failed to record QR metrics: {e}")
    
    def update_database_connections(self, count: int):
        """Update database connections gauge"""
        try:
            tunarasa_database_connections_active.set(count)
        except Exception as e:
            logger.error(f"Failed to update database metrics: {e}")
    
    def record_deepeval_score(self, metric_type: str, score: float):
        """Record DeepEval quality scores"""
        try:
            tunarasa_deepeval_scores.labels(metric_type=metric_type).observe(score)
        except Exception as e:
            logger.error(f"Failed to record DeepEval metrics: {e}")
    
    def get_system_metrics(self) -> Dict[str, Any]:
        """Get current system metrics summary"""
        try:
            uptime = time.time() - self.start_time
            
            return {
                "uptime_seconds": uptime,
                "active_sessions": tunarasa_active_sessions_total._value._value,
                "gesture_accuracy": tunarasa_gesture_recognition_accuracy._value._value,
                "ai_confidence": tunarasa_ai_response_confidence_avg._value._value,
                "database_connections": tunarasa_database_connections_active._value._value,
                "timestamp": datetime.utcnow().isoformat()
            }
        except Exception as e:
            logger.error(f"Failed to get system metrics: {e}")
            return {"error": str(e)}


# Global metrics service instance
metrics_service = MetricsService()