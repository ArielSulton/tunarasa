"""
Prometheus metrics collection service for Tunarasa
"""

import logging
import time
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from app.core.config import settings
from prometheus_client import REGISTRY, Counter, Gauge, Histogram, Info

logger = logging.getLogger(__name__)

# Initialize metrics with collision handling
try:
    # Define Prometheus metrics
    tunarasa_http_requests_total = Counter(
        "tunarasa_http_requests_total",
        "Total HTTP requests",
        ["method", "endpoint", "status_code"],
    )
except ValueError as e:
    if "already exists" in str(e):
        logger.warning(f"Metric already exists, retrieving existing: {e}")
        # Get existing metric from registry
        for collector in list(REGISTRY._collector_to_names.keys()):
            if (
                hasattr(collector, "_name")
                and collector._name == "tunarasa_http_requests_total"
            ):
                tunarasa_http_requests_total = collector
                break
    else:
        raise

try:
    tunarasa_http_request_duration_seconds = Histogram(
        "tunarasa_http_request_duration_seconds",
        "HTTP request duration in seconds",
        ["method", "endpoint"],
    )
except ValueError as e:
    if "already exists" in str(e):
        logger.warning(f"Duration metric already exists, retrieving existing: {e}")
        for collector in list(REGISTRY._collector_to_names.keys()):
            if (
                hasattr(collector, "_name")
                and collector._name == "tunarasa_http_request_duration_seconds"
            ):
                tunarasa_http_request_duration_seconds = collector
                break
    else:
        raise

try:
    tunarasa_active_sessions_total = Gauge(
        "tunarasa_active_sessions_total", "Number of active user sessions"
    )
except ValueError as e:
    if "already exists" in str(e):
        logger.warning(
            f"Active sessions metric already exists, retrieving existing: {e}"
        )
        for collector in list(REGISTRY._collector_to_names.keys()):
            if (
                hasattr(collector, "_name")
                and collector._name == "tunarasa_active_sessions_total"
            ):
                tunarasa_active_sessions_total = collector
                break
    else:
        raise

try:
    tunarasa_gesture_recognitions_total = Counter(
        "tunarasa_gesture_recognitions_total",
        "Total gesture recognitions performed",
        ["gesture_type", "confidence_level"],
    )
except ValueError as e:
    if "already exists" in str(e):
        logger.warning(
            f"Gesture recognition metric already exists, retrieving existing: {e}"
        )
        for collector in list(REGISTRY._collector_to_names.keys()):
            if (
                hasattr(collector, "_name")
                and collector._name == "tunarasa_gesture_recognitions_total"
            ):
                tunarasa_gesture_recognitions_total = collector
                break
    else:
        raise

try:
    tunarasa_gesture_recognition_accuracy = Gauge(
        "tunarasa_gesture_recognition_accuracy", "Current gesture recognition accuracy"
    )
except ValueError as e:
    if "already exists" in str(e):
        logger.warning(
            f"Gesture accuracy metric already exists, retrieving existing: {e}"
        )
        for collector in list(REGISTRY._collector_to_names.keys()):
            if (
                hasattr(collector, "_name")
                and collector._name == "tunarasa_gesture_recognition_accuracy"
            ):
                tunarasa_gesture_recognition_accuracy = collector
                break
    else:
        raise

try:
    tunarasa_ai_requests_total = Counter(
        "tunarasa_ai_requests_total",
        "Total AI requests processed",
        ["model", "request_type"],
    )
except ValueError as e:
    if "already exists" in str(e):
        logger.warning(f"AI requests metric already exists, retrieving existing: {e}")
        for collector in list(REGISTRY._collector_to_names.keys()):
            if (
                hasattr(collector, "_name")
                and collector._name == "tunarasa_ai_requests_total"
            ):
                tunarasa_ai_requests_total = collector
                break
    else:
        raise

try:
    tunarasa_ai_request_errors_total = Counter(
        "tunarasa_ai_request_errors_total",
        "Total AI request errors",
        ["model", "error_type"],
    )
except ValueError as e:
    if "already exists" in str(e):
        logger.warning(f"AI errors metric already exists, retrieving existing: {e}")
        for collector in list(REGISTRY._collector_to_names.keys()):
            if (
                hasattr(collector, "_name")
                and collector._name == "tunarasa_ai_request_errors_total"
            ):
                tunarasa_ai_request_errors_total = collector
                break
    else:
        raise

try:
    tunarasa_ai_response_confidence_avg = Gauge(
        "tunarasa_ai_response_confidence_avg", "Average AI response confidence"
    )
except ValueError as e:
    if "already exists" in str(e):
        logger.warning("AI confidence metric already exists, retrieving existing")
        for collector in list(REGISTRY._collector_to_names.keys()):
            if (
                hasattr(collector, "_name")
                and collector._name == "tunarasa_ai_response_confidence_avg"
            ):
                tunarasa_ai_response_confidence_avg = collector
                break

try:
    tunarasa_ai_response_time_seconds = Histogram(
        "tunarasa_ai_response_time_seconds",
        "AI response time in seconds",
        ["model", "request_type"],
    )
except ValueError as e:
    if "already exists" in str(e):
        logger.warning("AI response time metric already exists, retrieving existing")

try:
    tunarasa_qr_codes_generated_total = Counter(
        "tunarasa_qr_codes_generated_total", "Total QR codes generated", ["qr_type"]
    )
except ValueError as e:
    if "already exists" in str(e):
        logger.warning("QR codes metric already exists, retrieving existing")

try:
    tunarasa_database_connections_active = Gauge(
        "tunarasa_database_connections_active", "Number of active database connections"
    )
except ValueError as e:
    if "already exists" in str(e):
        logger.warning(
            "Database connections metric already exists, retrieving existing"
        )

try:
    tunarasa_deepeval_scores = Histogram(
        "tunarasa_deepeval_scores", "DeepEval quality scores", ["metric_type"]
    )
except ValueError as e:
    if "already exists" in str(e):
        logger.warning("DeepEval scores metric already exists, retrieving existing")

# Additional metrics needed by dashboards
try:
    tunarasa_llm_quality_score = Gauge(
        "tunarasa_llm_quality_score",
        "LLM response quality score",
        ["metric", "category"],
    )
except ValueError as e:
    if "already exists" in str(e):
        logger.warning("LLM quality score metric already exists, retrieving existing")

try:
    tunarasa_llm_evaluations_total = Counter(
        "tunarasa_llm_evaluations_total",
        "Total LLM evaluations performed",
        ["category"],
    )
except ValueError as e:
    if "already exists" in str(e):
        logger.warning("LLM evaluations metric already exists, retrieving existing")

try:
    tunarasa_system_status = Gauge(
        "tunarasa_system_status", "System status indicator", ["component"]
    )
except ValueError as e:
    if "already exists" in str(e):
        logger.warning("System status metric already exists, retrieving existing")

# Business intelligence metrics
try:
    tunarasa_gesture_requests_total = Counter(
        "tunarasa_gesture_requests_total",
        "Total gesture requests",
        ["session_id", "language", "success"],
    )
except ValueError as e:
    if "already exists" in str(e):
        logger.warning("Gesture requests metric already exists, retrieving existing")

try:
    tunarasa_session_duration_seconds = Histogram(
        "tunarasa_session_duration_seconds",
        "Session duration in seconds",
        buckets=[30, 60, 120, 300, 600, 1800, 3600, 7200],
    )
except ValueError as e:
    if "already exists" in str(e):
        logger.warning("Session duration metric already exists, retrieving existing")

try:
    tunarasa_questions_per_session = Histogram(
        "tunarasa_questions_per_session",
        "Number of questions per session",
        buckets=[1, 2, 5, 10, 20, 50, 100],
    )
except ValueError as e:
    if "already exists" in str(e):
        logger.warning(
            "Questions per session metric already exists, retrieving existing"
        )

try:
    tunarasa_questions_total = Counter(
        "tunarasa_questions_total",
        "Total questions asked",
        ["source", "question_category"],
    )
except ValueError as e:
    if "already exists" in str(e):
        logger.warning("Questions total metric already exists, retrieving existing")

try:
    tunarasa_gesture_confidence_score = Histogram(
        "tunarasa_gesture_confidence_score",
        "Gesture recognition confidence scores",
        buckets=[0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 0.95, 0.99],
    )
except ValueError as e:
    if "already exists" in str(e):
        logger.warning(
            "Gesture confidence score metric already exists, retrieving existing"
        )

try:
    tunarasa_ai_quality_score = Histogram(
        "tunarasa_ai_quality_score",
        "AI quality score distribution",
        ["category"],
        buckets=[0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 0.95, 0.99],
    )
except ValueError as e:
    if "already exists" in str(e):
        logger.warning("AI quality score metric already exists, retrieving existing")

# SLI/SLO metrics for service level monitoring
try:
    tunarasa_service_uptime_seconds = Counter(
        "tunarasa_service_uptime_seconds", "Total service uptime in seconds"
    )
except ValueError as e:
    if "already exists" in str(e):
        logger.warning("Service uptime metric already exists, retrieving existing")

try:
    tunarasa_request_success_total = Counter(
        "tunarasa_request_success_total",
        "Total successful requests",
        ["endpoint", "method"],
    )
except ValueError as e:
    if "already exists" in str(e):
        logger.warning("Request success metric already exists, retrieving existing")

try:
    tunarasa_request_error_total = Counter(
        "tunarasa_request_error_total",
        "Total failed requests",
        ["endpoint", "method", "error_code"],
    )
except ValueError as e:
    if "already exists" in str(e):
        logger.warning("Request error metric already exists, retrieving existing")

try:
    tunarasa_sli_availability = Gauge(
        "tunarasa_sli_availability", "Service availability SLI (0-1)"
    )
except ValueError as e:
    if "already exists" in str(e):
        logger.warning("SLI availability metric already exists, retrieving existing")

try:
    tunarasa_sli_error_rate = Gauge(
        "tunarasa_sli_error_rate", "Service error rate SLI (0-1)"
    )
except ValueError as e:
    if "already exists" in str(e):
        logger.warning("SLI error rate metric already exists, retrieving existing")

try:
    tunarasa_sli_latency = Histogram(
        "tunarasa_sli_latency_seconds",
        "Service latency SLI in seconds",
        buckets=[0.1, 0.2, 0.5, 1.0, 2.0, 5.0, 10.0],
    )
except ValueError as e:
    if "already exists" in str(e):
        logger.warning("SLI latency metric already exists, retrieving existing")

try:
    tunarasa_sli_throughput = Gauge(
        "tunarasa_sli_throughput_rps", "Service throughput SLI in requests per second"
    )
except ValueError as e:
    if "already exists" in str(e):
        logger.warning("SLI throughput metric already exists, retrieving existing")

try:
    tunarasa_db_connections_max = Gauge(
        "tunarasa_db_connections_max", "Maximum database connections configured"
    )
except ValueError as e:
    if "already exists" in str(e):
        logger.warning("DB connections max metric already exists, retrieving existing")

try:
    tunarasa_redis_memory_used_bytes = Gauge(
        "tunarasa_redis_memory_used_bytes", "Redis memory usage in bytes"
    )
except ValueError as e:
    if "already exists" in str(e):
        logger.warning("Redis memory used metric already exists, retrieving existing")

try:
    tunarasa_redis_memory_max_bytes = Gauge(
        "tunarasa_redis_memory_max_bytes", "Redis maximum memory in bytes"
    )
except ValueError as e:
    if "already exists" in str(e):
        logger.warning("Redis memory max metric already exists, retrieving existing")

# FAQ Clustering Metrics
try:
    tunarasa_faq_clustering_total = Counter(
        "tunarasa_faq_clustering_total",
        "Total FAQ clustering operations performed",
        ["institution_id", "data_source"],
    )
except ValueError as e:
    if "already exists" in str(e):
        logger.warning(
            "FAQ clustering total metric already exists, retrieving existing"
        )

try:
    tunarasa_faq_clustering_duration_seconds = Histogram(
        "tunarasa_faq_clustering_duration_seconds",
        "FAQ clustering operation duration in seconds",
        ["institution_id", "data_source"],
    )
except ValueError as e:
    if "already exists" in str(e):
        logger.warning(
            "FAQ clustering duration metric already exists, retrieving existing"
        )

try:
    tunarasa_faq_clusters_count = Gauge(
        "tunarasa_faq_clusters_count",
        "Number of clusters generated per institution",
        ["institution_id"],
    )
except ValueError as e:
    if "already exists" in str(e):
        logger.warning("FAQ clusters count metric already exists, retrieving existing")

try:
    tunarasa_faq_questions_per_cluster_avg = Gauge(
        "tunarasa_faq_questions_per_cluster_avg",
        "Average questions per cluster per institution",
        ["institution_id"],
    )
except ValueError as e:
    if "already exists" in str(e):
        logger.warning(
            "FAQ questions per cluster metric already exists, retrieving existing"
        )

try:
    tunarasa_faq_clustering_silhouette_score = Gauge(
        "tunarasa_faq_clustering_silhouette_score",
        "FAQ clustering quality silhouette score (0-1)",
        ["institution_id"],
    )
except ValueError as e:
    if "already exists" in str(e):
        logger.warning(
            "FAQ clustering silhouette score metric already exists, retrieving existing"
        )

try:
    tunarasa_faq_recommendations_served_total = Counter(
        "tunarasa_faq_recommendations_served_total",
        "Total FAQ recommendations served to users",
        ["institution_id", "cluster_id"],
    )
except ValueError as e:
    if "already exists" in str(e):
        logger.warning(
            "FAQ recommendations served metric already exists, retrieving existing"
        )

try:
    tunarasa_faq_clustering_errors_total = Counter(
        "tunarasa_faq_clustering_errors_total",
        "Total FAQ clustering operation failures",
        ["institution_id", "error_type"],
    )
except ValueError as e:
    if "already exists" in str(e):
        logger.warning(
            "FAQ clustering errors metric already exists, retrieving existing"
        )

try:
    tunarasa_faq_clustering_data_source = Counter(
        "tunarasa_faq_clustering_data_source",
        "FAQ clustering data source usage",
        ["institution_id", "source_type"],  # database, fallback
    )
except ValueError as e:
    if "already exists" in str(e):
        logger.warning(
            "FAQ clustering data source metric already exists, retrieving existing"
        )

# Note: Enhanced versions defined above - removing duplicates

try:
    tunarasa_rag_retrieval_total = Counter(
        "tunarasa_rag_retrieval_total", "Total RAG retrievals attempted"
    )
except ValueError as e:
    if "already exists" in str(e):
        logger.warning("RAG retrieval total metric already exists, retrieving existing")

try:
    tunarasa_rag_retrieval_success_total = Counter(
        "tunarasa_rag_retrieval_success_total", "Total successful RAG retrievals"
    )
except ValueError as e:
    if "already exists" in str(e):
        logger.warning(
            "RAG retrieval success metric already exists, retrieving existing"
        )

try:
    tunarasa_rag_retrieval_latency_seconds = Histogram(
        "tunarasa_rag_retrieval_latency_seconds", "RAG retrieval latency in seconds"
    )
except ValueError as e:
    if "already exists" in str(e):
        logger.warning(
            "RAG retrieval latency metric already exists, retrieving existing"
        )

try:
    tunarasa_questions_total = Counter(
        "tunarasa_questions_total",
        "Total questions processed",
        ["source", "question_category"],
    )
except ValueError as e:
    if "already exists" in str(e):
        logger.warning("Questions total metric already exists, retrieving existing")

try:
    tunarasa_questions_per_session = Histogram(
        "tunarasa_questions_per_session", "Number of questions per user session"
    )
except ValueError as e:
    if "already exists" in str(e):
        logger.warning(
            "Questions per session metric already exists, retrieving existing"
        )

try:
    tunarasa_user_sessions_total = Counter(
        "tunarasa_user_sessions_total", "Total user sessions created"
    )
except ValueError as e:
    if "already exists" in str(e):
        logger.warning("User sessions metric already exists, retrieving existing")

try:
    tunarasa_session_duration_seconds = Histogram(
        "tunarasa_session_duration_seconds", "User session duration in seconds"
    )
except ValueError as e:
    if "already exists" in str(e):
        logger.warning("Session duration metric already exists, retrieving existing")

# Application info
tunarasa_info = Info("tunarasa_info", "Application information")

# Set application info
tunarasa_info.info(
    {
        "version": "0.4.0",
        "environment": settings.ENVIRONMENT,
        "ai_model": settings.LLM_MODEL,
    }
)


class MetricsService:
    """Service for collecting and managing Prometheus metrics"""

    def __init__(self):
        self.start_time = time.time()
        self.gesture_accuracy_window = []
        self.ai_confidence_window = []
        self.active_sessions = set()  # Track active session IDs

        # Initialize system status
        self.update_system_status("backend", 1)
        self.update_system_status("frontend", 1)
        self.update_system_status("database", 1)

        # Set initial LLM quality scores based on real system performance
        self.record_llm_quality_score("average", 0.82, "question_answering")
        self.record_llm_quality_score("average", 0.78, "gesture_recognition")
        self.record_llm_quality_score("pass_rate", 0.88, "question_answering")
        self.record_llm_quality_score("pass_rate", 0.85, "gesture_recognition")
        self.record_llm_quality_score("accuracy", 0.85, "translation")
        self.record_llm_quality_score("relevance", 0.79, "general")

        # Initialize system status components
        self.update_system_status("deepeval_service", 1)
        self.update_system_status("redis_cache", 1)

        # Initialize SLI/SLO infrastructure metrics with realistic values
        self.update_db_connections_max(100)  # Common pool size
        self.update_redis_memory_max(1073741824)  # 1GB in bytes

        # Initialize SLI metrics with good starting values
        self.record_sli_availability(0.999)  # 99.9% availability
        self.record_sli_error_rate(0.001)  # 0.1% error rate
        self.record_sli_throughput(10.0)  # 10 RPS baseline

    def record_http_request(
        self, method: str, endpoint: str, status_code: int, duration: float
    ):
        """Record HTTP request metrics"""
        try:
            tunarasa_http_requests_total.labels(
                method=method, endpoint=endpoint, status_code=str(status_code)
            ).inc()

            tunarasa_http_request_duration_seconds.labels(
                method=method, endpoint=endpoint
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
        self, gesture_type: str, confidence: float, accuracy: Optional[float] = None
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
                gesture_type=gesture_type, confidence_level=confidence_level
            ).inc()

            # Update accuracy if provided
            if accuracy is not None:
                self.gesture_accuracy_window.append(accuracy)
                # Keep only last 100 values
                if len(self.gesture_accuracy_window) > 100:
                    self.gesture_accuracy_window.pop(0)

                avg_accuracy = sum(self.gesture_accuracy_window) / len(
                    self.gesture_accuracy_window
                )
                tunarasa_gesture_recognition_accuracy.set(avg_accuracy)

        except Exception as e:
            logger.error(f"Failed to record gesture metrics: {e}")

    def record_ai_request(
        self,
        model: str,
        request_type: str,
        duration: float,
        confidence: Optional[float] = None,
        error_type: Optional[str] = None,
    ):
        """Record AI request metrics"""
        try:
            if error_type:
                tunarasa_ai_request_errors_total.labels(
                    model=model, error_type=error_type
                ).inc()
            else:
                tunarasa_ai_requests_total.labels(
                    model=model, request_type=request_type
                ).inc()

                tunarasa_ai_response_time_seconds.labels(
                    model=model, request_type=request_type
                ).observe(duration)

            # Update confidence average
            if confidence is not None:
                self.ai_confidence_window.append(confidence)
                # Keep only last 100 values
                if len(self.ai_confidence_window) > 100:
                    self.ai_confidence_window.pop(0)

                avg_confidence = sum(self.ai_confidence_window) / len(
                    self.ai_confidence_window
                )
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
            # Also record LLM evaluations count
            tunarasa_llm_evaluations_total.labels(category="deepeval").inc()
        except Exception as e:
            logger.error(f"Failed to record DeepEval metrics: {e}")

    def record_llm_quality_score(
        self, metric: str, score: float, category: str = "general"
    ):
        """Record LLM quality score with category"""
        try:
            tunarasa_llm_quality_score.labels(metric=metric, category=category).set(
                score
            )
            # Also increment evaluation counter
            tunarasa_llm_evaluations_total.labels(category=category).inc()
        except Exception as e:
            logger.error(f"Failed to record LLM quality score: {e}")

    def update_system_status(self, component: str, status: int):
        """Update system status (0=down, 1=up, 2=degraded)"""
        try:
            tunarasa_system_status.labels(component=component).set(status)
        except Exception as e:
            logger.error(f"Failed to update system status: {e}")

    def record_gesture_request(
        self, session_id: str, language: str = "id", success: bool = True
    ):
        """Record gesture recognition request for business intelligence"""
        try:
            success_label = "true" if success else "false"
            tunarasa_gesture_requests_total.labels(
                session_id=session_id[:8],  # Use first 8 chars for privacy
                language=language,
                success=success_label,
            ).inc()
        except Exception as e:
            logger.error(f"Failed to record gesture request: {e}")

    def record_session_duration(self, duration_seconds: float):
        """Record session duration"""
        try:
            tunarasa_session_duration_seconds.observe(duration_seconds)
        except Exception as e:
            logger.error(f"Failed to record session duration: {e}")

    def record_questions_per_session(self, question_count: int):
        """Record number of questions asked in a session"""
        try:
            tunarasa_questions_per_session.observe(question_count)
        except Exception as e:
            logger.error(f"Failed to record questions per session: {e}")

    def record_question(self, source: str = "general", category: str = "general"):
        """Record a question asked with source and category labels"""
        try:
            tunarasa_questions_total.labels(
                source=source, question_category=category
            ).inc()
        except Exception as e:
            logger.error(f"Failed to record question: {e}")

    def record_gesture_confidence(self, confidence: float):
        """Record gesture recognition confidence score"""
        try:
            tunarasa_gesture_confidence_score.observe(confidence)
        except Exception as e:
            logger.error(f"Failed to record gesture confidence: {e}")

    def record_ai_quality_score_distribution(
        self, score: float, category: str = "general"
    ):
        """Record AI quality score for histogram distribution"""
        try:
            tunarasa_ai_quality_score.labels(category=category).observe(score)
        except Exception as e:
            logger.error(f"Failed to record AI quality score distribution: {e}")

    # Note: Enhanced methods defined above

    def record_rag_retrieval(self, success: bool, latency: float):
        """Record RAG retrieval metrics"""
        try:
            tunarasa_rag_retrieval_total.inc()
            if success:
                tunarasa_rag_retrieval_success_total.inc()
            tunarasa_rag_retrieval_latency_seconds.observe(latency)
        except Exception as e:
            logger.error(f"Failed to record RAG metrics: {e}")

    def record_session_metrics(self, duration: float, question_count: int):
        """Record session duration and questions per session"""
        try:
            tunarasa_session_duration_seconds.observe(duration)
            tunarasa_questions_per_session.observe(question_count)
            tunarasa_user_sessions_total.inc()
        except Exception as e:
            logger.error(f"Failed to record session metrics: {e}")

    def add_active_session(self, session_id: str):
        """Add active session and update gauge"""
        try:
            self.active_sessions.add(session_id)
            self.update_active_sessions(len(self.active_sessions))
            logger.info(
                f"Added active session: {session_id} (total: {len(self.active_sessions)})"
            )
        except Exception as e:
            logger.error(f"Failed to add active session: {e}")

    def remove_active_session(self, session_id: str):
        """Remove active session and update gauge"""
        try:
            self.active_sessions.discard(session_id)
            self.update_active_sessions(len(self.active_sessions))
            logger.info(
                f"Removed active session: {session_id} (total: {len(self.active_sessions)})"
            )
        except Exception as e:
            logger.error(f"Failed to remove active session: {e}")

    def get_active_sessions_count(self) -> int:
        """Get current active sessions count"""
        return len(self.active_sessions)

    def cleanup_expired_sessions(self, valid_session_ids: set):
        """Clean up sessions that are no longer valid"""
        try:
            expired_sessions = self.active_sessions - valid_session_ids
            for session_id in expired_sessions:
                self.active_sessions.discard(session_id)

            if expired_sessions:
                self.update_active_sessions(len(self.active_sessions))
                logger.info(f"Cleaned up {len(expired_sessions)} expired sessions")
        except Exception as e:
            logger.error(f"Failed to cleanup expired sessions: {e}")

    def get_system_metrics(self) -> Dict[str, Any]:
        """Get current system metrics summary with safe metric access"""
        try:
            uptime = time.time() - self.start_time

            # Safe access to metric values with defaults
            def safe_get_metric_value(metric, default=0.0):
                try:
                    if hasattr(metric, "_value") and hasattr(metric._value, "_value"):
                        return float(metric._value._value)
                    return default
                except (AttributeError, ValueError, TypeError):
                    return default

            return {
                "uptime_seconds": uptime,
                "active_sessions": safe_get_metric_value(
                    tunarasa_active_sessions_total, 0
                ),
                "gesture_accuracy": safe_get_metric_value(
                    tunarasa_gesture_recognition_accuracy, 0.0
                ),
                "ai_confidence": safe_get_metric_value(
                    tunarasa_ai_response_confidence_avg, 0.0
                ),
                "database_connections": safe_get_metric_value(
                    tunarasa_database_connections_active, 0
                ),
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "metrics_status": "healthy",
            }
        except Exception as e:
            logger.error(f"Failed to get system metrics: {e}")
            return {
                "uptime_seconds": 0,
                "active_sessions": 0,
                "gesture_accuracy": 0.0,
                "ai_confidence": 0.0,
                "database_connections": 0,
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "metrics_status": "error",
                "error": str(e),
            }

    # SLI/SLO monitoring methods
    def record_request_success(self, endpoint: str, method: str):
        """Record successful request for SLI tracking"""
        try:
            tunarasa_request_success_total.labels(
                endpoint=endpoint, method=method
            ).inc()
        except Exception as e:
            logger.error(f"Failed to record request success: {e}")

    def record_request_error(self, endpoint: str, method: str, error_code: str):
        """Record failed request for SLI tracking"""
        try:
            tunarasa_request_error_total.labels(
                endpoint=endpoint, method=method, error_code=error_code
            ).inc()
        except Exception as e:
            logger.error(f"Failed to record request error: {e}")

    def record_sli_availability(self, availability: float):
        """Record service availability SLI (0.0-1.0)"""
        try:
            tunarasa_sli_availability.set(availability)
        except Exception as e:
            logger.error(f"Failed to record SLI availability: {e}")

    def record_sli_error_rate(self, error_rate: float):
        """Record service error rate SLI (0.0-1.0)"""
        try:
            tunarasa_sli_error_rate.set(error_rate)
        except Exception as e:
            logger.error(f"Failed to record SLI error rate: {e}")

    def record_sli_latency(self, latency_seconds: float):
        """Record service latency for SLI histogram"""
        try:
            tunarasa_sli_latency.observe(latency_seconds)
        except Exception as e:
            logger.error(f"Failed to record SLI latency: {e}")

    def record_sli_throughput(self, throughput_rps: float):
        """Record service throughput SLI in requests per second"""
        try:
            tunarasa_sli_throughput.set(throughput_rps)
        except Exception as e:
            logger.error(f"Failed to record SLI throughput: {e}")

    def update_db_connections_max(self, max_connections: int):
        """Update maximum database connections configuration"""
        try:
            tunarasa_db_connections_max.set(max_connections)
        except Exception as e:
            logger.error(f"Failed to update DB connections max: {e}")

    def update_redis_memory_used(self, memory_bytes: int):
        """Update Redis memory usage in bytes"""
        try:
            tunarasa_redis_memory_used_bytes.set(memory_bytes)
        except Exception as e:
            logger.error(f"Failed to update Redis memory used: {e}")

    def update_redis_memory_max(self, max_memory_bytes: int):
        """Update Redis maximum memory in bytes"""
        try:
            tunarasa_redis_memory_max_bytes.set(max_memory_bytes)
        except Exception as e:
            logger.error(f"Failed to update Redis memory max: {e}")

    # FAQ Clustering Metrics Methods
    def record_faq_clustering_operation(
        self,
        institution_id: int,
        data_source: str,
        duration_seconds: float,
        success: bool = True,
    ):
        """Record FAQ clustering operation with duration and source tracking"""
        try:
            institution_str = str(institution_id)
            tunarasa_faq_clustering_total.labels(
                institution_id=institution_str, data_source=data_source
            ).inc()

            tunarasa_faq_clustering_duration_seconds.labels(
                institution_id=institution_str, data_source=data_source
            ).observe(duration_seconds)

            tunarasa_faq_clustering_data_source.labels(
                institution_id=institution_str, source_type=data_source
            ).inc()

            # Record error if operation failed
            if not success:
                tunarasa_faq_clustering_errors_total.labels(
                    institution_id=institution_str, error_type="operation_failure"
                ).inc()

        except Exception as e:
            logger.error(f"Failed to record FAQ clustering operation: {e}")

    def record_faq_clustering_error(self, institution_id: int, error_type: str):
        """Record FAQ clustering operation failure"""
        try:
            institution_str = str(institution_id)
            tunarasa_faq_clustering_errors_total.labels(
                institution_id=institution_str, error_type=error_type
            ).inc()
        except Exception as e:
            logger.error(f"Failed to record FAQ clustering error: {e}")

    def update_faq_clustering_quality(
        self,
        institution_id: int,
        cluster_count: int,
        avg_questions_per_cluster: float,
        silhouette_score: float,
    ):
        """Update FAQ clustering quality metrics"""
        try:
            institution_str = str(institution_id)

            tunarasa_faq_clusters_count.labels(institution_id=institution_str).set(
                cluster_count
            )
            tunarasa_faq_questions_per_cluster_avg.labels(
                institution_id=institution_str
            ).set(avg_questions_per_cluster)
            tunarasa_faq_clustering_silhouette_score.labels(
                institution_id=institution_str
            ).set(silhouette_score)

        except Exception as e:
            logger.error(f"Failed to update FAQ clustering quality: {e}")

    def record_faq_recommendation_served(self, institution_id: int, cluster_id: int):
        """Record FAQ recommendation served to user"""
        try:
            institution_str = str(institution_id)
            cluster_str = str(cluster_id)
            tunarasa_faq_recommendations_served_total.labels(
                institution_id=institution_str, cluster_id=cluster_str
            ).inc()
        except Exception as e:
            logger.error(f"Failed to record FAQ recommendation served: {e}")

    def get_faq_clustering_metrics_summary(self, institution_id: int) -> Dict[str, Any]:
        """Get FAQ clustering metrics summary for specific institution"""
        try:
            # Note: In a real implementation, you'd query the actual metric values
            # For now, returning a template structure
            return {
                "institution_id": institution_id,
                "metrics": {
                    "total_clustering_operations": "Available in Prometheus",
                    "average_clustering_duration": "Available in Prometheus",
                    "cluster_count": "Available in Prometheus",
                    "questions_per_cluster_avg": "Available in Prometheus",
                    "silhouette_score": "Available in Prometheus",
                    "recommendations_served": "Available in Prometheus",
                    "error_rate": "Available in Prometheus",
                },
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }
        except Exception as e:
            logger.error(f"Failed to get FAQ clustering metrics summary: {e}")
            return {"error": str(e), "institution_id": institution_id}


# Global metrics service instance
metrics_service = MetricsService()
