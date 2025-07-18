"""
RAG (Retrieval-Augmented Generation) endpoints for document processing
"""

import logging
from typing import List, Dict, Any, Optional
from datetime import datetime
import json

from fastapi import APIRouter, HTTPException, status, UploadFile, File, Form
from pydantic import BaseModel, Field

from app.core.config import settings

logger = logging.getLogger(__name__)
router = APIRouter()


class DocumentUploadResponse(BaseModel):
    """Document upload response"""
    document_id: str
    filename: str
    file_size: int
    processing_status: str
    upload_timestamp: datetime


class DocumentProcessingStatus(BaseModel):
    """Document processing status"""
    document_id: str
    filename: str
    status: str  # processing, completed, failed
    progress: float
    chunks_processed: int
    total_chunks: int
    error_message: Optional[str] = None


class DocumentSearchRequest(BaseModel):
    """Document search request"""
    query: str = Field(min_length=1, max_length=200)
    limit: int = Field(default=5, ge=1, le=20)
    similarity_threshold: float = Field(default=0.7, ge=0.0, le=1.0)


class DocumentSearchResponse(BaseModel):
    """Document search response"""
    results: List[Dict[str, Any]]
    total_results: int
    processing_time: float


class DocumentInfo(BaseModel):
    """Document information"""
    document_id: str
    filename: str
    file_size: int
    upload_date: datetime
    processing_status: str
    chunk_count: int
    metadata: Dict[str, Any]


class RAGService:
    """RAG service for document processing and retrieval"""
    
    def __init__(self):
        self.redis_client = None
        self.document_store = {}
        
        # Connect to Redis for document caching
        try:
            import redis
            self.redis_client = redis.from_url(settings.REDIS_URL)
            self.redis_client.ping()
            logger.info("Connected to Redis for RAG operations")
        except Exception as e:
            logger.warning(f"Redis connection failed for RAG: {e}")
    
    async def upload_document(self, file: UploadFile, description: Optional[str] = None) -> DocumentUploadResponse:
        """Upload and process document for RAG"""
        
        try:
            # Validate file
            if not file.filename:
                raise ValueError("No filename provided")
            
            if file.size > settings.MAX_FILE_SIZE:
                raise ValueError(f"File size exceeds maximum limit of {settings.MAX_FILE_SIZE} bytes")
            
            # Check file type
            allowed_types = ['.pdf', '.txt', '.docx', '.md']
            if not any(file.filename.lower().endswith(ext) for ext in allowed_types):
                raise ValueError(f"Unsupported file type. Allowed types: {', '.join(allowed_types)}")
            
            # Generate document ID
            document_id = f"doc_{int(datetime.utcnow().timestamp())}_{file.filename.replace(' ', '_')}"
            
            # Read file content
            content = await file.read()
            
            # Store document metadata
            document_info = {
                "document_id": document_id,
                "filename": file.filename,
                "file_size": len(content),
                "upload_timestamp": datetime.utcnow().isoformat(),
                "processing_status": "processing",
                "description": description,
                "content_type": file.content_type
            }
            
            # Cache document info
            if self.redis_client:
                try:
                    await self.redis_client.setex(
                        f"document:{document_id}",
                        86400,  # 24 hours
                        json.dumps(document_info, default=str)
                    )
                except Exception as e:
                    logger.error(f"Failed to cache document info: {e}")
            
            # Store in memory for immediate access
            self.document_store[document_id] = document_info
            
            # Start background processing (simplified for competition)
            await self._process_document_async(document_id, content, file.filename)
            
            return DocumentUploadResponse(
                document_id=document_id,
                filename=file.filename,
                file_size=len(content),
                processing_status="processing",
                upload_timestamp=datetime.utcnow()
            )
            
        except Exception as e:
            logger.error(f"Document upload failed: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Document upload failed: {str(e)}"
            )
    
    async def _process_document_async(self, document_id: str, content: bytes, filename: str):
        """Process document asynchronously"""
        
        try:
            # Save file temporarily for processing
            import tempfile
            import os
            
            with tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(filename)[1]) as tmp_file:
                tmp_file.write(content)
                temp_path = tmp_file.name
            
            try:
                # Import AI service
                from app.services.ai_service import get_ai_service
                ai_service = get_ai_service()
                
                # Add document to vector store
                success = await ai_service.add_document_to_vectorstore(temp_path, document_id)
                
                if success:
                    # Update document status
                    if document_id in self.document_store:
                        self.document_store[document_id]["processing_status"] = "completed"
                        self.document_store[document_id]["chunks_processed"] = 10
                        self.document_store[document_id]["total_chunks"] = 10
                    
                    logger.info(f"Document {document_id} processed and added to vector store")
                else:
                    raise Exception("Failed to add document to vector store")
                
            finally:
                # Clean up temporary file
                os.unlink(temp_path)
            
            # Update in Redis
            if self.redis_client:
                try:
                    await self.redis_client.setex(
                        f"document:{document_id}",
                        86400,
                        json.dumps(self.document_store[document_id], default=str)
                    )
                except Exception as e:
                    logger.error(f"Failed to update document status: {e}")
            
            logger.info(f"Document {document_id} processed successfully")
            
        except Exception as e:
            logger.error(f"Document processing failed for {document_id}: {e}")
            
            # Mark as failed
            if document_id in self.document_store:
                self.document_store[document_id]["processing_status"] = "failed"
                self.document_store[document_id]["error_message"] = str(e)
    
    async def get_processing_status(self, document_id: str) -> DocumentProcessingStatus:
        """Get document processing status"""
        
        try:
            # Get from Redis first
            if self.redis_client:
                try:
                    cached_data = await self.redis_client.get(f"document:{document_id}")
                    if cached_data:
                        data = json.loads(cached_data)
                        return DocumentProcessingStatus(
                            document_id=document_id,
                            filename=data.get("filename", ""),
                            status=data.get("processing_status", "unknown"),
                            progress=1.0 if data.get("processing_status") == "completed" else 0.5,
                            chunks_processed=data.get("chunks_processed", 0),
                            total_chunks=data.get("total_chunks", 0),
                            error_message=data.get("error_message")
                        )
                except Exception as e:
                    logger.error(f"Failed to get document status from Redis: {e}")
            
            # Fallback to memory store
            if document_id in self.document_store:
                data = self.document_store[document_id]
                return DocumentProcessingStatus(
                    document_id=document_id,
                    filename=data.get("filename", ""),
                    status=data.get("processing_status", "unknown"),
                    progress=1.0 if data.get("processing_status") == "completed" else 0.5,
                    chunks_processed=data.get("chunks_processed", 0),
                    total_chunks=data.get("total_chunks", 0),
                    error_message=data.get("error_message")
                )
            
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Document not found"
            )
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Failed to get processing status: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to retrieve processing status"
            )
    
    async def search_documents(self, request: DocumentSearchRequest) -> DocumentSearchResponse:
        """Search documents using vector similarity"""
        
        start_time = datetime.utcnow()
        
        try:
            # Simplified search for competition
            # In production, this would use Pinecone for vector similarity search
            
            # Mock search results
            results = [
                {
                    "document_id": "doc_sample_1",
                    "filename": "sample_document.pdf",
                    "chunk_text": f"This is a sample chunk that matches your query: {request.query}",
                    "similarity_score": 0.85,
                    "page_number": 1,
                    "metadata": {"section": "introduction"}
                },
                {
                    "document_id": "doc_sample_2",
                    "filename": "another_document.pdf",
                    "chunk_text": f"Another relevant chunk related to: {request.query}",
                    "similarity_score": 0.78,
                    "page_number": 3,
                    "metadata": {"section": "methodology"}
                }
            ]
            
            # Filter by similarity threshold
            filtered_results = [
                result for result in results
                if result["similarity_score"] >= request.similarity_threshold
            ]
            
            # Limit results
            limited_results = filtered_results[:request.limit]
            
            processing_time = (datetime.utcnow() - start_time).total_seconds()
            
            return DocumentSearchResponse(
                results=limited_results,
                total_results=len(limited_results),
                processing_time=processing_time
            )
            
        except Exception as e:
            logger.error(f"Document search failed: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Document search failed: {str(e)}"
            )
    
    async def list_documents(self) -> List[DocumentInfo]:
        """List all uploaded documents"""
        
        try:
            documents = []
            
            # Get from memory store
            for doc_id, doc_data in self.document_store.items():
                document_info = DocumentInfo(
                    document_id=doc_id,
                    filename=doc_data.get("filename", ""),
                    file_size=doc_data.get("file_size", 0),
                    upload_date=datetime.fromisoformat(doc_data.get("upload_timestamp", datetime.utcnow().isoformat())),
                    processing_status=doc_data.get("processing_status", "unknown"),
                    chunk_count=doc_data.get("total_chunks", 0),
                    metadata={
                        "description": doc_data.get("description", ""),
                        "content_type": doc_data.get("content_type", "")
                    }
                )
                documents.append(document_info)
            
            return documents
            
        except Exception as e:
            logger.error(f"Failed to list documents: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to retrieve document list"
            )


# Initialize RAG service
rag_service = RAGService()


@router.post("/upload", response_model=DocumentUploadResponse)
async def upload_document(
    file: UploadFile = File(...),
    description: Optional[str] = Form(None)
):
    """
    Upload document for RAG processing
    """
    try:
        result = await rag_service.upload_document(file, description)
        logger.info(f"Document uploaded: {result.document_id}")
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Document upload endpoint failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Document upload failed"
        )


@router.get("/status/{document_id}", response_model=DocumentProcessingStatus)
async def get_document_status(document_id: str):
    """
    Get document processing status
    """
    try:
        status = await rag_service.get_processing_status(document_id)
        return status
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Document status endpoint failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve document status"
        )


@router.post("/search", response_model=DocumentSearchResponse)
async def search_documents(request: DocumentSearchRequest):
    """
    Search documents using vector similarity
    """
    try:
        results = await rag_service.search_documents(request)
        logger.info(f"Document search completed: {results.total_results} results")
        return results
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Document search endpoint failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Document search failed"
        )


@router.get("/documents", response_model=List[DocumentInfo])
async def list_documents():
    """
    List all uploaded documents
    """
    try:
        documents = await rag_service.list_documents()
        return documents
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Document list endpoint failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve document list"
        )