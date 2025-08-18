"""
Dummy Prometheus metrics endpoint for Grafana testing
"""

import random
import time
from datetime import datetime, timezone

from fastapi import APIRouter
from fastapi.responses import Response

router = APIRouter()


@router.get("/metrics")
def get_metrics():
    """
    Generate comprehensive Prometheus metrics for all Tunarasa Grafana dashboards
    """
    current_time = int(time.time())

    # Generate dynamic values for more  data
    cpu_usage = random.uniform(15, 85)
    memory_usage = random.uniform(20, 75)
    disk_usage = random.uniform(10, 60)

    # LLM quality scores
    helpfulness_score = random.uniform(0.75, 0.95)
    accuracy_score = random.uniform(0.80, 0.98)
    relevance_score = random.uniform(0.70, 0.92)

    # Request metrics
    chat_requests = random.randint(80, 200)
    gesture_requests = random.randint(40, 120)
    summary_requests = random.randint(10, 50)

    # Error rates (keep low for SLA)
    error_rate_chat = random.uniform(0.001, 0.015)
    error_rate_gesture = random.uniform(0.002, 0.020)
    error_rate_summary = random.uniform(0.001, 0.010)

    # Business metrics
    daily_users = random.randint(150, 500)
    monthly_users = random.randint(2000, 8000)
    session_duration = random.uniform(120, 600)  # seconds

    # FAQ Clustering metrics
    cluster_accuracy = random.uniform(0.85, 0.95)
    vectordb_latency = random.uniform(0.05, 0.25)  # seconds

    # SLI/SLO metrics
    availability = random.uniform(0.995, 0.999)
    response_time_p95 = random.uniform(0.1, 0.8)  # seconds
    response_time_p99 = random.uniform(0.2, 1.5)  # seconds

    metrics = f"""# HELP tunarasa_http_requests_total Total HTTP requests by endpoint
# TYPE tunarasa_http_requests_total counter
tunarasa_http_requests_total{{endpoint="/api/v1/chat",method="POST",status_code="200"}} {chat_requests}
tunarasa_http_requests_total{{endpoint="/api/v1/gesture",method="POST",status_code="200"}} {gesture_requests}
tunarasa_http_requests_total{{endpoint="/api/v1/summary/generate",method="POST",status_code="200"}} {summary_requests}
tunarasa_http_requests_total{{endpoint="/api/v1/chat",method="POST",status_code="500"}} {int(chat_requests * error_rate_chat)}
tunarasa_http_requests_total{{endpoint="/api/v1/gesture",method="POST",status_code="500"}} {int(gesture_requests * error_rate_gesture)}
tunarasa_http_requests_total{{endpoint="/api/v1/summary/generate",method="POST",status_code="500"}} {int(summary_requests * error_rate_summary)}

# HELP tunarasa_http_request_duration_seconds HTTP request duration histogram
# TYPE tunarasa_http_request_duration_seconds histogram
tunarasa_http_request_duration_seconds_bucket{{endpoint="/api/v1/chat",le="0.1"}} {int(chat_requests * 0.2)}
tunarasa_http_request_duration_seconds_bucket{{endpoint="/api/v1/chat",le="0.25"}} {int(chat_requests * 0.5)}
tunarasa_http_request_duration_seconds_bucket{{endpoint="/api/v1/chat",le="0.5"}} {int(chat_requests * 0.75)}
tunarasa_http_request_duration_seconds_bucket{{endpoint="/api/v1/chat",le="1.0"}} {int(chat_requests * 0.90)}
tunarasa_http_request_duration_seconds_bucket{{endpoint="/api/v1/chat",le="2.5"}} {int(chat_requests * 0.95)}
tunarasa_http_request_duration_seconds_bucket{{endpoint="/api/v1/chat",le="5.0"}} {int(chat_requests * 0.98)}
tunarasa_http_request_duration_seconds_bucket{{endpoint="/api/v1/chat",le="10.0"}} {chat_requests}
tunarasa_http_request_duration_seconds_bucket{{endpoint="/api/v1/chat",le="+Inf"}} {chat_requests}

# HELP tunarasa_llm_quality_score LLM response quality metrics from DeepEval
# TYPE tunarasa_llm_quality_score gauge
tunarasa_llm_quality_score{{metric="average",category="helpfulness"}} {helpfulness_score:.3f}
tunarasa_llm_quality_score{{metric="average",category="accuracy"}} {accuracy_score:.3f}
tunarasa_llm_quality_score{{metric="average",category="relevance"}} {relevance_score:.3f}
tunarasa_llm_quality_score{{metric="p95",category="helpfulness"}} {helpfulness_score * 1.05:.3f}
tunarasa_llm_quality_score{{metric="p95",category="accuracy"}} {accuracy_score * 1.02:.3f}
tunarasa_llm_quality_score{{metric="p95",category="relevance"}} {relevance_score * 1.08:.3f}

# HELP tunarasa_gesture_recognitions_total Total gesture recognitions by type
# TYPE tunarasa_gesture_recognitions_total counter
tunarasa_gesture_recognitions_total{{gesture_type="peace"}} {random.randint(20, 60)}
tunarasa_gesture_recognitions_total{{gesture_type="thumbs_up"}} {random.randint(15, 45)}
tunarasa_gesture_recognitions_total{{gesture_type="ok"}} {random.randint(10, 35)}
tunarasa_gesture_recognitions_total{{gesture_type="pointing"}} {random.randint(25, 55)}
tunarasa_gesture_recognitions_total{{gesture_type="wave"}} {random.randint(18, 40)}

# HELP tunarasa_active_sessions_total Current active user sessions
# TYPE tunarasa_active_sessions_total gauge
tunarasa_active_sessions_total {random.randint(8, 25)}

# HELP up Service health status
# TYPE up gauge
up{{job="tunarasa-backend"}} 1
up{{job="tunarasa-frontend"}} 1
up{{job="tunarasa-vectordb"}} 1
up{{job="prometheus"}} 1
up{{job="grafana"}} 1

# HELP node_cpu_seconds_total CPU time in seconds
# TYPE node_cpu_seconds_total counter
node_cpu_seconds_total{{mode="idle"}} {current_time * (100 - cpu_usage) / 100}
node_cpu_seconds_total{{mode="user"}} {current_time * cpu_usage * 0.6 / 100}
node_cpu_seconds_total{{mode="system"}} {current_time * cpu_usage * 0.4 / 100}

# HELP node_memory_MemTotal_bytes Total memory in bytes
# TYPE node_memory_MemTotal_bytes gauge
node_memory_MemTotal_bytes 8589934592

# HELP node_memory_MemAvailable_bytes Available memory in bytes
# TYPE node_memory_MemAvailable_bytes gauge
node_memory_MemAvailable_bytes {int(8589934592 * (100 - memory_usage) / 100)}

# HELP node_filesystem_size_bytes Filesystem size in bytes
# TYPE node_filesystem_size_bytes gauge
node_filesystem_size_bytes{{mountpoint="/"}} 107374182400

# HELP node_filesystem_avail_bytes Available filesystem space in bytes
# TYPE node_filesystem_avail_bytes gauge
node_filesystem_avail_bytes{{mountpoint="/"}} {int(107374182400 * (100 - disk_usage) / 100)}

# HELP tunarasa_user_sessions_total User sessions by type and method
# TYPE tunarasa_user_sessions_total counter
tunarasa_user_sessions_total{{session_type="new",input_method="gesture"}} {random.randint(30, 80)}
tunarasa_user_sessions_total{{session_type="new",input_method="text"}} {random.randint(20, 60)}
tunarasa_user_sessions_total{{session_type="returning",input_method="gesture"}} {random.randint(40, 100)}
tunarasa_user_sessions_total{{session_type="returning",input_method="text"}} {random.randint(25, 70)}

# HELP tunarasa_business_metrics Business intelligence metrics
# TYPE tunarasa_business_metrics gauge
tunarasa_business_metrics{{metric="daily_active_users"}} {daily_users}
tunarasa_business_metrics{{metric="monthly_active_users"}} {monthly_users}
tunarasa_business_metrics{{metric="avg_session_duration_seconds"}} {session_duration:.1f}
tunarasa_business_metrics{{metric="conversion_rate"}} {random.uniform(0.15, 0.35):.3f}
tunarasa_business_metrics{{metric="user_satisfaction_score"}} {random.uniform(4.2, 4.8):.2f}
tunarasa_business_metrics{{metric="feature_adoption_rate"}} {random.uniform(0.60, 0.85):.3f}

# HELP tunarasa_revenue_metrics Revenue and business metrics
# TYPE tunarasa_revenue_metrics gauge
tunarasa_revenue_metrics{{metric="daily_revenue_idr"}} {random.randint(150000, 500000)}
tunarasa_revenue_metrics{{metric="monthly_revenue_idr"}} {random.randint(3000000, 12000000)}
tunarasa_revenue_metrics{{metric="average_order_value_idr"}} {random.randint(25000, 75000)}

# HELP tunarasa_faq_clustering_metrics FAQ clustering and RAG metrics
# TYPE tunarasa_faq_clustering_metrics gauge
tunarasa_faq_clustering_metrics{{metric="cluster_accuracy"}} {cluster_accuracy:.3f}
tunarasa_faq_clustering_metrics{{metric="vectordb_query_latency_seconds"}} {vectordb_latency:.3f}
tunarasa_faq_clustering_metrics{{metric="embedding_similarity_score"}} {random.uniform(0.75, 0.95):.3f}
tunarasa_faq_clustering_metrics{{metric="retrieval_success_rate"}} {random.uniform(0.85, 0.98):.3f}

# HELP tunarasa_data_source_usage Data source usage metrics
# TYPE tunarasa_data_source_usage counter
tunarasa_data_source_usage{{source="pinecone",operation="query"}} {random.randint(80, 200)}
tunarasa_data_source_usage{{source="pinecone",operation="upsert"}} {random.randint(10, 30)}
tunarasa_data_source_usage{{source="supabase",operation="read"}} {random.randint(150, 400)}
tunarasa_data_source_usage{{source="supabase",operation="write"}} {random.randint(20, 80)}
tunarasa_data_source_usage{{source="groq_llm",operation="completion"}} {random.randint(60, 180)}

# HELP tunarasa_sli_metrics Service Level Indicator metrics
# TYPE tunarasa_sli_metrics gauge
tunarasa_sli_metrics{{metric="availability"}} {availability:.4f}
tunarasa_sli_metrics{{metric="response_time_p50_seconds"}} {response_time_p95 * 0.6:.3f}
tunarasa_sli_metrics{{metric="response_time_p95_seconds"}} {response_time_p95:.3f}
tunarasa_sli_metrics{{metric="response_time_p99_seconds"}} {response_time_p99:.3f}
tunarasa_sli_metrics{{metric="error_rate"}} {random.uniform(0.001, 0.015):.4f}
tunarasa_sli_metrics{{metric="throughput_rps"}} {random.uniform(10, 50):.1f}

# HELP tunarasa_slo_compliance SLO compliance metrics
# TYPE tunarasa_slo_compliance gauge
tunarasa_slo_compliance{{slo="availability_99_9"}} {1 if availability >= 0.999 else 0}
tunarasa_slo_compliance{{slo="response_time_p95_under_1s"}} {1 if response_time_p95 <= 1.0 else 0}
tunarasa_slo_compliance{{slo="error_rate_under_1_percent"}} {1 if random.uniform(0.001, 0.015) <= 0.01 else 0}

# HELP tunarasa_ai_request_duration_seconds AI service request duration
# TYPE tunarasa_ai_request_duration_seconds histogram
tunarasa_ai_request_duration_seconds_bucket{{model="llama3-70b",le="0.5"}} {random.randint(20, 40)}
tunarasa_ai_request_duration_seconds_bucket{{model="llama3-70b",le="1.0"}} {random.randint(40, 80)}
tunarasa_ai_request_duration_seconds_bucket{{model="llama3-70b",le="2.0"}} {random.randint(60, 120)}
tunarasa_ai_request_duration_seconds_bucket{{model="llama3-70b",le="5.0"}} {random.randint(80, 150)}
tunarasa_ai_request_duration_seconds_bucket{{model="llama3-70b",le="+Inf"}} {random.randint(85, 160)}

# HELP tunarasa_clustering_errors_total Clustering operation errors
# TYPE tunarasa_clustering_errors_total counter
tunarasa_clustering_errors_total{{error_type="embedding_failure"}} {random.randint(0, 5)}
tunarasa_clustering_errors_total{{error_type="vectordb_timeout"}} {random.randint(0, 3)}
tunarasa_clustering_errors_total{{error_type="similarity_threshold"}} {random.randint(1, 8)}

# HELP tunarasa_feature_usage Feature usage tracking
# TYPE tunarasa_feature_usage counter
tunarasa_feature_usage{{feature="gesture_recognition"}} {random.randint(100, 300)}
tunarasa_feature_usage{{feature="text_chat"}} {random.randint(80, 250)}
tunarasa_feature_usage{{feature="summary_generation"}} {random.randint(20, 60)}
tunarasa_feature_usage{{feature="pdf_download"}} {random.randint(10, 40)}
tunarasa_feature_usage{{feature="qr_code_generation"}} {random.randint(5, 25)}

# HELP tunarasa_admin_metrics Admin dashboard metrics
# TYPE tunarasa_admin_metrics gauge
tunarasa_admin_metrics{{metric="pending_validations"}} {random.randint(0, 15)}
tunarasa_admin_metrics{{metric="processed_validations_today"}} {random.randint(20, 80)}
tunarasa_admin_metrics{{metric="total_conversations"}} {random.randint(1000, 5000)}
tunarasa_admin_metrics{{metric="total_users"}} {random.randint(500, 2000)}
"""

    return Response(content=metrics, media_type="text/plain")


@router.get("/health")
def health_check():
    """Simple health check endpoint"""
    return {
        "status": "healthy",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "metrics_endpoint": "/api/v1/metrics",
    }
