"""
DeepEval integration for LLM monitoring and evaluation
Provides comprehensive quality assessment and performance tracking
"""

import asyncio
import json
import logging
import time
from dataclasses import dataclass
from datetime import datetime, timedelta
from enum import Enum
from typing import Any, Dict, List, Optional

import redis
from app.core.config import settings
from deepeval.metrics import (
    AnswerRelevancyMetric,
    BiasMetric,
    ContextualPrecisionMetric,
    ContextualRecallMetric,
    FaithfulnessMetric,
    HallucinationMetric,
    ToxicityMetric,
)
from deepeval.models import DeepEvalBaseLLM
from deepeval.test_case import LLMTestCase

logger = logging.getLogger(__name__)


class EvaluationCategory(Enum):
    """LLM evaluation categories"""

    RELEVANCY = "relevancy"
    FAITHFULNESS = "faithfulness"
    PRECISION = "precision"
    RECALL = "recall"
    HALLUCINATION = "hallucination"
    BIAS = "bias"
    TOXICITY = "toxicity"
    PERFORMANCE = "performance"
    ACCURACY = "accuracy"


class QualityThreshold(Enum):
    """Quality thresholds for different metrics"""

    EXCELLENT = 0.9
    GOOD = 0.7
    ACCEPTABLE = 0.5
    POOR = 0.3


@dataclass
class EvaluationResult:
    """Evaluation result data structure"""

    category: EvaluationCategory
    score: float
    threshold: float
    passed: bool
    message: str
    details: Dict[str, Any]
    execution_time: float
    timestamp: datetime

    def to_dict(self) -> Dict[str, Any]:
        return {
            "category": self.category.value,
            "score": self.score,
            "threshold": self.threshold,
            "passed": self.passed,
            "message": self.message,
            "details": self.details,
            "execution_time": self.execution_time,
            "timestamp": self.timestamp.isoformat(),
        }


@dataclass
class LLMConversation:
    """LLM conversation data for evaluation"""

    conversation_id: str
    user_question: str
    llm_response: str
    context_documents: List[str]
    response_time: float
    model_used: str
    confidence_score: Optional[float] = None
    session_id: Optional[str] = None
    user_id: Optional[str] = None
    timestamp: datetime = None

    def __post_init__(self):
        if self.timestamp is None:
            self.timestamp = datetime.utcnow()


class CustomDeepEvalLLM(DeepEvalBaseLLM):
    """Custom DeepEval LLM wrapper for ChatGroq"""

    def __init__(self, model_name: str = settings.LLM_MODEL):
        self.model_name = model_name

    def load_model(self):
        """Load the model (ChatGroq is loaded elsewhere)"""
        return self

    def generate(self, prompt: str) -> str:
        """Generate response using ChatGroq"""
        # This is a simplified implementation
        # In practice, you'd use the actual ChatGroq service
        return f"Response to: {prompt[:100]}..."

    async def a_generate(self, prompt: str) -> str:
        """Async generate response"""
        return await asyncio.to_thread(self.generate, prompt)

    def get_model_name(self) -> str:
        """Get model name"""
        return self.model_name


class DeepEvalMonitoringService:
    """Comprehensive LLM monitoring service using DeepEval"""

    def __init__(self):
        self.redis_client = None
        self.model = CustomDeepEvalLLM()
        self.evaluation_history = []
        self.performance_metrics = {}
        self._initialize_redis()
        self._initialize_metrics()

    def _initialize_redis(self):
        """Initialize Redis connection for caching evaluation results"""
        try:
            self.redis_client = redis.from_url(settings.REDIS_URL)
            self.redis_client.ping()
            logger.info("Redis connected for DeepEval monitoring service")
        except Exception as e:
            logger.warning(f"Redis connection failed: {e}")
            self.redis_client = None

    def _initialize_metrics(self):
        """Initialize DeepEval metrics with proper thresholds"""
        try:
            self.metrics = {
                EvaluationCategory.RELEVANCY: AnswerRelevancyMetric(
                    threshold=QualityThreshold.GOOD.value, model=self.model
                ),
                EvaluationCategory.FAITHFULNESS: FaithfulnessMetric(
                    threshold=QualityThreshold.GOOD.value, model=self.model
                ),
                EvaluationCategory.PRECISION: ContextualPrecisionMetric(
                    threshold=QualityThreshold.GOOD.value, model=self.model
                ),
                EvaluationCategory.RECALL: ContextualRecallMetric(
                    threshold=QualityThreshold.GOOD.value, model=self.model
                ),
                EvaluationCategory.HALLUCINATION: HallucinationMetric(
                    threshold=QualityThreshold.ACCEPTABLE.value, model=self.model
                ),
                EvaluationCategory.BIAS: BiasMetric(
                    threshold=QualityThreshold.ACCEPTABLE.value, model=self.model
                ),
                EvaluationCategory.TOXICITY: ToxicityMetric(
                    threshold=QualityThreshold.ACCEPTABLE.value, model=self.model
                ),
            }
            logger.info("DeepEval metrics initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize DeepEval metrics: {e}")
            self.metrics = {}

    async def evaluate_conversation(
        self,
        conversation: LLMConversation,
        categories: Optional[List[EvaluationCategory]] = None,
    ) -> List[EvaluationResult]:
        """Evaluate LLM conversation comprehensively"""

        if not categories:
            categories = list(EvaluationCategory)

        results = []

        # Create test case for DeepEval
        test_case = LLMTestCase(
            input=conversation.user_question,
            actual_output=conversation.llm_response,
            retrieval_context=conversation.context_documents,
        )

        # Run evaluations for each category
        for category in categories:
            if category in self.metrics:
                result = await self._evaluate_metric(category, test_case, conversation)
                if result:
                    results.append(result)

        # Add performance evaluation
        performance_result = await self._evaluate_performance(conversation)
        if performance_result:
            results.append(performance_result)

        # Add accuracy evaluation based on confidence
        accuracy_result = await self._evaluate_accuracy(conversation)
        if accuracy_result:
            results.append(accuracy_result)

        # Cache results
        await self._cache_evaluation_results(conversation.conversation_id, results)

        # Update performance metrics
        await self._update_performance_metrics(results)

        return results

    async def _evaluate_metric(
        self,
        category: EvaluationCategory,
        test_case: LLMTestCase,
        conversation: LLMConversation,
    ) -> Optional[EvaluationResult]:
        """Evaluate a specific metric"""

        try:
            start_time = time.time()
            metric = self.metrics[category]

            # Measure the metric
            await asyncio.to_thread(metric.measure, test_case)

            execution_time = time.time() - start_time

            # Extract results
            score = metric.score if hasattr(metric, "score") else 0.0
            threshold = metric.threshold
            passed = (
                metric.is_successful()
                if hasattr(metric, "is_successful")
                else score >= threshold
            )

            # Generate detailed message
            message = self._generate_metric_message(category, score, threshold, passed)

            # Collect detailed information
            details = {
                "metric_type": category.value,
                "raw_score": score,
                "threshold_used": threshold,
                "test_case_id": conversation.conversation_id,
                "model_used": conversation.model_used,
                "context_length": len(conversation.context_documents),
                "response_length": len(conversation.llm_response.split()),
                "question_length": len(conversation.user_question.split()),
            }

            return EvaluationResult(
                category=category,
                score=score,
                threshold=threshold,
                passed=passed,
                message=message,
                details=details,
                execution_time=execution_time,
                timestamp=datetime.utcnow(),
            )

        except Exception as e:
            logger.error(f"Failed to evaluate {category.value}: {e}")
            return EvaluationResult(
                category=category,
                score=0.0,
                threshold=0.5,
                passed=False,
                message=f"Evaluation failed: {str(e)}",
                details={"error": str(e)},
                execution_time=0.0,
                timestamp=datetime.utcnow(),
            )

    async def _evaluate_performance(
        self, conversation: LLMConversation
    ) -> EvaluationResult:
        """Evaluate performance metrics"""

        # Performance score based on response time and efficiency
        max_acceptable_time = 10.0  # seconds
        time_score = max(0, 1 - (conversation.response_time / max_acceptable_time))

        # Token efficiency (rough estimate)
        response_length = len(conversation.llm_response.split())
        question_length = len(conversation.user_question.split())
        efficiency_ratio = response_length / max(question_length, 1)

        # Ideal ratio is between 2-10 (response 2-10x longer than question)
        efficiency_score = 1.0
        if efficiency_ratio < 2:
            efficiency_score = efficiency_ratio / 2
        elif efficiency_ratio > 10:
            efficiency_score = max(0, 1 - ((efficiency_ratio - 10) / 20))

        # Combined performance score
        performance_score = (time_score * 0.6) + (efficiency_score * 0.4)

        passed = performance_score >= QualityThreshold.GOOD.value

        message = f"Performance: {performance_score:.2f} (Time: {conversation.response_time:.2f}s, Efficiency: {efficiency_ratio:.1f}x)"

        details = {
            "response_time": conversation.response_time,
            "time_score": time_score,
            "efficiency_ratio": efficiency_ratio,
            "efficiency_score": efficiency_score,
            "response_word_count": response_length,
            "question_word_count": question_length,
        }

        return EvaluationResult(
            category=EvaluationCategory.PERFORMANCE,
            score=performance_score,
            threshold=QualityThreshold.GOOD.value,
            passed=passed,
            message=message,
            details=details,
            execution_time=0.01,  # Minimal computation time
            timestamp=datetime.utcnow(),
        )

    async def _evaluate_accuracy(
        self, conversation: LLMConversation
    ) -> Optional[EvaluationResult]:
        """Evaluate accuracy based on confidence score"""

        if conversation.confidence_score is None:
            return None

        confidence = conversation.confidence_score
        threshold = QualityThreshold.GOOD.value
        passed = confidence >= threshold

        # Adjust score based on response quality indicators
        accuracy_score = confidence

        # Penalize very short or very long responses
        response_length = len(conversation.llm_response.split())
        if response_length < 10:
            accuracy_score *= 0.8  # Penalty for too short
        elif response_length > 500:
            accuracy_score *= 0.9  # Slight penalty for too long

        message = f"Accuracy: {accuracy_score:.2f} (Confidence: {confidence:.2f})"

        details = {
            "raw_confidence": confidence,
            "adjusted_score": accuracy_score,
            "response_length": response_length,
            "length_penalty_applied": response_length < 10 or response_length > 500,
        }

        return EvaluationResult(
            category=EvaluationCategory.ACCURACY,
            score=accuracy_score,
            threshold=threshold,
            passed=passed,
            message=message,
            details=details,
            execution_time=0.01,
            timestamp=datetime.utcnow(),
        )

    def _generate_metric_message(
        self, category: EvaluationCategory, score: float, threshold: float, passed: bool
    ) -> str:
        """Generate human-readable message for metric results"""

        status = "PASS" if passed else "FAIL"

        messages = {
            EvaluationCategory.RELEVANCY: f"Answer Relevancy: {score:.2f} [{status}] - Response addresses the question appropriately",
            EvaluationCategory.FAITHFULNESS: f"Faithfulness: {score:.2f} [{status}] - Response stays true to provided context",
            EvaluationCategory.PRECISION: f"Contextual Precision: {score:.2f} [{status}] - Relevant context used effectively",
            EvaluationCategory.RECALL: f"Contextual Recall: {score:.2f} [{status}] - Important context elements included",
            EvaluationCategory.HALLUCINATION: f"Hallucination Check: {score:.2f} [{status}] - Response avoids fabricated information",
            EvaluationCategory.BIAS: f"Bias Assessment: {score:.2f} [{status}] - Response demonstrates fairness and neutrality",
            EvaluationCategory.TOXICITY: f"Toxicity Check: {score:.2f} [{status}] - Response is appropriate and respectful",
        }

        return messages.get(category, f"{category.value}: {score:.2f} [{status}]")

    async def _cache_evaluation_results(
        self, conversation_id: str, results: List[EvaluationResult]
    ):
        """Cache evaluation results in Redis"""

        if not self.redis_client:
            return

        try:
            cache_key = f"deepeval:conversation:{conversation_id}"
            cache_data = {
                "conversation_id": conversation_id,
                "results": [result.to_dict() for result in results],
                "cached_at": datetime.utcnow().isoformat(),
            }

            # Cache for 7 days
            await asyncio.to_thread(
                self.redis_client.setex,
                cache_key,
                7 * 24 * 3600,
                json.dumps(cache_data, default=str),
            )

        except Exception as e:
            logger.error(f"Failed to cache evaluation results: {e}")

    async def _update_performance_metrics(self, results: List[EvaluationResult]):
        """Update aggregated performance metrics"""

        try:
            current_time = datetime.utcnow()

            for result in results:
                category = result.category.value

                if category not in self.performance_metrics:
                    self.performance_metrics[category] = {
                        "scores": [],
                        "pass_rate": 0.0,
                        "average_score": 0.0,
                        "last_updated": current_time,
                        "total_evaluations": 0,
                    }

                metrics = self.performance_metrics[category]
                metrics["scores"].append(result.score)
                metrics["total_evaluations"] += 1

                # Keep only last 100 scores for rolling average
                if len(metrics["scores"]) > 100:
                    metrics["scores"] = metrics["scores"][-100:]

                # Calculate statistics
                scores = metrics["scores"]
                metrics["average_score"] = sum(scores) / len(scores)
                metrics["pass_rate"] = len(
                    [s for s in scores if s >= result.threshold]
                ) / len(scores)
                metrics["last_updated"] = current_time

            # Cache aggregated metrics
            if self.redis_client:
                await asyncio.to_thread(
                    self.redis_client.setex,
                    "deepeval:performance_metrics",
                    3600,  # 1 hour
                    json.dumps(self.performance_metrics, default=str),
                )

        except Exception as e:
            logger.error(f"Failed to update performance metrics: {e}")

    async def get_evaluation_summary(self, time_period: str = "24h") -> Dict[str, Any]:
        """Get evaluation summary for specified time period"""

        try:
            # Calculate time range
            now = datetime.utcnow()
            if time_period == "1h":
                start_time = now - timedelta(hours=1)
            elif time_period == "24h":
                start_time = now - timedelta(days=1)
            elif time_period == "7d":
                start_time = now - timedelta(days=7)
            elif time_period == "30d":
                start_time = now - timedelta(days=30)
            else:
                start_time = now - timedelta(days=1)

            # Get recent evaluations from history
            recent_evaluations = [
                eval_result
                for eval_result in self.evaluation_history
                if eval_result.timestamp >= start_time
            ]

            if not recent_evaluations:
                return {
                    "period": time_period,
                    "total_evaluations": 0,
                    "message": "No evaluations found for this period",
                }

            # Calculate summary statistics
            category_stats = {}
            for category in EvaluationCategory:
                category_results = [
                    r for r in recent_evaluations if r.category == category
                ]
                if category_results:
                    scores = [r.score for r in category_results]
                    category_stats[category.value] = {
                        "count": len(category_results),
                        "average_score": sum(scores) / len(scores),
                        "pass_rate": len([r for r in category_results if r.passed])
                        / len(category_results),
                        "min_score": min(scores),
                        "max_score": max(scores),
                    }

            # Overall statistics
            all_scores = [r.score for r in recent_evaluations]
            overall_pass_rate = len([r for r in recent_evaluations if r.passed]) / len(
                recent_evaluations
            )

            summary = {
                "period": time_period,
                "start_time": start_time.isoformat(),
                "end_time": now.isoformat(),
                "total_evaluations": len(recent_evaluations),
                "overall_average_score": sum(all_scores) / len(all_scores),
                "overall_pass_rate": overall_pass_rate,
                "category_statistics": category_stats,
                "performance_metrics": self.performance_metrics,
                "generated_at": now.isoformat(),
            }

            return summary

        except Exception as e:
            logger.error(f"Failed to generate evaluation summary: {e}")
            return {
                "error": str(e),
                "period": time_period,
                "generated_at": datetime.utcnow().isoformat(),
            }

    async def get_conversation_evaluation(
        self, conversation_id: str
    ) -> Optional[Dict[str, Any]]:
        """Get cached evaluation for specific conversation"""

        if not self.redis_client:
            return None

        try:
            cache_key = f"deepeval:conversation:{conversation_id}"
            cached_data = await asyncio.to_thread(self.redis_client.get, cache_key)

            if cached_data:
                return json.loads(cached_data)

            return None

        except Exception as e:
            logger.error(f"Failed to get conversation evaluation: {e}")
            return None

    async def generate_quality_report(self) -> Dict[str, Any]:
        """Generate comprehensive quality report"""

        try:
            # Get recent performance metrics
            current_metrics = self.performance_metrics

            # Calculate quality scores
            quality_scores = {}
            recommendations = []

            for category, metrics in current_metrics.items():
                avg_score = metrics.get("average_score", 0.0)
                pass_rate = metrics.get("pass_rate", 0.0)
                total_evals = metrics.get("total_evaluations", 0)

                # Quality assessment
                if avg_score >= QualityThreshold.EXCELLENT.value:
                    quality_level = "Excellent"
                elif avg_score >= QualityThreshold.GOOD.value:
                    quality_level = "Good"
                elif avg_score >= QualityThreshold.ACCEPTABLE.value:
                    quality_level = "Acceptable"
                else:
                    quality_level = "Needs Improvement"

                quality_scores[category] = {
                    "average_score": avg_score,
                    "pass_rate": pass_rate,
                    "quality_level": quality_level,
                    "total_evaluations": total_evals,
                }

                # Generate recommendations
                if avg_score < QualityThreshold.GOOD.value:
                    recommendations.append(
                        f"Improve {category}: Current score {avg_score:.2f} is below good threshold ({QualityThreshold.GOOD.value})"
                    )

            # Overall quality assessment
            if quality_scores:
                overall_avg = sum(
                    q["average_score"] for q in quality_scores.values()
                ) / len(quality_scores)
                overall_pass_rate = sum(
                    q["pass_rate"] for q in quality_scores.values()
                ) / len(quality_scores)
            else:
                overall_avg = 0.0
                overall_pass_rate = 0.0

            report = {
                "report_generated_at": datetime.utcnow().isoformat(),
                "overall_quality_score": overall_avg,
                "overall_pass_rate": overall_pass_rate,
                "category_quality_scores": quality_scores,
                "recommendations": recommendations,
                "total_categories_evaluated": len(quality_scores),
                "evaluation_period": "Since service start",
            }

            return report

        except Exception as e:
            logger.error(f"Failed to generate quality report: {e}")
            return {
                "error": str(e),
                "report_generated_at": datetime.utcnow().isoformat(),
            }


# Global monitoring service instance
_deepeval_service = None


def get_deepeval_monitoring_service() -> DeepEvalMonitoringService:
    """Get DeepEval monitoring service singleton"""
    global _deepeval_service
    if _deepeval_service is None:
        _deepeval_service = DeepEvalMonitoringService()
    return _deepeval_service


# Convenience function for easy integration
async def evaluate_llm_response(
    conversation_id: str,
    user_question: str,
    llm_response: str,
    context_documents: List[str],
    response_time: float,
    model_used: str,
    confidence_score: Optional[float] = None,
    session_id: Optional[str] = None,
    user_id: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """Convenient function to evaluate LLM response"""

    monitoring_service = get_deepeval_monitoring_service()

    conversation = LLMConversation(
        conversation_id=conversation_id,
        user_question=user_question,
        llm_response=llm_response,
        context_documents=context_documents,
        response_time=response_time,
        model_used=model_used,
        confidence_score=confidence_score,
        session_id=session_id,
        user_id=user_id,
    )

    results = await monitoring_service.evaluate_conversation(conversation)
    return [result.to_dict() for result in results]
