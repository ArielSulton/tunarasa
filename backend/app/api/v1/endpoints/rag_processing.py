"""
RAG Document Processing Endpoints
Process uploaded files from database records into Pinecone RAG system
"""

import logging
from datetime import datetime, timezone
from pathlib import Path

from app.core.database import get_db_session
from app.db.crud import InstitutionCRUD, RagFileCRUD
from app.models.institution import RagFile
from app.services.document_manager import get_document_manager
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)
router = APIRouter()


class ProcessRAGFileRequest(BaseModel):
    """Process RAG file request"""

    rag_file_id: int
    force_reprocess: bool = False


class ProcessRAGFileResponse(BaseModel):
    """Process RAG file response"""

    success: bool
    rag_file_id: int
    document_id: str = None
    processing_status: str
    message: str
    processing_time: float = None
    chunk_count: int = None


@router.post("/process-file", response_model=ProcessRAGFileResponse)
async def process_rag_file(
    request: ProcessRAGFileRequest, db: AsyncSession = Depends(get_db_session)
):
    """
    Process a RAG file from database into Pinecone vector store
    This endpoint bridges the frontend upload with backend RAG processing
    """
    start_time = datetime.now(timezone.utc)

    try:
        # Get RAG file record from database
        rag_file = await RagFileCRUD.get_by_id(db, request.rag_file_id)
        if not rag_file:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"RAG file with ID {request.rag_file_id} not found",
            )

        # Check if file already processed and not forcing reprocess
        if rag_file.processing_status == "completed" and not request.force_reprocess:
            return ProcessRAGFileResponse(
                success=True,
                rag_file_id=request.rag_file_id,
                processing_status=rag_file.processing_status,
                message="File already processed. Use force_reprocess=true to reprocess.",
            )

        # Update status to processing
        await RagFileCRUD.update_status(db, request.rag_file_id, "processing")

        # Check if file exists in shared uploads volume
        file_path = Path(rag_file.file_path)
        if not file_path.is_absolute():
            # Convert relative path to absolute path in shared volume
            shared_uploads_dir = Path("/app/uploads")  # Docker shared volume path
            file_path = shared_uploads_dir / file_path.name
        elif str(file_path).startswith("/uploads/"):
            # Fix old file path prefix - replace /uploads with /app/uploads
            file_path = Path(str(file_path).replace("/uploads/", "/app/uploads/", 1))

        if not file_path.exists():
            logger.error(f"RAG file not found at path: {file_path}")
            await RagFileCRUD.update_status(db, request.rag_file_id, "error")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"File not found at path: {file_path}",
            )

        # Get document manager
        doc_manager = get_document_manager()

        # Resolve institution slug for correct namespace convention `institution_{slug}`
        institution_slug: str | None = None
        try:
            institution = await InstitutionCRUD.get_by_id(db, rag_file.institution_id)
            if institution and institution.slug:
                institution_slug = institution.slug
        except Exception as e:
            logger.warning(
                f"Failed to resolve institution slug for id={rag_file.institution_id}: {e}"
            )

        # Process file into RAG system using institution_slug so DocumentManager builds namespace `institution_{slug}`
        result = await doc_manager.add_document(
            file_path=str(file_path),
            title=rag_file.file_name,
            description=rag_file.description,
            language="id",
            institution_id=rag_file.institution_id,
            institution_slug=institution_slug,
        )

        processing_time = (datetime.now(timezone.utc) - start_time).total_seconds()

        if result["success"]:
            # Update database record with success
            # Normalize and persist the actual namespace used for ingestion
            update_data = {}
            if institution_slug:
                update_data["pinecone_namespace"] = f"institution_{institution_slug}"

            # Extract document ID and chunk count from result
            document_id = result.get("document_id")
            chunk_count = result.get("metadata", {}).get("chunk_count")

            # Update RAG file record
            await RagFileCRUD.update_status(
                db, request.rag_file_id, "completed", **update_data
            )

            logger.info(f"RAG file {request.rag_file_id} processed successfully")

            return ProcessRAGFileResponse(
                success=True,
                rag_file_id=request.rag_file_id,
                document_id=document_id,
                processing_status="completed",
                message=f"RAG file processed successfully in {processing_time:.2f}s",
                processing_time=processing_time,
                chunk_count=chunk_count,
            )
        else:
            # Update database record with error
            error_message = result.get("error", "Unknown processing error")
            await RagFileCRUD.update_status(db, request.rag_file_id, "failed")

            logger.error(
                f"RAG file {request.rag_file_id} processing failed: {error_message}"
            )

            return ProcessRAGFileResponse(
                success=False,
                rag_file_id=request.rag_file_id,
                processing_status="failed",
                message=f"RAG processing failed: {error_message}",
                processing_time=processing_time,
            )

    except HTTPException:
        raise
    except Exception as e:
        # Update database record with error
        processing_time = (datetime.now(timezone.utc) - start_time).total_seconds()
        error_message = str(e)

        try:
            await RagFileCRUD.update_status(db, request.rag_file_id, "failed")
        except Exception as update_error:
            logger.error(f"Failed to update RAG file status: {update_error}")

        logger.error(f"RAG file {request.rag_file_id} processing failed: {e}")

        return ProcessRAGFileResponse(
            success=False,
            rag_file_id=request.rag_file_id,
            processing_status="failed",
            message=f"Processing failed: {error_message}",
            processing_time=processing_time,
        )


@router.post("/batch-process")
async def batch_process_pending_files(
    limit: int = 10,
    institution_id: int = None,
    db: AsyncSession = Depends(get_db_session),
):
    """
    Process multiple pending RAG files in batch
    Useful for processing uploaded files that haven't been processed yet
    """
    try:
        # Get pending RAG files
        from sqlalchemy import select

        stmt = select(RagFile).where(RagFile.processing_status == "pending")
        if institution_id:
            stmt = stmt.where(RagFile.institution_id == institution_id)
        stmt = stmt.limit(limit)

        result = await db.execute(stmt)
        pending_files = result.scalars().all()

        if not pending_files:
            return {
                "success": True,
                "message": "No pending RAG files found",
                "processed_count": 0,
                "results": [],
            }

        results = []
        success_count = 0

        # Process each file
        for rag_file in pending_files:
            try:
                request = ProcessRAGFileRequest(rag_file_id=rag_file.rag_file_id)
                result = await process_rag_file(request, db)
                results.append(result.dict())

                if result.success:
                    success_count += 1

            except Exception as e:
                logger.error(
                    f"Batch processing failed for file {rag_file.rag_file_id}: {e}"
                )
                results.append(
                    {
                        "success": False,
                        "rag_file_id": rag_file.rag_file_id,
                        "processing_status": "failed",
                        "message": f"Batch processing failed: {str(e)}",
                    }
                )

        return {
            "success": True,
            "message": f"Batch processing completed: {success_count}/{len(pending_files)} files processed successfully",
            "processed_count": len(pending_files),
            "success_count": success_count,
            "results": results,
        }

    except Exception as e:
        logger.error(f"Batch processing failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Batch processing failed: {str(e)}",
        )


@router.get("/processing-status/{rag_file_id}")
async def get_processing_status(
    rag_file_id: int, db: AsyncSession = Depends(get_db_session)
):
    """
    Get processing status of a RAG file
    """
    try:
        rag_file = await RagFileCRUD.get_by_id(db, rag_file_id)
        if not rag_file:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"RAG file with ID {rag_file_id} not found",
            )

        return {
            "success": True,
            "rag_file_id": rag_file_id,
            "processing_status": rag_file.processing_status,
            "file_name": rag_file.file_name,
            "created_at": rag_file.created_at,
            "pinecone_namespace": rag_file.pinecone_namespace,
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get processing status: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get processing status: {str(e)}",
        )
