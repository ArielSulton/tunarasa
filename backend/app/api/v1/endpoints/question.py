"""
Question answering endpoints for RAG-powered Q&A system
"""

import logging
from typing import List, Dict, Any, Optional
from datetime import datetime
import json
import redis

from fastapi import APIRouter, HTTPException, status, Request, Depends
from pydantic import BaseModel, Field

from app.core.config import settings

logger = logging.getLogger(__name__)
router = APIRouter()


class QuestionRequest(BaseModel):
    """Question request from user"""
    session_id: str
    question: str = Field(min_length=1, max_length=500)
    context: Optional[Dict[str, Any]] = None
    language: str = Field(default="en")


class QuestionResponse(BaseModel):
    """Question response with answer"""
    answer: str
    confidence: float
    sources: List[str] = []
    processing_time: float
    conversation_id: str
    timestamp: datetime


class ConversationHistory(BaseModel):
    """Conversation history for session"""
    session_id: str
    conversations: List[Dict[str, Any]]
    total_questions: int
    session_duration: float


class QuestionProcessor:
    """Question answering processor using RAG"""
    
    def __init__(self):
        self.redis_client = None
        self.conversation_cache = {}
        
        # Connect to Redis for conversation caching
        try:
            self.redis_client = redis.from_url(settings.REDIS_URL)
            self.redis_client.ping()
            logger.info("Connected to Redis for conversation caching")
        except Exception as e:
            logger.warning(f"Redis connection failed, using memory cache: {e}")
    
    async def process_question(self, request: QuestionRequest) -> QuestionResponse:
        """Process question and generate answer using RAG"""
        
        start_time = datetime.utcnow()
        
        try:
            # Validate question
            if not request.question.strip():
                raise ValueError("Question cannot be empty")
            
            # Generate conversation ID
            conversation_id = f"{request.session_id}_{int(start_time.timestamp())}"
            
            # Process question through RAG pipeline
            answer, confidence, sources = await self._generate_answer(
                request.question,
                request.context,
                request.language
            )
            
            # Cache conversation
            await self._cache_conversation(
                request.session_id,
                conversation_id,
                request.question,
                answer,
                confidence,
                sources,
                start_time
            )
            
            processing_time = (datetime.utcnow() - start_time).total_seconds()
            
            return QuestionResponse(
                answer=answer,
                confidence=confidence,
                sources=sources,
                processing_time=processing_time,
                conversation_id=conversation_id,
                timestamp=start_time
            )
            
        except Exception as e:
            logger.error(f"Question processing failed: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Question processing failed: {str(e)}"
            )
    
    async def _generate_answer(self, question: str, context: Optional[Dict], language: str) -> tuple:
        """Generate answer using RAG pipeline"""
        
        try:
            # Import AI service
            from app.services.ai_service import get_ai_service
            ai_service = get_ai_service()
            
            # Process question with AI service
            session_id = context.get("session_id", "unknown") if context else "unknown"
            result = await ai_service.process_question(question, session_id, context)
            
            # Extract answer and metadata
            answer = result.get("answer", "I'm sorry, I couldn't process your question right now.")
            confidence = 0.85 if "error" not in result else 0.1
            sources = [doc.get("source", "Unknown") for doc in result.get("source_documents", [])]
            
            return answer, confidence, sources
            
        except Exception as e:
            logger.error(f"Answer generation failed: {e}")
            # Fallback answer
            return "I'm sorry, I couldn't process your question right now. Please try again.", 0.1, []
    
    async def _process_with_rag(self, question: str, context: Optional[Dict], language: str) -> str:
        """Process question with RAG pipeline"""
        
        # Placeholder for RAG processing
        # This would integrate with:
        # 1. Pinecone for document retrieval
        # 2. LangChain for context processing
        # 3. ChatGroq for answer generation
        
        if "hello" in question.lower():
            return "Hello! I'm here to help answer your questions. What would you like to know?"
        
        if "help" in question.lower():
            return "I can help you with various questions. Just ask me anything and I'll do my best to provide helpful information."
        
        # Basic response template
        return f"Thank you for your question: '{question}'. I'm processing this using our AI system and will provide you with the best answer possible."
    
    async def _cache_conversation(self, session_id: str, conversation_id: str, question: str, 
                                 answer: str, confidence: float, sources: List[str], timestamp: datetime):
        """Cache conversation for history"""
        
        conversation = {
            "conversation_id": conversation_id,
            "question": question,
            "answer": answer,
            "confidence": confidence,
            "sources": sources,
            "timestamp": timestamp.isoformat()
        }
        
        if self.redis_client:
            try:
                # Store individual conversation
                key = f"conversation:{conversation_id}"
                await self.redis_client.setex(key, 86400, json.dumps(conversation))
                
                # Add to session history
                session_key = f"session_conversations:{session_id}"
                await self.redis_client.lpush(session_key, conversation_id)
                await self.redis_client.expire(session_key, 86400)
                
            except Exception as e:
                logger.error(f"Failed to cache conversation: {e}")
                self._cache_conversation_memory(session_id, conversation)
        else:
            self._cache_conversation_memory(session_id, conversation)
    
    def _cache_conversation_memory(self, session_id: str, conversation: Dict):
        """Cache conversation in memory"""
        if session_id not in self.conversation_cache:
            self.conversation_cache[session_id] = []
        self.conversation_cache[session_id].append(conversation)
    
    async def get_conversation_history(self, session_id: str) -> ConversationHistory:
        """Get conversation history for session"""
        
        try:
            conversations = []
            
            if self.redis_client:
                try:
                    # Get conversation IDs from Redis
                    session_key = f"session_conversations:{session_id}"
                    conversation_ids = await self.redis_client.lrange(session_key, 0, -1)
                    
                    # Get individual conversations
                    for conv_id in conversation_ids:
                        conv_key = f"conversation:{conv_id.decode()}"
                        conv_data = await self.redis_client.get(conv_key)
                        if conv_data:
                            conversations.append(json.loads(conv_data))
                            
                except Exception as e:
                    logger.error(f"Failed to get conversation history from Redis: {e}")
                    conversations = self.conversation_cache.get(session_id, [])
            else:
                conversations = self.conversation_cache.get(session_id, [])
            
            # Calculate session duration
            session_duration = 0.0
            if conversations:
                first_timestamp = datetime.fromisoformat(conversations[-1]["timestamp"])
                last_timestamp = datetime.fromisoformat(conversations[0]["timestamp"])
                session_duration = (last_timestamp - first_timestamp).total_seconds()
            
            return ConversationHistory(
                session_id=session_id,
                conversations=conversations,
                total_questions=len(conversations),
                session_duration=session_duration
            )
            
        except Exception as e:
            logger.error(f"Failed to get conversation history: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to retrieve conversation history"
            )


# Initialize question processor
question_processor = QuestionProcessor()


@router.post("/ask", response_model=QuestionResponse)
async def ask_question(
    request: QuestionRequest,
    http_request: Request
):
    """
    Process question and generate answer using RAG
    """
    try:
        result = await question_processor.process_question(request)
        logger.info(f"Processed question for session {request.session_id}")
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Question processing endpoint failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Question processing failed"
        )


@router.get("/history/{session_id}", response_model=ConversationHistory)
async def get_conversation_history(session_id: str):
    """
    Get conversation history for session
    """
    try:
        history = await question_processor.get_conversation_history(session_id)
        return history
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get conversation history: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve conversation history"
        )


@router.delete("/history/{session_id}")
async def clear_conversation_history(session_id: str):
    """
    Clear conversation history for session
    """
    try:
        # Clear from Redis
        if question_processor.redis_client:
            try:
                session_key = f"session_conversations:{session_id}"
                conversation_ids = await question_processor.redis_client.lrange(session_key, 0, -1)
                
                # Delete individual conversations
                for conv_id in conversation_ids:
                    conv_key = f"conversation:{conv_id.decode()}"
                    await question_processor.redis_client.delete(conv_key)
                
                # Delete session history
                await question_processor.redis_client.delete(session_key)
                
            except Exception as e:
                logger.error(f"Failed to clear conversation history from Redis: {e}")
        
        # Clear from memory cache
        if session_id in question_processor.conversation_cache:
            del question_processor.conversation_cache[session_id]
        
        return {"message": "Conversation history cleared successfully"}
        
    except Exception as e:
        logger.error(f"Failed to clear conversation history: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to clear conversation history"
        )