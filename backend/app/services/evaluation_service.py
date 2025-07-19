"""
DeepEval integration service for LLM quality assessment
"""

import logging
from typing import Dict, List, Any, Optional
from datetime import datetime
import asyncio
import json

try:
    from deepeval import evaluate
    from deepeval.metrics import AnswerRelevancyMetric, FaithfulnessMetric, ContextualPrecisionMetric
    from deepeval.test_case import LLMTestCase
    DEEPEVAL_AVAILABLE = True
except ImportError:
    DEEPEVAL_AVAILABLE = False
    logging.warning("DeepEval not available. Install with: pip install deepeval")

from app.core.config import settings

logger = logging.getLogger(__name__)


class EvaluationService:
    """Service for evaluating LLM responses using DeepEval"""
    
    def __init__(self):
        self.metrics_enabled = DEEPEVAL_AVAILABLE and settings.ENVIRONMENT != "production"
        self.evaluation_cache = {}
        
        if self.metrics_enabled:
            # Initialize evaluation metrics
            self.answer_relevancy = AnswerRelevancyMetric(threshold=0.7)
            self.faithfulness = FaithfulnessMetric(threshold=0.7)
            self.contextual_precision = ContextualPrecisionMetric(threshold=0.7)
        
        logger.info(f"Evaluation service initialized. Metrics enabled: {self.metrics_enabled}")
    
    async def evaluate_qa_response(
        self,
        question: str,
        answer: str,
        context: List[str],
        expected_answer: Optional[str] = None,
        conversation_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Evaluate Q&A response quality using multiple metrics
        
        Args:
            question: User question
            answer: AI-generated answer
            context: Retrieved context documents
            expected_answer: Expected/ideal answer (optional)
            conversation_id: Conversation ID for tracking
            
        Returns:
            Evaluation results with scores and recommendations
        """
        try:
            if not self.metrics_enabled:
                return self._create_mock_evaluation(question, answer)
            
            # Create test case
            test_case = LLMTestCase(
                input=question,
                actual_output=answer,
                expected_output=expected_answer,
                retrieval_context=context
            )
            
            # Run evaluations
            evaluation_results = {}
            
            # Answer Relevancy
            try:
                await asyncio.get_event_loop().run_in_executor(
                    None, self.answer_relevancy.measure, test_case
                )
                evaluation_results["answer_relevancy"] = {
                    "score": self.answer_relevancy.score,
                    "threshold": self.answer_relevancy.threshold,
                    "passed": self.answer_relevancy.score >= self.answer_relevancy.threshold,
                    "reason": getattr(self.answer_relevancy, 'reason', 'No specific reason')
                }
            except Exception as e:
                logger.error(f"Answer relevancy evaluation failed: {e}")
                evaluation_results["answer_relevancy"] = {"error": str(e)}
            
            # Faithfulness
            try:
                await asyncio.get_event_loop().run_in_executor(
                    None, self.faithfulness.measure, test_case
                )
                evaluation_results["faithfulness"] = {
                    "score": self.faithfulness.score,
                    "threshold": self.faithfulness.threshold,
                    "passed": self.faithfulness.score >= self.faithfulness.threshold,
                    "reason": getattr(self.faithfulness, 'reason', 'No specific reason')
                }
            except Exception as e:
                logger.error(f"Faithfulness evaluation failed: {e}")
                evaluation_results["faithfulness"] = {"error": str(e)}
            
            # Contextual Precision
            try:
                await asyncio.get_event_loop().run_in_executor(
                    None, self.contextual_precision.measure, test_case
                )
                evaluation_results["contextual_precision"] = {
                    "score": self.contextual_precision.score,
                    "threshold": self.contextual_precision.threshold,
                    "passed": self.contextual_precision.score >= self.contextual_precision.threshold,
                    "reason": getattr(self.contextual_precision, 'reason', 'No specific reason')
                }
            except Exception as e:
                logger.error(f"Contextual precision evaluation failed: {e}")
                evaluation_results["contextual_precision"] = {"error": str(e)}
            
            # Calculate overall score
            valid_scores = [
                result["score"] for result in evaluation_results.values() 
                if isinstance(result, dict) and "score" in result
            ]
            
            overall_score = sum(valid_scores) / len(valid_scores) if valid_scores else 0.0
            
            # Generate recommendations
            recommendations = self._generate_recommendations(evaluation_results, overall_score)
            
            # Create comprehensive result
            result = {
                "conversation_id": conversation_id,
                "question": question,
                "answer": answer,
                "evaluation_timestamp": datetime.utcnow().isoformat(),
                "overall_score": overall_score,
                "metrics": evaluation_results,
                "recommendations": recommendations,
                "quality_grade": self._get_quality_grade(overall_score)
            }
            
            # Cache result
            if conversation_id:
                self.evaluation_cache[conversation_id] = result
            
            return result
            
        except Exception as e:
            logger.error(f"Evaluation failed: {e}")
            return self._create_error_evaluation(question, answer, str(e))
    
    def _create_mock_evaluation(self, question: str, answer: str) -> Dict[str, Any]:
        """Create mock evaluation when DeepEval is not available"""
        
        # Simple heuristic scoring
        answer_length_score = min(len(answer) / 100, 1.0)  # Prefer longer answers
        question_relevance = 0.8 if any(word.lower() in answer.lower() for word in question.split()) else 0.5
        
        mock_score = (answer_length_score + question_relevance) / 2
        
        return {
            "question": question,
            "answer": answer,
            "evaluation_timestamp": datetime.utcnow().isoformat(),
            "overall_score": mock_score,
            "metrics": {
                "answer_relevancy": {
                    "score": question_relevance,
                    "threshold": 0.7,
                    "passed": question_relevance >= 0.7,
                    "reason": "Mock evaluation - question keywords found in answer"
                },
                "faithfulness": {
                    "score": 0.8,
                    "threshold": 0.7,
                    "passed": True,
                    "reason": "Mock evaluation - assumed faithful"
                },
                "contextual_precision": {
                    "score": answer_length_score,
                    "threshold": 0.7,
                    "passed": answer_length_score >= 0.7,
                    "reason": "Mock evaluation - based on answer length"
                }
            },
            "recommendations": self._generate_recommendations({}, mock_score),
            "quality_grade": self._get_quality_grade(mock_score),
            "note": "DeepEval not available - using mock evaluation"
        }
    
    def _create_error_evaluation(self, question: str, answer: str, error: str) -> Dict[str, Any]:
        """Create error evaluation result"""
        
        return {
            "question": question,
            "answer": answer,
            "evaluation_timestamp": datetime.utcnow().isoformat(),
            "overall_score": 0.0,
            "error": error,
            "metrics": {},
            "recommendations": ["Evaluation failed - please check system configuration"],
            "quality_grade": "F"
        }
    
    def _generate_recommendations(self, metrics: Dict, overall_score: float) -> List[str]:
        """Generate improvement recommendations based on evaluation results"""
        
        recommendations = []
        
        if overall_score < 0.5:
            recommendations.append("Overall quality is low - consider improving answer relevance and accuracy")
        elif overall_score < 0.7:
            recommendations.append("Moderate quality - room for improvement in specific areas")
        else:
            recommendations.append("Good quality response")
        
        # Specific metric recommendations
        for metric_name, result in metrics.items():
            if isinstance(result, dict) and "score" in result:
                if not result.get("passed", False):
                    if metric_name == "answer_relevancy":
                        recommendations.append("Improve answer relevance to the question")
                    elif metric_name == "faithfulness":
                        recommendations.append("Ensure answer is faithful to the source context")
                    elif metric_name == "contextual_precision":
                        recommendations.append("Improve contextual precision and accuracy")
        
        return recommendations
    
    def _get_quality_grade(self, score: float) -> str:
        """Convert numerical score to letter grade"""
        
        if score >= 0.9:
            return "A"
        elif score >= 0.8:
            return "B"
        elif score >= 0.7:
            return "C"
        elif score >= 0.6:
            return "D"
        else:
            return "F"
    
    async def batch_evaluate(self, qa_pairs: List[Dict]) -> List[Dict[str, Any]]:
        """
        Evaluate multiple Q&A pairs in batch
        
        Args:
            qa_pairs: List of dicts with 'question', 'answer', 'context' keys
            
        Returns:
            List of evaluation results
        """
        try:
            tasks = []
            for qa_pair in qa_pairs:
                task = self.evaluate_qa_response(
                    question=qa_pair.get("question", ""),
                    answer=qa_pair.get("answer", ""),
                    context=qa_pair.get("context", []),
                    conversation_id=qa_pair.get("conversation_id")
                )
                tasks.append(task)
            
            results = await asyncio.gather(*tasks, return_exceptions=True)
            
            # Handle exceptions
            processed_results = []
            for i, result in enumerate(results):
                if isinstance(result, Exception):
                    logger.error(f"Batch evaluation failed for item {i}: {result}")
                    processed_results.append(self._create_error_evaluation(
                        qa_pairs[i].get("question", ""),
                        qa_pairs[i].get("answer", ""),
                        str(result)
                    ))
                else:
                    processed_results.append(result)
            
            return processed_results
            
        except Exception as e:
            logger.error(f"Batch evaluation failed: {e}")
            return []
    
    def get_evaluation_summary(self, time_range: str = "24h") -> Dict[str, Any]:
        """
        Get evaluation summary statistics
        
        Args:
            time_range: Time range for summary (24h, 7d, 30d)
            
        Returns:
            Summary statistics
        """
        try:
            # In production, this would query database for actual statistics
            # For now, return mock summary
            
            return {
                "time_range": time_range,
                "total_evaluations": 150,
                "average_score": 0.82,
                "quality_distribution": {
                    "A": 45,
                    "B": 60,
                    "C": 30,
                    "D": 10,
                    "F": 5
                },
                "common_issues": [
                    "Answer relevancy could be improved",
                    "Some responses lack contextual precision",
                    "Faithfulness is generally good"
                ],
                "improvement_trends": {
                    "overall_score": "+5.2%",
                    "answer_relevancy": "+3.1%",
                    "faithfulness": "+7.8%",
                    "contextual_precision": "+2.4%"
                },
                "generated_at": datetime.utcnow().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Failed to get evaluation summary: {e}")
            return {"error": str(e)}


# Global evaluation service instance
evaluation_service = EvaluationService()