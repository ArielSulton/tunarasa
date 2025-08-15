"""
QA Logging Service - Enhanced logging for Q&A interactions

This service handles logging of all Q&A interactions to the qa_logs table
with proper session tracking, performance metrics, and admin support.
"""

import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from app.core.database import get_db_session
from app.db.models import Conversation, QaLog
from app.services.metrics_service import MetricsService
from sqlalchemy import insert, select

logger = logging.getLogger(__name__)


class QALoggingService:
    """Service for comprehensive Q&A logging with metrics integration"""

    def __init__(self):
        self.metrics_service = MetricsService()

    async def log_qa_interaction(
        self,
        conversation_id: int,
        question: str,
        answer: str,
        confidence: Optional[int] = None,
        response_time: Optional[int] = None,
        gesture_input: Optional[str] = None,
        context_used: Optional[str] = None,
        evaluation_score: Optional[int] = None,
        service_mode: str = "full_llm_bot",
        responded_by: str = "llm",
        admin_id: Optional[int] = None,
        llm_recommendation_used: bool = False,
        institution_id: int = 1,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Optional[int]:
        """
        Log a Q&A interaction to the database with comprehensive tracking

        Args:
            conversation_id: Required conversation ID for tracking
            question: The user's question
            answer: The system's answer
            confidence: Confidence score (0-100)
            response_time: Response time in milliseconds
            gesture_input: Original gesture input if applicable
            context_used: Context information used for the answer
            evaluation_score: Quality evaluation score (0-100)
            service_mode: Service mode ('full_llm_bot', 'bot_with_admin_validation')
            responded_by: Who responded ('llm', 'admin')
            admin_id: Admin ID if responded by admin
            llm_recommendation_used: Whether LLM recommendation was used
            institution_id: Institution ID for clustering
            metadata: Additional metadata

        Returns:
            QA log ID if successful, None otherwise
        """
        try:
            async for db_session in get_db_session():
                # Verify conversation_id exists (required field)
                conversation_check = await db_session.execute(
                    select(Conversation.conversation_id).where(
                        Conversation.conversation_id == conversation_id
                    )
                )
                if not conversation_check.fetchone():
                    logger.error(f"Conversation ID {conversation_id} not found")
                    return None

                # Create QA log entry
                qa_log_data = {
                    "conversation_id": conversation_id,
                    "institution_id": institution_id,
                    "question": question,
                    "answer": answer,
                    "confidence": confidence,
                    "response_time": response_time,
                    "gesture_input": gesture_input,
                    "context_used": context_used,
                    "evaluation_score": evaluation_score,
                    "service_mode": service_mode,
                    "responded_by": responded_by,
                    "admin_id": admin_id,
                    "llm_recommendation_used": llm_recommendation_used,
                    "created_at": datetime.now(timezone.utc),
                }

                # Remove None values to use database defaults
                qa_log_data = {k: v for k, v in qa_log_data.items() if v is not None}

                result = await db_session.execute(
                    insert(QaLog).values(**qa_log_data).returning(QaLog.qa_id)
                )

                await db_session.commit()

                qa_id = result.fetchone()[0]

                # Record metrics
                self._record_metrics(
                    responded_by=responded_by,
                    confidence=confidence,
                    response_time=response_time,
                    evaluation_score=evaluation_score,
                    service_mode=service_mode,
                    institution_id=institution_id,
                )

                logger.info(f"QA interaction logged successfully with ID: {qa_id}")
                return qa_id

        except Exception as e:
            logger.error(f"Failed to log QA interaction: {e}")
            # Don't raise exception to avoid breaking the main flow
            return None

    async def log_llm_response(
        self,
        conversation_id: int,
        question: str,
        answer: str,
        confidence: float = 0.0,
        response_time: Optional[float] = None,
        context_used: Optional[str] = None,
        sources: Optional[List[Dict]] = None,
        institution_id: int = 1,
        evaluation_data: Optional[Dict] = None,
    ) -> Optional[int]:
        """
        Log LLM response with enhanced metadata

        Args:
            conversation_id: Required conversation ID for tracking
            question: User question
            answer: LLM answer
            confidence: Confidence score (0.0-1.0, will be converted to 0-100)
            response_time: Response time in seconds
            context_used: Context information
            sources: Source documents used
            institution_id: Institution ID
            evaluation_data: Evaluation results

        Returns:
            QA log ID if successful, None otherwise
        """
        # Convert confidence from 0.0-1.0 to 0-100
        confidence_percent = int(confidence * 100) if confidence else None

        # Convert response time from seconds to milliseconds
        response_time_ms = int(response_time * 1000) if response_time else None

        # Prepare context information
        context_info = context_used
        if sources:
            source_info = f"Sources: {len(sources)} documents"
            if context_info:
                context_info += f" | {source_info}"
            else:
                context_info = source_info

        # Extract evaluation score
        evaluation_score = None
        if evaluation_data and isinstance(evaluation_data, dict):
            if "overall_score" in evaluation_data:
                evaluation_score = int(evaluation_data["overall_score"] * 100)
            elif "average_score" in evaluation_data:
                evaluation_score = int(evaluation_data["average_score"] * 100)

        return await self.log_qa_interaction(
            conversation_id=conversation_id,
            question=question,
            answer=answer,
            confidence=confidence_percent,
            response_time=response_time_ms,
            context_used=context_info,
            evaluation_score=evaluation_score,
            service_mode="full_llm_bot",
            responded_by="llm",
            institution_id=institution_id,
        )

    async def log_admin_response(
        self,
        conversation_id: int,
        question: str,
        answer: str,
        admin_id: int,
        llm_recommendation_used: bool = False,
        response_time: Optional[int] = None,
        institution_id: int = 1,
    ) -> Optional[int]:
        """
        Log admin response in bot_with_admin_validation mode

        Args:
            conversation_id: Related conversation ID
            question: User question
            answer: Admin answer
            admin_id: ID of the responding admin
            llm_recommendation_used: Whether admin used LLM recommendation
            response_time: Response time in milliseconds
            institution_id: Institution ID

        Returns:
            QA log ID if successful, None otherwise
        """
        return await self.log_qa_interaction(
            conversation_id=conversation_id,
            question=question,
            answer=answer,
            response_time=response_time,
            service_mode="bot_with_admin_validation",
            responded_by="admin",
            admin_id=admin_id,
            llm_recommendation_used=llm_recommendation_used,
            institution_id=institution_id,
            # Admin responses get high confidence
            confidence=95,
        )

    async def log_gesture_interaction(
        self,
        conversation_id: int,
        gesture_input: str,
        question: str,
        answer: str,
        confidence: Optional[int] = None,
        response_time: Optional[int] = None,
        institution_id: int = 1,
    ) -> Optional[int]:
        """
        Log gesture-based interaction

        Args:
            conversation_id: Related conversation ID
            gesture_input: Original gesture data/description
            question: Interpreted question from gesture
            answer: System answer
            confidence: Confidence score (0-100)
            response_time: Response time in milliseconds
            institution_id: Institution ID

        Returns:
            QA log ID if successful, None otherwise
        """
        return await self.log_qa_interaction(
            conversation_id=conversation_id,
            question=question,
            answer=answer,
            confidence=confidence,
            response_time=response_time,
            gesture_input=gesture_input,
            service_mode="full_llm_bot",
            responded_by="llm",
            institution_id=institution_id,
        )

    async def get_qa_logs_for_institution(
        self,
        institution_id: int,
        limit: int = 100,
        offset: int = 0,
        min_confidence: Optional[int] = None,
    ) -> List[Dict[str, Any]]:
        """
        Get QA logs for a specific institution (for FAQ clustering)

        Args:
            institution_id: Institution ID
            limit: Maximum number of logs to return
            offset: Number of logs to skip
            min_confidence: Minimum confidence threshold

        Returns:
            List of QA log dictionaries
        """
        try:
            async for db_session in get_db_session():
                query = select(QaLog).where(QaLog.institution_id == institution_id)

                if min_confidence is not None:
                    query = query.where(QaLog.confidence >= min_confidence)

                query = (
                    query.order_by(QaLog.created_at.desc()).limit(limit).offset(offset)
                )

                result = await db_session.execute(query)
                qa_logs = result.scalars().all()

                return [
                    {
                        "qa_id": log.qa_id,
                        "question": log.question,
                        "answer": log.answer,
                        "confidence": log.confidence,
                        "response_time": log.response_time,
                        "service_mode": log.service_mode,
                        "responded_by": log.responded_by,
                        "created_at": log.created_at,
                        "evaluation_score": log.evaluation_score,
                    }
                    for log in qa_logs
                ]

        except Exception as e:
            logger.error(f"Failed to get QA logs for institution {institution_id}: {e}")
            return []

    def _record_metrics(
        self,
        responded_by: str,
        confidence: Optional[int] = None,
        response_time: Optional[int] = None,
        evaluation_score: Optional[int] = None,
        service_mode: str = "full_llm_bot",
        institution_id: int = 1,
    ):
        """Record metrics for the QA interaction"""
        try:
            # Record basic QA metrics
            self.metrics_service.record_question(
                source="qa_log", category=f"institution_{institution_id}"
            )

            # Record response time if available
            if response_time:
                self.metrics_service.record_ai_request(
                    model="llm",
                    request_type=f"qa_{service_mode}",
                    duration=response_time / 1000,  # Convert to seconds
                    confidence=confidence / 100 if confidence else None,
                )

            # Record evaluation score if available
            if evaluation_score:
                self.metrics_service.record_deepeval_score(
                    "qa_quality", evaluation_score / 100
                )

        except Exception as e:
            logger.warning(f"Failed to record QA metrics: {e}")


# Global service instance
qa_logging_service = QALoggingService()


def get_qa_logging_service() -> QALoggingService:
    """Get the global QA logging service instance"""
    return qa_logging_service
