"""
RAG (Retrieval-Augmented Generation) endpoints for document processing with Pinecone integration
"""

import json
import logging
import os
import tempfile
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import redis
from app.core.config import settings
from app.services.document_manager import DocumentManager, get_document_manager
from app.services.evaluation_service import evaluation_service
from app.services.langchain_service import get_langchain_service
from app.services.metrics_service import metrics_service
from app.services.qa_logging_service import get_qa_logging_service
from app.services.qr_service import qr_service
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)
router = APIRouter()

# Redis client for conversation caching
redis_client = None
conversation_cache = {}

# Initialize Redis connection
try:
    redis_client = redis.from_url(settings.REDIS_URL)
    redis_client.ping()
    logger.info("Connected to Redis for RAG conversation caching")
except Exception as e:
    logger.warning(f"Redis connection failed for RAG, using memory cache: {e}")


class DocumentUploadResponse(BaseModel):
    """Document upload response"""

    success: bool
    document_id: str
    filename: str
    file_size: int
    processing_status: str
    upload_timestamp: datetime
    message: str
    chunk_count: Optional[int] = None
    processing_time: Optional[float] = None


class DocumentProcessingStatus(BaseModel):
    """Document processing status"""

    document_id: str
    filename: str
    status: str  # processing, completed, failed
    progress: float
    chunks_processed: int
    total_chunks: int
    error_message: Optional[str] = None
    processing_time: Optional[float] = None


class DocumentSearchRequest(BaseModel):
    """Enhanced document search request"""

    query: str = Field(min_length=1, max_length=500)
    limit: int = Field(default=5, ge=1, le=20)
    similarity_threshold: float = Field(default=0.7, ge=0.0, le=1.0)
    language: str = Field(default="id")
    document_types: Optional[List[str]] = None
    topics: Optional[List[str]] = None


class DocumentSearchResponse(BaseModel):
    """Enhanced document search response"""

    success: bool
    results: List[Dict[str, Any]]
    total_results: int
    processing_time: float
    query: str
    message: str


class DocumentInfo(BaseModel):
    """Enhanced document information"""

    document_id: str
    filename: str
    file_size: int
    upload_date: datetime
    processing_status: str
    chunk_count: int
    document_type: str
    language: str
    version: int
    title: Optional[str] = None
    author: Optional[str] = None
    topics: List[str] = []
    metadata: Dict[str, Any]


class DocumentListResponse(BaseModel):
    """Document list response"""

    success: bool
    documents: List[DocumentInfo]
    total: int
    limit: int
    offset: int
    message: str


class QuestionAnswerRequest(BaseModel):
    """Question answering with RAG request"""

    question: str = Field(min_length=1, max_length=500)
    session_id: str = Field(min_length=1)
    language: str = Field(default="id")
    max_sources: int = Field(default=3, ge=1, le=10)
    similarity_threshold: float = Field(default=0.7, ge=0.0, le=1.0)
    institution_id: Optional[int] = Field(
        default=None, description="Institution ID for institution-specific RAG"
    )
    institution_slug: Optional[str] = Field(
        default=None, description="Institution slug for namespace selection"
    )
    input_source: str = Field(
        default="text",
        description="Input source: 'text' (normal typing), 'gesture' (computer vision), 'speech' (voice recognition)",
    )


class QuestionAnswerResponse(BaseModel):
    """Enhanced question answering with RAG response"""

    success: bool
    question: str
    answer: str
    confidence: float
    sources: List[Dict[str, Any]]
    session_id: str
    processing_time: float
    follow_up_suggestions: List[str] = []
    message: str
    # Enhanced features from question API
    conversation_id: Optional[str] = None
    timestamp: Optional[datetime] = None
    qr_code: Optional[Dict[str, str]] = None
    evaluation: Optional[Dict[str, Any]] = None
    # Typo correction info
    original_question: Optional[str] = None
    typo_corrected: bool = False


class KnowledgeBaseStatsResponse(BaseModel):
    """Knowledge base statistics response"""

    success: bool
    stats: Dict[str, Any]
    message: str


class ConversationHistory(BaseModel):
    """Conversation history for RAG sessions"""

    session_id: str
    conversations: List[Dict[str, Any]]
    total_questions: int
    session_duration: float


# Conversation caching helper functions
async def cache_conversation(
    session_id: str,
    conversation_id: str,
    question: str,
    answer: str,
    confidence: float,
    sources: List[Dict],
    timestamp: datetime,
):
    """Cache conversation for history"""
    conversation = {
        "conversation_id": conversation_id,
        "question": question,
        "answer": answer,
        "confidence": confidence,
        "sources": sources,
        "timestamp": timestamp.isoformat(),
    }

    if redis_client:
        try:
            # Store individual conversation (sync operations)
            key = f"rag_conversation:{conversation_id}"
            redis_client.setex(key, 86400, json.dumps(conversation))

            # Add to session history
            session_key = f"rag_session_conversations:{session_id}"
            redis_client.lpush(session_key, conversation_id)
            redis_client.expire(session_key, 86400)

        except Exception as e:
            logger.error(f"Failed to cache RAG conversation: {e}")
            cache_conversation_memory(session_id, conversation)
    else:
        cache_conversation_memory(session_id, conversation)


def cache_conversation_memory(session_id: str, conversation: Dict):
    """Cache conversation in memory"""
    if session_id not in conversation_cache:
        conversation_cache[session_id] = []
    conversation_cache[session_id].append(conversation)


async def get_conversation_history_data(session_id: str) -> ConversationHistory:
    """Get conversation history for session"""
    try:
        conversations = []

        if redis_client:
            try:
                # Get conversation IDs from Redis
                session_key = f"rag_session_conversations:{session_id}"
                conversation_ids = await redis_client.lrange(session_key, 0, -1)

                # Get individual conversations
                for conv_id in conversation_ids:
                    conv_key = f"rag_conversation:{conv_id.decode()}"
                    conv_data = await redis_client.get(conv_key)
                    if conv_data:
                        conversations.append(json.loads(conv_data))

            except Exception as e:
                logger.error(f"Failed to get RAG conversation history from Redis: {e}")
                conversations = conversation_cache.get(session_id, [])
        else:
            conversations = conversation_cache.get(session_id, [])

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
            session_duration=session_duration,
        )

    except Exception as e:
        logger.error(f"Failed to get RAG conversation history: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve conversation history",
        )


# Dependency injection
async def get_document_manager_dep() -> DocumentManager:
    """Dependency to get document manager"""
    return get_document_manager()


@router.post("/upload", response_model=DocumentUploadResponse)
async def upload_document(
    file: UploadFile = File(...),
    title: Optional[str] = Form(None),
    description: Optional[str] = Form(None),
    author: Optional[str] = Form(None),
    topics: Optional[str] = Form(None),  # Comma-separated string
    language: str = Form("id"),
    institution_id: Optional[int] = Form(None),
    institution_slug: Optional[str] = Form(None),
    doc_manager: DocumentManager = Depends(get_document_manager_dep),
):
    """
    Upload document for RAG processing with Pinecone integration
    """
    try:
        # Validate file
        if not file.filename:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="No filename provided"
            )

        if file.size and file.size > settings.MAX_FILE_SIZE:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"File size exceeds maximum limit of {settings.MAX_FILE_SIZE} bytes",
            )

        # Check file type
        allowed_extensions = [".pdf", ".txt", ".docx", ".md", ".json"]
        if not any(file.filename.lower().endswith(ext) for ext in allowed_extensions):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unsupported file type. Allowed types: {', '.join(allowed_extensions)}",
            )

        # Read file content and save temporarily
        content = await file.read()

        with tempfile.NamedTemporaryFile(
            delete=False, suffix=os.path.splitext(file.filename)[1]
        ) as tmp_file:
            tmp_file.write(content)
            temp_path = tmp_file.name

        try:
            # Parse topics
            topic_list = None
            if topics:
                topic_list = [
                    topic.strip() for topic in topics.split(",") if topic.strip()
                ]

            # Add document using document manager with institution parameters
            result = await doc_manager.add_document(
                file_path=temp_path,
                title=title,
                description=description,
                author=author,
                topics=topic_list,
                language=language,
                institution_id=institution_id,
                institution_slug=institution_slug,
            )

            if result["success"]:
                metadata = result["metadata"]
                return DocumentUploadResponse(
                    success=True,
                    document_id=result["document_id"],
                    filename=file.filename,
                    file_size=len(content),
                    processing_status=metadata["processing_status"],
                    upload_timestamp=datetime.fromisoformat(
                        metadata["upload_timestamp"]
                    ),
                    message=result["message"],
                    chunk_count=metadata.get("chunk_count"),
                    processing_time=metadata.get("processing_time"),
                )
            else:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=result["message"],
                )

        finally:
            # Clean up temporary file
            os.unlink(temp_path)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Document upload endpoint failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Document upload failed: {str(e)}",
        )


@router.get("/status/{document_id}", response_model=DocumentProcessingStatus)
async def get_document_status(
    document_id: str, doc_manager: DocumentManager = Depends(get_document_manager_dep)
):
    """
    Get document processing status
    """
    try:
        result = await doc_manager.get_document_info(document_id)

        if result["success"]:
            doc_data = result["document"]
            return DocumentProcessingStatus(
                document_id=document_id,
                filename=doc_data["filename"],
                status=doc_data["processing_status"],
                progress=1.0 if doc_data["processing_status"] == "completed" else 0.5,
                chunks_processed=doc_data.get("chunk_count", 0),
                total_chunks=doc_data.get("chunk_count", 0),
                error_message=doc_data.get("error_message"),
                processing_time=doc_data.get("processing_time"),
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Document not found"
            )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Document status endpoint failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve document status",
        )


@router.post("/search", response_model=DocumentSearchResponse)
async def search_documents(
    request: DocumentSearchRequest,
    doc_manager: DocumentManager = Depends(get_document_manager_dep),
):
    """
    Search documents using Pinecone vector similarity
    """
    try:
        result = await doc_manager.search_documents(
            query=request.query,
            language=request.language,
            max_results=request.limit,
            similarity_threshold=request.similarity_threshold,
            document_types=request.document_types,
            topics=request.topics,
        )

        return DocumentSearchResponse(
            success=result["success"],
            results=result["results"] if result["success"] else [],
            total_results=result.get("total_results", 0),
            processing_time=0.0,  # Will be calculated by document manager
            query=request.query,
            message=result["message"],
        )

    except Exception as e:
        logger.error(f"Document search endpoint failed: {e}")
        return DocumentSearchResponse(
            success=False,
            results=[],
            total_results=0,
            processing_time=0.0,
            query=request.query,
            message=f"Search failed: {str(e)}",
        )


@router.get("/documents", response_model=DocumentListResponse)
async def list_documents(
    limit: int = 50,
    offset: int = 0,
    status_filter: Optional[str] = None,
    doc_manager: DocumentManager = Depends(get_document_manager_dep),
):
    """
    List all uploaded documents with pagination
    """
    try:
        result = await doc_manager.list_documents(
            limit=limit, offset=offset, status=status_filter
        )

        if result["success"]:
            formatted_docs = []
            for doc_data in result["documents"]:
                doc_info = DocumentInfo(
                    document_id=doc_data["document_id"],
                    filename=doc_data["filename"],
                    file_size=doc_data.get("file_size", 0),
                    upload_date=datetime.fromisoformat(doc_data["upload_timestamp"]),
                    processing_status=doc_data["processing_status"],
                    chunk_count=doc_data.get("chunk_count", 0),
                    document_type=doc_data.get("document_type", "unknown"),
                    language=doc_data.get("language", "id"),
                    version=doc_data.get("version", 1),
                    title=doc_data.get("title"),
                    author=doc_data.get("author"),
                    topics=doc_data.get("topics", []),
                    metadata={
                        "description": doc_data.get("description"),
                        "processing_time": doc_data.get("processing_time"),
                        "error_message": doc_data.get("error_message"),
                    },
                )
                formatted_docs.append(doc_info)

            return DocumentListResponse(
                success=True,
                documents=formatted_docs,
                total=result["total"],
                limit=limit,
                offset=offset,
                message=result["message"],
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=result["message"],
            )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Document list endpoint failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve document list",
        )


@router.post("/ask", response_model=QuestionAnswerResponse)
async def ask_question_with_rag(
    request: QuestionAnswerRequest,
    doc_manager: DocumentManager = Depends(get_document_manager_dep),
):
    """
    Ask a question and get an answer using RAG with Pinecone
    Enhanced with QR codes, evaluation, and conversation history
    """
    start_time = datetime.now(timezone.utc)

    try:
        # Generate conversation ID
        conversation_id = f"{request.session_id}_{int(start_time.timestamp())}"

        # Step 1: Correct typos ONLY for gesture/speech input (not normal text)
        langchain_service = get_langchain_service()

        if request.input_source in ["gesture", "speech"]:
            logger.info(
                f"🔧 [Typo Correction] Processing {request.input_source} input: '{request.question}'"
            )
            corrected_question = await langchain_service.correct_typo_question(
                request.question,
                language=request.language,
                institution_slug=request.institution_slug,
            )
            if corrected_question != request.question:
                logger.info(
                    f"✅ [Typo Correction] '{request.question}' → '{corrected_question}'"
                )
        else:
            # Normal text input - no typo correction needed
            logger.info(
                f"📝 [Text Input] Skipping typo correction for normal text: '{request.question}'"
            )
            corrected_question = request.question

        # Step 2: Process RAG with corrected question
        # Log institution information for debugging
        logger.info(
            f"🏢 [RAG] Processing question for institution: {request.institution_slug} (ID: {request.institution_id})"
        )

        result = await doc_manager.search_with_qa(
            question=corrected_question,
            session_id=request.session_id,
            language=request.language,
            max_docs=request.max_sources,
            similarity_threshold=request.similarity_threshold,
            institution_id=request.institution_id,
            institution_slug=request.institution_slug,
        )

        answer = result.get("answer", "")
        confidence = result.get("confidence", 0.0)
        sources = result.get("sources", [])
        processing_time = result.get("processing_time", 0.0)

        # Generate QR code for response (enhanced feature)
        qr_code_data = None
        try:
            summary_data = {
                "title": f"RAG Q&A: {request.question[:50]}...",
                "question": request.question,
                "answer": answer,
                "sources": [source.get("source", "Unknown") for source in sources[:3]],
                "timestamp": start_time.isoformat(),
            }

            qr_result = qr_service.generate_conversation_summary_qr(
                conversation_id=conversation_id,
                user_id=1,  # Default user ID for session-based users
                summary_data=summary_data,
            )

            qr_code_data = {
                "qr_code_base64": qr_result["qr_code_base64"],
                "download_url": qr_result["download_url"],
                "access_token": qr_result["access_token"],
            }

            # Record QR generation metric
            metrics_service.record_qr_generation("rag_conversation_summary")

        except Exception as e:
            logger.warning(f"Failed to generate QR code for RAG response: {e}")

        # Evaluate response quality (enhanced feature)
        evaluation_data = None
        try:
            # Extract source text for evaluation context
            source_contexts = [source.get("text", "") for source in sources]

            evaluation_data = await evaluation_service.evaluate_qa_response(
                question=request.question,
                answer=answer,
                context=source_contexts,
                conversation_id=conversation_id,
            )

            # Record evaluation metrics
            if evaluation_data.get("metrics"):
                for metric_name, metric_result in evaluation_data["metrics"].items():
                    if isinstance(metric_result, dict) and "score" in metric_result:
                        metrics_service.record_deepeval_score(
                            metric_name, metric_result["score"]
                        )

        except Exception as e:
            logger.warning(f"Failed to evaluate RAG response: {e}")

        # Cache conversation for history (enhanced feature)
        try:
            await cache_conversation(
                request.session_id,
                conversation_id,
                request.question,
                answer,
                confidence,
                sources,
                start_time,
            )
        except Exception as e:
            logger.warning(f"Failed to cache RAG conversation: {e}")

        # Record AI request metrics (enhanced feature)
        try:
            metrics_service.record_ai_request(
                model=settings.LLM_MODEL,
                request_type="rag_question_answering",
                duration=processing_time,
                confidence=confidence,
            )
        except Exception as e:
            logger.warning(f"Failed to record RAG metrics: {e}")

        # Log QA interaction to database (NEW: Fix for empty qa_logs table)
        try:
            # First, ensure we have a conversation record for QA logging
            from app.core.database import get_db_session
            from app.db.models import Conversation
            from sqlalchemy import insert, select

            conversation_db_id = None
            async for db_session in get_db_session():
                # Check if conversation already exists for this session
                existing_conversation = await db_session.execute(
                    select(Conversation.conversation_id).where(
                        Conversation.session_id == request.session_id,
                        Conversation.service_mode == "full_llm_bot",
                        Conversation.is_active,
                    )
                )

                conversation_row = existing_conversation.fetchone()

                if conversation_row:
                    conversation_db_id = conversation_row[0]
                else:
                    # Create new conversation record for QA logging
                    conversation_data = {
                        "session_id": request.session_id,
                        "service_mode": "full_llm_bot",
                        "is_active": True,
                        "status": "active",
                        "priority": "normal",
                        "last_message_at": start_time,
                        "created_at": start_time,
                        "updated_at": start_time,
                    }

                    result_conv = await db_session.execute(
                        insert(Conversation)
                        .values(**conversation_data)
                        .returning(Conversation.conversation_id)
                    )

                    await db_session.commit()
                    conversation_db_id = result_conv.fetchone()[0]

                break

            if conversation_db_id:
                qa_service = get_qa_logging_service()

                qa_log_id = await qa_service.log_llm_response(
                    conversation_id=conversation_db_id,
                    question=corrected_question,
                    answer=answer,
                    confidence=confidence,
                    response_time=processing_time,
                    context_used=f"RAG with {len(sources)} sources",
                    sources=sources,
                    institution_id=getattr(
                        request, "institution_id", 1
                    ),  # Default to 1
                    evaluation_data=evaluation_data,
                )

            if qa_log_id:
                logger.info(f"QA interaction logged with ID: {qa_log_id}")
            else:
                logger.warning("Failed to log QA interaction")

        except Exception as e:
            logger.warning(f"Failed to log QA interaction: {e}")

        return QuestionAnswerResponse(
            success=result["success"],
            question=corrected_question,  # return the corrected question
            answer=answer,
            confidence=confidence,
            sources=sources,
            session_id=request.session_id,
            processing_time=processing_time,
            follow_up_suggestions=result.get("follow_up_suggestions", []),
            message=result["message"],
            # Enhanced features
            conversation_id=conversation_id,
            timestamp=start_time,
            qr_code=qr_code_data,
            evaluation=evaluation_data,
            # Typo correction metadata
            original_question=(
                request.question if corrected_question != request.question else None
            ),
            typo_corrected=corrected_question != request.question,
        )

    except Exception as e:
        logger.error(f"Enhanced RAG question answering endpoint failed: {e}")
        return QuestionAnswerResponse(
            success=False,
            question=request.question,
            answer="Maaf, saya tidak dapat memproses pertanyaan Anda saat ini. Silakan coba lagi.",
            confidence=0.0,
            sources=[],
            session_id=request.session_id,
            processing_time=(datetime.now(timezone.utc) - start_time).total_seconds(),
            follow_up_suggestions=[],
            message=f"Question answering failed: {str(e)}",
            # Enhanced features for error case
            conversation_id=f"{request.session_id}_{int(start_time.timestamp())}",
            timestamp=start_time,
            qr_code=None,
            evaluation=None,
            # Typo correction metadata for error case
            original_question=None,
            typo_corrected=False,
        )


@router.get("/history/{session_id}", response_model=ConversationHistory)
async def get_rag_conversation_history(session_id: str):
    """
    Get RAG conversation history for session
    """
    try:
        history = await get_conversation_history_data(session_id)
        return history

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get RAG conversation history: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve conversation history",
        )


@router.delete("/history/{session_id}")
async def clear_rag_conversation_history(session_id: str):
    """
    Clear RAG conversation history for session
    """
    try:
        # Clear from Redis
        if redis_client:
            try:
                session_key = f"rag_session_conversations:{session_id}"
                conversation_ids = await redis_client.lrange(session_key, 0, -1)

                # Delete individual conversations
                for conv_id in conversation_ids:
                    conv_key = f"rag_conversation:{conv_id.decode()}"
                    await redis_client.delete(conv_key)

                # Delete session history
                await redis_client.delete(session_key)

            except Exception as e:
                logger.error(
                    f"Failed to clear RAG conversation history from Redis: {e}"
                )

        # Clear from memory cache
        if session_id in conversation_cache:
            del conversation_cache[session_id]

        return {"message": "RAG conversation history cleared successfully"}

    except Exception as e:
        logger.error(f"Failed to clear RAG conversation history: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to clear conversation history",
        )


@router.get("/stats", response_model=KnowledgeBaseStatsResponse)
async def get_knowledge_base_stats(
    doc_manager: DocumentManager = Depends(get_document_manager_dep),
):
    """
    Get knowledge base statistics
    """
    try:
        result = await doc_manager.get_knowledge_base_stats()

        return KnowledgeBaseStatsResponse(
            success=result["success"],
            stats=result.get("stats", {}),
            message=result["message"],
        )

    except Exception as e:
        logger.error(f"Knowledge base stats endpoint failed: {e}")
        return KnowledgeBaseStatsResponse(
            success=False,
            stats={},
            message=f"Failed to get knowledge base stats: {str(e)}",
        )


@router.delete("/documents/{document_id}")
async def delete_document(
    document_id: str, doc_manager: DocumentManager = Depends(get_document_manager_dep)
):
    """
    Delete a document from the knowledge base
    """
    try:
        result = await doc_manager.delete_document(document_id)

        if result["success"]:
            return {"success": True, "message": result["message"]}
        else:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail=result["message"]
            )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Document deletion endpoint failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Document deletion failed: {str(e)}",
        )
