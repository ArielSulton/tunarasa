"""
RAG (Retrieval-Augmented Generation) endpoints for document processing with Pinecone integration
"""

import logging
from typing import List, Dict, Any, Optional
from datetime import datetime
import json
import tempfile
import os

from fastapi import APIRouter, HTTPException, status, UploadFile, File, Form, Depends
from pydantic import BaseModel, Field

from app.core.config import settings
from app.services.document_manager import get_document_manager, DocumentManager
from app.services.pinecone_service import get_pinecone_service, DocumentType, ProcessingStatus
from app.services.langchain_service import get_langchain_service

logger = logging.getLogger(__name__)
router = APIRouter()


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


class QuestionAnswerResponse(BaseModel):
    """Question answering with RAG response"""
    success: bool
    question: str
    answer: str
    confidence: float
    sources: List[Dict[str, Any]]
    session_id: str
    processing_time: float
    follow_up_suggestions: List[str] = []
    message: str


class KnowledgeBaseStatsResponse(BaseModel):
    """Knowledge base statistics response"""
    success: bool
    stats: Dict[str, Any]
    message: str


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
    doc_manager: DocumentManager = Depends(get_document_manager_dep)
):
    """
    Upload document for RAG processing with Pinecone integration
    """
    try:
        # Validate file
        if not file.filename:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No filename provided"
            )
        
        if file.size and file.size > settings.MAX_FILE_SIZE:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"File size exceeds maximum limit of {settings.MAX_FILE_SIZE} bytes"
            )
        
        # Check file type
        allowed_extensions = ['.pdf', '.txt', '.docx', '.md', '.json']
        if not any(file.filename.lower().endswith(ext) for ext in allowed_extensions):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unsupported file type. Allowed types: {', '.join(allowed_extensions)}"
            )
        
        # Read file content and save temporarily
        content = await file.read()
        
        with tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(file.filename)[1]) as tmp_file:
            tmp_file.write(content)
            temp_path = tmp_file.name
        
        try:
            # Parse topics
            topic_list = None
            if topics:
                topic_list = [topic.strip() for topic in topics.split(",") if topic.strip()]
            
            # Add document using document manager
            result = await doc_manager.add_document(
                file_path=temp_path,
                title=title,
                description=description,
                author=author,
                topics=topic_list,
                language=language
            )
            
            if result["success"]:
                metadata = result["metadata"]
                return DocumentUploadResponse(
                    success=True,
                    document_id=result["document_id"],
                    filename=file.filename,
                    file_size=len(content),
                    processing_status=metadata["processing_status"],
                    upload_timestamp=datetime.fromisoformat(metadata["upload_timestamp"]),
                    message=result["message"],
                    chunk_count=metadata.get("chunk_count"),
                    processing_time=metadata.get("processing_time")
                )
            else:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=result["message"]
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
            detail=f"Document upload failed: {str(e)}"
        )


@router.get("/status/{document_id}", response_model=DocumentProcessingStatus)
async def get_document_status(
    document_id: str,
    doc_manager: DocumentManager = Depends(get_document_manager_dep)
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
                processing_time=doc_data.get("processing_time")
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Document not found"
            )
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Document status endpoint failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve document status"
        )


@router.post("/search", response_model=DocumentSearchResponse)
async def search_documents(
    request: DocumentSearchRequest,
    doc_manager: DocumentManager = Depends(get_document_manager_dep)
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
            topics=request.topics
        )
        
        return DocumentSearchResponse(
            success=result["success"],
            results=result["results"] if result["success"] else [],
            total_results=result.get("total_results", 0),
            processing_time=0.0,  # Will be calculated by document manager
            query=request.query,
            message=result["message"]
        )
        
    except Exception as e:
        logger.error(f"Document search endpoint failed: {e}")
        return DocumentSearchResponse(
            success=False,
            results=[],
            total_results=0,
            processing_time=0.0,
            query=request.query,
            message=f"Search failed: {str(e)}"
        )


@router.get("/documents", response_model=DocumentListResponse)
async def list_documents(
    limit: int = 50,
    offset: int = 0,
    status_filter: Optional[str] = None,
    doc_manager: DocumentManager = Depends(get_document_manager_dep)
):
    """
    List all uploaded documents with pagination
    """
    try:
        result = await doc_manager.list_documents(
            limit=limit,
            offset=offset,
            status=status_filter
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
                        "error_message": doc_data.get("error_message")
                    }
                )
                formatted_docs.append(doc_info)
            
            return DocumentListResponse(
                success=True,
                documents=formatted_docs,
                total=result["total"],
                limit=limit,
                offset=offset,
                message=result["message"]
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=result["message"]
            )
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Document list endpoint failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve document list"
        )


@router.post("/ask", response_model=QuestionAnswerResponse)
async def ask_question_with_rag(
    request: QuestionAnswerRequest,
    doc_manager: DocumentManager = Depends(get_document_manager_dep)
):
    """
    Ask a question and get an answer using RAG with Pinecone
    """
    try:
        # Step 1: Perbaiki typo pada pertanyaan
        langchain_service = get_langchain_service()
        corrected_question = await langchain_service.correct_typo_question(request.question, language=request.language)

        # Step 2: Proses RAG dengan pertanyaan yang sudah diperbaiki
        result = await doc_manager.search_with_qa(
            question=corrected_question,
            session_id=request.session_id,
            language=request.language,
            max_docs=request.max_sources,
            similarity_threshold=request.similarity_threshold
        )
        
        return QuestionAnswerResponse(
            success=result["success"],
            question=corrected_question,  # kembalikan pertanyaan yang sudah diperbaiki
            answer=result.get("answer", ""),
            confidence=result.get("confidence", 0.0),
            sources=result.get("sources", []),
            session_id=request.session_id,
            processing_time=result.get("processing_time", 0.0),
            follow_up_suggestions=result.get("follow_up_suggestions", []),
            message=result["message"]
        )
        
    except Exception as e:
        logger.error(f"Question answering endpoint failed: {e}")
        return QuestionAnswerResponse(
            success=False,
            question=request.question,
            answer="",
            confidence=0.0,
            sources=[],
            session_id=request.session_id,
            processing_time=0.0,
            follow_up_suggestions=[],
            message=f"Question answering failed: {str(e)}"
        )


@router.get("/stats", response_model=KnowledgeBaseStatsResponse)
async def get_knowledge_base_stats(
    doc_manager: DocumentManager = Depends(get_document_manager_dep)
):
    """
    Get knowledge base statistics
    """
    try:
        result = await doc_manager.get_knowledge_base_stats()
        
        return KnowledgeBaseStatsResponse(
            success=result["success"],
            stats=result.get("stats", {}),
            message=result["message"]
        )
        
    except Exception as e:
        logger.error(f"Knowledge base stats endpoint failed: {e}")
        return KnowledgeBaseStatsResponse(
            success=False,
            stats={},
            message=f"Failed to get knowledge base stats: {str(e)}"
        )


@router.delete("/documents/{document_id}")
async def delete_document(
    document_id: str,
    doc_manager: DocumentManager = Depends(get_document_manager_dep)
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
                status_code=status.HTTP_404_NOT_FOUND,
                detail=result["message"]
            )
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Document deletion endpoint failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Document deletion failed: {str(e)}"
        )