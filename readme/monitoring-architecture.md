# Monitoring and Observability Architecture

## Overview
Comprehensive monitoring stack with Prometheus, Grafana, and DeepEval for real-time system health, performance metrics, and AI model evaluation.

## Architecture Components

```
┌─────────────────────────────────────────────────────────────────┐
│                    MONITORING ECOSYSTEM                         │
├─────────────────────────────────────────────────────────────────┤
│  Application Layer                                              │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │   Next.js App   │  │  FastAPI Backend│  │   MediaPipe     │  │
│  │                 │  │                 │  │   TensorFlow.js │  │
│  │ • Client Metrics│  │ • API Metrics   │  │ • ML Metrics    │  │
│  │ • User Events   │  │ • Response Time │  │ • Accuracy      │  │
│  │ • Errors        │  │ • LLM Calls     │  │ • Performance   │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
│           │                      │                      │       │
│           └──────────────────────┼──────────────────────┘       │
│                                  │                              │
├─────────────────────────────────────────────────────────────────┤
│  Metrics Collection Layer                                       │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │   Prometheus    │  │    DeepEval     │  │   Custom        │  │
│  │                 │  │                 │  │   Collectors    │  │
│  │ • Time Series   │  │ • LLM Quality   │  │ • Business      │  │
│  │ • Scraping      │  │ • A/B Testing   │  │   Metrics       │  │
│  │ • Alerting      │  │ • Performance   │  │ • User Events   │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
│           │                      │                      │       │
│           └──────────────────────┼──────────────────────┘       │
│                                  │                              │
├─────────────────────────────────────────────────────────────────┤
│  Storage & Processing Layer                                     │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │   TimescaleDB   │  │    ClickHouse   │  │   PostgreSQL    │  │
│  │   (Metrics)     │  │    (Events)     │  │   (Metadata)    │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
├─────────────────────────────────────────────────────────────────┤
│  Visualization & Alerting Layer                                 │
│                       ┌─────────────────┐                       │
│                       │    Grafana      │                       │
│                       │                 │                       │
│                       │ • Dashboards    │                       │
│                       │ • Analytics     │                       │
│                       │ • Reporting     │                       │
│                       │ • Alerts        │                       │
│                       └─────────────────┘                       │
└─────────────────────────────────────────────────────────────────┘
```

## 1. Metrics Collection Framework

### Application Metrics (Next.js)
```typescript
// src/lib/monitoring/client-metrics.ts
export class ClientMetrics {
  private static instance: ClientMetrics
  private metricsEndpoint = '/api/metrics/client'

  static getInstance(): ClientMetrics {
    if (!this.instance) {
      this.instance = new ClientMetrics()
    }
    return this.instance
  }

  // Gesture Recognition Metrics
  async recordGestureMetrics(data: {
    sessionId: string
    confidence: number
    processingTime: number
    landmarks: number
    success: boolean
    errorType?: string
  }): Promise<void> {
    await this.sendMetric('gesture_recognition', {
      ...data,
      timestamp: Date.now()
    })
  }

  // User Interaction Metrics
  async recordUserInteraction(data: {
    sessionId: string
    action: string
    component: string
    duration?: number
    metadata?: Record<string, any>
  }): Promise<void> {
    await this.sendMetric('user_interaction', {
      ...data,
      timestamp: Date.now()
    })
  }

  // Performance Metrics
  async recordPerformanceMetrics(): Promise<void> {
    if (typeof window !== 'undefined' && 'performance' in window) {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
      const paint = performance.getEntriesByType('paint')

      await this.sendMetric('performance', {
        pageLoadTime: navigation.loadEventEnd - navigation.fetchStart,
        domContentLoaded: navigation.domContentLoadedEventEnd - navigation.fetchStart,
        firstPaint: paint.find(p => p.name === 'first-paint')?.startTime || 0,
        firstContentfulPaint: paint.find(p => p.name === 'first-contentful-paint')?.startTime || 0,
        memoryUsage: (performance as any).memory?.usedJSHeapSize || 0,
        timestamp: Date.now()
      })
    }
  }

  // Error Tracking
  async recordError(error: {
    message: string
    stack?: string
    component: string
    sessionId?: string
    userId?: string
    severity: 'low' | 'medium' | 'high' | 'critical'
  }): Promise<void> {
    await this.sendMetric('error', {
      ...error,
      timestamp: Date.now(),
      userAgent: navigator.userAgent,
      url: window.location.href
    })
  }

  private async sendMetric(type: string, data: any): Promise<void> {
    try {
      await fetch(this.metricsEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, data })
      })
    } catch (error) {
      console.warn('Failed to send metrics:', error)
    }
  }
}
```

### API Metrics (FastAPI)
```python
# backend/monitoring/metrics.py
from prometheus_client import Counter, Histogram, Gauge, start_http_server
import time
from functools import wraps

# Define metrics
REQUEST_COUNT = Counter(
    'tunarasa_http_requests_total',
    'Total HTTP requests',
    ['method', 'endpoint', 'status_code', 'user_type']
)

REQUEST_DURATION = Histogram(
    'tunarasa_http_request_duration_seconds',
    'HTTP request duration',
    ['method', 'endpoint', 'user_type']
)

GESTURE_RECOGNITION_ACCURACY = Gauge(
    'tunarasa_gesture_recognition_accuracy',
    'Current gesture recognition accuracy',
    ['model_version']
)

LLM_RESPONSE_TIME = Histogram(
    'tunarasa_llm_response_time_seconds',
    'LLM response time',
    ['model_name', 'prompt_type']
)

LLM_TOKEN_USAGE = Counter(
    'tunarasa_llm_tokens_used_total',
    'Total LLM tokens used',
    ['model_name', 'token_type']
)

ACTIVE_SESSIONS = Gauge(
    'tunarasa_active_sessions_total',
    'Number of active user sessions'
)

def metrics_middleware(app):
    @app.middleware("http")
    async def add_metrics(request, call_next):
        start_time = time.time()

        # Process request
        response = await call_next(request)

        # Record metrics
        duration = time.time() - start_time
        user_type = "admin" if "/admin/" in str(request.url) else "user"

        REQUEST_COUNT.labels(
            method=request.method,
            endpoint=request.url.path,
            status_code=response.status_code,
            user_type=user_type
        ).inc()

        REQUEST_DURATION.labels(
            method=request.method,
            endpoint=request.url.path,
            user_type=user_type
        ).observe(duration)

        return response

    return app

def track_llm_metrics(model_name: str, prompt_type: str):
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            start_time = time.time()

            try:
                result = await func(*args, **kwargs)

                # Record response time
                duration = time.time() - start_time
                LLM_RESPONSE_TIME.labels(
                    model_name=model_name,
                    prompt_type=prompt_type
                ).observe(duration)

                # Record token usage if available
                if hasattr(result, 'token_usage'):
                    LLM_TOKEN_USAGE.labels(
                        model_name=model_name,
                        token_type='input'
                    ).inc(result.token_usage.input_tokens)

                    LLM_TOKEN_USAGE.labels(
                        model_name=model_name,
                        token_type='output'
                    ).inc(result.token_usage.output_tokens)

                return result

            except Exception as e:
                # Record error metrics
                duration = time.time() - start_time
                LLM_RESPONSE_TIME.labels(
                    model_name=model_name,
                    prompt_type=f"{prompt_type}_error"
                ).observe(duration)
                raise

        return wrapper
    return decorator
```

## 2. DeepEval Integration

### LLM Quality Evaluation
```python
# backend/evaluation/deepeval_integration.py
from deepeval import evaluate
from deepeval.metrics import AnswerRelevancyMetric, FaithfulnessMetric, ContextualRecallMetric
from deepeval.test_case import LLMTestCase
import asyncio
from typing import List, Dict

class TunarasaEvaluator:
    def __init__(self):
        self.metrics = [
            AnswerRelevancyMetric(threshold=0.7),
            FaithfulnessMetric(threshold=0.8),
            ContextualRecallMetric(threshold=0.6)
        ]

    async def evaluate_response(
        self,
        qna_log_id: str,
        question: str,
        answer: str,
        context: str,
        expected_answer: str = None
    ) -> Dict[str, float]:
        """Evaluate single LLM response quality"""

        test_case = LLMTestCase(
            input=question,
            actual_output=answer,
            context=[context],
            expected_output=expected_answer
        )

        results = {}
        for metric in self.metrics:
            try:
                metric.measure(test_case)
                results[metric.__class__.__name__] = metric.score
            except Exception as e:
                print(f"Evaluation error for {metric.__class__.__name__}: {e}")
                results[metric.__class__.__name__] = 0.0

        # Store results in database
        await self.store_evaluation_results(qna_log_id, results)

        return results

    async def batch_evaluate(
        self,
        test_cases: List[Dict]
    ) -> Dict[str, List[float]]:
        """Batch evaluate multiple responses"""

        deepeval_test_cases = []
        for case in test_cases:
            deepeval_test_cases.append(
                LLMTestCase(
                    input=case['question'],
                    actual_output=case['answer'],
                    context=[case['context']],
                    expected_output=case.get('expected_answer')
                )
            )

        # Run evaluation
        results = evaluate(deepeval_test_cases, self.metrics)

        # Process and store results
        evaluation_summary = {}
        for metric in self.metrics:
            metric_name = metric.__class__.__name__
            evaluation_summary[metric_name] = [
                result.metrics_data[metric_name].score
                for result in results
            ]

        return evaluation_summary

    async def store_evaluation_results(
        self,
        qna_log_id: str,
        results: Dict[str, float]
    ):
        """Store evaluation results in performance metrics table"""

        for metric_name, score in results.items():
            await db.insert(performance_metrics).values({
                'metric_type': f'llm_quality_{metric_name.lower()}',
                'metric_category': 'quality',
                'value': score,
                'unit': 'score',
                'qna_log_id': qna_log_id,
                'time_window': 'real_time',
                'additional_data': {'metric_details': metric_name}
            })
```

### A/B Testing Framework
```python
# backend/evaluation/ab_testing.py
class ABTestingFramework:
    def __init__(self):
        self.test_configurations = {}

    async def create_experiment(
        self,
        experiment_name: str,
        control_config: Dict,
        treatment_config: Dict,
        traffic_split: float = 0.5,
        success_metrics: List[str] = None
    ):
        """Create new A/B test experiment"""

        experiment = {
            'name': experiment_name,
            'status': 'active',
            'control': control_config,
            'treatment': treatment_config,
            'traffic_split': traffic_split,
            'success_metrics': success_metrics or ['answer_relevancy', 'user_satisfaction'],
            'start_date': datetime.utcnow(),
            'participants': {'control': 0, 'treatment': 0},
            'results': {'control': [], 'treatment': []}
        }

        self.test_configurations[experiment_name] = experiment
        return experiment

    async def assign_variant(
        self,
        experiment_name: str,
        user_session_id: str
    ) -> str:
        """Assign user to control or treatment group"""

        if experiment_name not in self.test_configurations:
            return 'control'

        experiment = self.test_configurations[experiment_name]

        # Use consistent hashing for session assignment
        hash_value = hash(user_session_id) % 100
        variant = 'treatment' if hash_value < (experiment['traffic_split'] * 100) else 'control'

        experiment['participants'][variant] += 1

        return variant

    async def record_experiment_result(
        self,
        experiment_name: str,
        variant: str,
        session_id: str,
        metrics: Dict[str, float]
    ):
        """Record experiment results"""

        if experiment_name not in self.test_configurations:
            return

        experiment = self.test_configurations[experiment_name]
        experiment['results'][variant].append({
            'session_id': session_id,
            'metrics': metrics,
            'timestamp': datetime.utcnow()
        })

        # Store in database for analysis
        await self.store_experiment_data(experiment_name, variant, session_id, metrics)
```

## 3. Grafana Dashboard Configuration

### Main System Dashboard
```yaml
# monitoring/grafana/dashboards/tunarasa-system.json
{
  "dashboard": {
    "title": "Tunarasa System Overview",
    "panels": [
      {
        "title": "Request Rate",
        "type": "stat",
        "targets": [
          {
            "expr": "rate(tunarasa_http_requests_total[5m])",
            "legendFormat": "{{method}} {{endpoint}}"
          }
        ]
      },
      {
        "title": "Response Time Distribution",
        "type": "histogram",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, rate(tunarasa_http_request_duration_seconds_bucket[5m]))",
            "legendFormat": "95th percentile"
          },
          {
            "expr": "histogram_quantile(0.50, rate(tunarasa_http_request_duration_seconds_bucket[5m]))",
            "legendFormat": "50th percentile"
          }
        ]
      },
      {
        "title": "Active Sessions",
        "type": "stat",
        "targets": [
          {
            "expr": "tunarasa_active_sessions_total",
            "legendFormat": "Active Sessions"
          }
        ]
      },
      {
        "title": "Gesture Recognition Accuracy",
        "type": "stat",
        "targets": [
          {
            "expr": "tunarasa_gesture_recognition_accuracy",
            "legendFormat": "Accuracy"
          }
        ]
      }
    ]
  }
}
```

### LLM Performance Dashboard
```yaml
# monitoring/grafana/dashboards/tunarasa-llm.json
{
  "dashboard": {
    "title": "Tunarasa LLM Performance",
    "panels": [
      {
        "title": "LLM Response Times",
        "type": "timeseries",
        "targets": [
          {
            "expr": "rate(tunarasa_llm_response_time_seconds_sum[5m]) / rate(tunarasa_llm_response_time_seconds_count[5m])",
            "legendFormat": "Average Response Time"
          }
        ]
      },
      {
        "title": "Token Usage Over Time",
        "type": "timeseries",
        "targets": [
          {
            "expr": "rate(tunarasa_llm_tokens_used_total[5m])",
            "legendFormat": "{{token_type}} tokens/sec"
          }
        ]
      },
      {
        "title": "Quality Metrics",
        "type": "timeseries",
        "targets": [
          {
            "expr": "avg_over_time(tunarasa_llm_quality_answer_relevancy[1h])",
            "legendFormat": "Answer Relevancy"
          },
          {
            "expr": "avg_over_time(tunarasa_llm_quality_faithfulness[1h])",
            "legendFormat": "Faithfulness"
          }
        ]
      }
    ]
  }
}
```

## 4. Alerting Configuration

### Prometheus Alert Rules
```yaml
# monitoring/prometheus/alerts.yml
groups:
  - name: tunarasa_system_alerts
    rules:
      - alert: HighResponseTime
        expr: histogram_quantile(0.95, rate(tunarasa_http_request_duration_seconds_bucket[5m])) > 3
        for: 2m
        labels:
          severity: warning
        annotations:
          summary: "High response time detected"
          description: "95th percentile response time is {{ $value }}s"

      - alert: LowGestureAccuracy
        expr: tunarasa_gesture_recognition_accuracy < 0.8
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "Gesture recognition accuracy below threshold"
          description: "Current accuracy is {{ $value }}"

      - alert: LLMResponseTimeHigh
        expr: rate(tunarasa_llm_response_time_seconds_sum[5m]) / rate(tunarasa_llm_response_time_seconds_count[5m]) > 5
        for: 3m
        labels:
          severity: warning
        annotations:
          summary: "LLM response time is high"
          description: "Average response time is {{ $value }}s"

      - alert: ErrorRateHigh
        expr: rate(tunarasa_http_requests_total{status_code=~"5.."}[5m]) / rate(tunarasa_http_requests_total[5m]) > 0.05
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "High error rate detected"
          description: "Error rate is {{ $value | humanizePercentage }}"

  - name: tunarasa_quality_alerts
    rules:
      - alert: LLMQualityDegraded
        expr: avg_over_time(tunarasa_llm_quality_answer_relevancy[1h]) < 0.7
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "LLM answer quality has degraded"
          description: "Average answer relevancy is {{ $value }}"

      - alert: UserSatisfactionLow
        expr: avg_over_time(tunarasa_user_satisfaction_score[6h]) < 3.5
        for: 30m
        labels:
          severity: warning
        annotations:
          summary: "User satisfaction score is low"
          description: "Current satisfaction score is {{ $value }}"
```

## 5. Custom Business Metrics

### User Experience Metrics
```typescript
// src/lib/monitoring/business-metrics.ts
export class BusinessMetrics {
  // User Journey Completion Rate
  async trackUserJourney(sessionId: string, journey: {
    started: boolean
    gestureRecognized: boolean
    questionProcessed: boolean
    answerReceived: boolean
    userSatisfied: boolean
  }): Promise<void> {
    const completionRate = Object.values(journey).filter(Boolean).length / Object.keys(journey).length

    await this.recordMetric('user_journey_completion', {
      sessionId,
      completionRate,
      step: this.getLastCompletedStep(journey),
      timestamp: Date.now()
    })
  }

  // Question Category Analysis
  async analyzeQuestionCategory(question: string, category: string): Promise<void> {
    await this.recordMetric('question_category', {
      category,
      questionLength: question.length,
      timestamp: Date.now()
    })
  }

  // User Feedback Analysis
  async recordUserFeedback(feedback: {
    sessionId: string
    qnaLogId: string
    rating: number
    feedbackText?: string
    helpful: boolean
  }): Promise<void> {
    await this.recordMetric('user_feedback', {
      ...feedback,
      timestamp: Date.now()
    })
  }
}
```

This monitoring architecture provides:
- Real-time performance tracking across all system components
- AI model quality evaluation and continuous improvement
- Business intelligence and user experience metrics
- Comprehensive alerting for proactive issue resolution
- A/B testing capabilities for optimization
- Scalable data storage and visualization platform
