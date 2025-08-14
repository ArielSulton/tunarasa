"""
Institution Management Service

Handles institution CRUD operations, file uploads, and RAG processing integration
"""

import asyncio
import logging
import shutil
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional

from app.core.database import get_db_session
from app.db.models import Institution, RagFile
from fastapi import HTTPException, UploadFile
from sqlalchemy import and_, desc, func, select
from sqlalchemy.orm import selectinload

logger = logging.getLogger(__name__)


class InstitutionService:
    """Service for managing institutions and their RAG files"""

    def __init__(self):
        self.upload_dir = Path("uploads")
        self.documents_dir = Path("documents")
        self.upload_dir.mkdir(exist_ok=True)
        self.documents_dir.mkdir(exist_ok=True)

        # Services will be initialized on demand to avoid initialization issues
        self._document_manager = None
        self._pinecone_service = None

    @property
    def document_manager(self):
        if self._document_manager is None:
            from app.services.document_manager import get_document_manager

            self._document_manager = get_document_manager()
        return self._document_manager

    @property
    def pinecone_service(self):
        if self._pinecone_service is None:
            from app.services.pinecone_service import get_pinecone_service

            self._pinecone_service = get_pinecone_service()
        return self._pinecone_service

    async def create_institution(
        self,
        name: str,
        slug: str,
        description: Optional[str] = None,
        logo_url: Optional[str] = None,
        contact_info: Optional[Dict] = None,
        created_by: int = 1,
    ) -> Institution:
        """Create a new institution"""
        try:
            async with get_db_session() as db:
                # Check if slug already exists
                existing = await db.execute(
                    select(Institution).where(Institution.slug == slug)
                )
                if existing.scalar_one_or_none():
                    raise HTTPException(
                        status_code=400,
                        detail=f"Institution with slug '{slug}' already exists",
                    )

                institution = Institution(
                    name=name,
                    slug=slug,
                    description=description,
                    logo_url=logo_url,
                    contact_info=contact_info or {},
                    created_by=created_by,
                    is_active=True,
                )

                db.add(institution)
                await db.commit()
                await db.refresh(institution)

                logger.info(
                    f"Created institution: {name} (ID: {institution.institution_id})"
                )
                return institution

        except Exception as e:
            logger.error(f"Error creating institution: {e}")
            raise HTTPException(status_code=500, detail=str(e))

    async def get_institutions(
        self, active_only: bool = True, include_stats: bool = False
    ) -> List[Dict]:
        """Get all institutions with optional statistics"""
        try:
            async with get_db_session() as db:
                # Base query
                query = select(Institution).options(selectinload(Institution.rag_files))

                if active_only:
                    query = query.where(Institution.is_active)

                query = query.order_by(desc(Institution.created_at))
                result = await db.execute(query)
                institutions = result.scalars().all()

                # Convert to dict and add stats if requested
                institutions_data = []
                for institution in institutions:
                    institution_dict = {
                        "institutionId": institution.institution_id,
                        "name": institution.name,
                        "slug": institution.slug,
                        "description": institution.description,
                        "logoUrl": institution.logo_url,
                        "contactInfo": institution.contact_info,
                        "isActive": institution.is_active,
                        "createdAt": institution.created_at,
                        "updatedAt": institution.updated_at,
                    }

                    if include_stats:
                        # Count RAG files and conversations for this institution
                        rag_files_count = len(
                            [rf for rf in institution.rag_files if rf.is_active]
                        )

                        # TODO: Add conversation count when conversations are linked to institutions
                        conversations_count = 0

                        institution_dict["_count"] = {
                            "ragFiles": rag_files_count,
                            "conversations": conversations_count,
                        }

                    institutions_data.append(institution_dict)

                return institutions_data

        except Exception as e:
            logger.error(f"Error fetching institutions: {e}")
            raise HTTPException(status_code=500, detail=str(e))

    async def get_institution_by_slug(self, slug: str) -> Optional[Institution]:
        """Get institution by slug"""
        try:
            async with get_db_session() as db:
                result = await db.execute(
                    select(Institution)
                    .options(selectinload(Institution.rag_files))
                    .where(and_(Institution.slug == slug, Institution.is_active))
                )
                return result.scalar_one_or_none()

        except Exception as e:
            logger.error(f"Error fetching institution by slug {slug}: {e}")
            raise HTTPException(status_code=500, detail=str(e))

    async def upload_rag_file(
        self,
        institution_id: int,
        file: UploadFile,
        description: Optional[str] = None,
        created_by: int = 1,
    ) -> RagFile:
        """Upload and process a RAG file for an institution"""
        try:
            # Validate institution exists
            async with get_db_session() as db:
                institution_result = await db.execute(
                    select(Institution).where(
                        Institution.institution_id == institution_id
                    )
                )
                institution = institution_result.scalar_one_or_none()
                if not institution:
                    raise HTTPException(status_code=404, detail="Institution not found")

            # Validate file type
            allowed_types = {".txt", ".pdf", ".docx", ".md"}
            file_ext = Path(file.filename).suffix.lower()
            if file_ext not in allowed_types:
                raise HTTPException(
                    status_code=400,
                    detail=f"File type {file_ext} not supported. Allowed: {allowed_types}",
                )

            # Generate unique filename
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            safe_filename = f"{institution.slug}_{timestamp}_{file.filename}"
            file_path = self.documents_dir / safe_filename

            # Save file
            with open(file_path, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)

            file_size = file_path.stat().st_size

            # Create RAG file record
            async with get_db_session() as db:
                rag_file = RagFile(
                    institution_id=institution_id,
                    file_name=file.filename,
                    file_type=file_ext.lstrip("."),
                    file_path=str(file_path),
                    file_size=file_size,
                    description=description,
                    processing_status="pending",
                    pinecone_namespace=f"institution_{institution.slug}",
                    created_by=created_by,
                    is_active=True,
                )

                db.add(rag_file)
                await db.commit()
                await db.refresh(rag_file)

            # Process file asynchronously
            asyncio.create_task(self._process_rag_file(rag_file.rag_file_id))

            logger.info(
                f"Uploaded RAG file: {file.filename} for institution {institution.name}"
            )
            return rag_file

        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error uploading RAG file: {e}")
            raise HTTPException(status_code=500, detail=str(e))

    async def _process_rag_file(self, rag_file_id: int):
        """Process RAG file in background"""
        try:
            async with get_db_session() as db:
                # Get RAG file
                result = await db.execute(
                    select(RagFile)
                    .options(selectinload(RagFile.institution))
                    .where(RagFile.rag_file_id == rag_file_id)
                )
                rag_file = result.scalar_one_or_none()
                if not rag_file:
                    logger.error(f"RAG file {rag_file_id} not found")
                    return

                # Update status to processing
                rag_file.processing_status = "processing"
                await db.commit()
                await db.refresh(rag_file)  # Refresh to get latest state

                logger.info(
                    f"Starting processing of RAG file {rag_file_id}: {rag_file.file_name}"
                )
                logger.info(f"File path: {rag_file.file_path}")
                logger.info(
                    f"Institution: {rag_file.institution.name} (slug: {rag_file.institution.slug})"
                )
                logger.info(f"Namespace: {rag_file.pinecone_namespace}")

                # Check if file exists
                file_path = Path(rag_file.file_path)
                if not file_path.exists():
                    error_msg = f"File not found: {file_path}"
                    logger.error(error_msg)
                    rag_file.processing_status = "failed"
                    rag_file.processing_error = error_msg
                    await db.commit()
                    return

                # Process the file using document manager
                try:
                    # Use document manager to process and index the file with correct namespace
                    logger.info(
                        f"Processing RAG file {rag_file.file_name} with namespace: {rag_file.pinecone_namespace}"
                    )

                    result = await self.document_manager.add_document(
                        file_path=rag_file.file_path,
                        title=rag_file.file_name,
                        description=rag_file.description
                        or f"RAG file for {rag_file.institution.name}",
                        author=rag_file.institution.name,
                        language="id",  # Default to Indonesian
                        institution_id=rag_file.institution_id,
                        institution_slug=rag_file.institution.slug,
                    )

                    logger.info(f"Document manager result: {result}")

                    if result["success"]:
                        rag_file.processing_status = "completed"
                        rag_file.processed_at = datetime.utcnow()
                        rag_file.document_count = result["metadata"].get(
                            "chunk_count", 1
                        )
                        rag_file.embedding_model = result["metadata"].get(
                            "embedding_model", "multilingual-e5-large"
                        )
                        logger.info(
                            f"Successfully processed RAG file {rag_file.file_name}"
                        )
                    else:
                        raise Exception(result["message"])

                except Exception as process_error:
                    logger.error(
                        f"Error processing RAG file {rag_file_id}: {process_error}",
                        exc_info=True,
                    )
                    rag_file.processing_status = "failed"
                    rag_file.processing_error = str(process_error)

                await db.commit()

                logger.info(
                    f"Processed RAG file {rag_file.file_name}: {rag_file.processing_status}"
                )

        except Exception as e:
            logger.error(
                f"Fatal error in RAG file background processing for file {rag_file_id}: {e}",
                exc_info=True,
            )

        except Exception as e:
            logger.error(f"Error in RAG file background processing: {e}")

    async def get_institution_rag_files(
        self, institution_id: int, active_only: bool = True
    ) -> List[Dict]:
        """Get RAG files for an institution"""
        try:
            async with get_db_session() as db:
                query = select(RagFile).where(RagFile.institution_id == institution_id)

                if active_only:
                    query = query.where(RagFile.is_active)

                query = query.order_by(desc(RagFile.created_at))
                result = await db.execute(query)
                rag_files = result.scalars().all()

                return [
                    {
                        "ragFileId": rf.rag_file_id,
                        "fileName": rf.file_name,
                        "fileType": rf.file_type,
                        "filePath": rf.file_path,
                        "fileSize": rf.file_size,
                        "description": rf.description,
                        "processingStatus": rf.processing_status,
                        "pineconeNamespace": rf.pinecone_namespace,
                        "documentCount": rf.document_count,
                        "embeddingModel": rf.embedding_model,
                        "processingError": rf.processing_error,
                        "isActive": rf.is_active,
                        "processedAt": rf.processed_at,
                        "createdAt": rf.created_at,
                        "updatedAt": rf.updated_at,
                    }
                    for rf in rag_files
                ]

        except Exception as e:
            logger.error(
                f"Error fetching RAG files for institution {institution_id}: {e}"
            )
            raise HTTPException(status_code=500, detail=str(e))

    async def delete_rag_file(self, rag_file_id: int, user_id: int) -> bool:
        """Delete a RAG file and its associated data"""
        try:
            async with get_db_session() as db:
                # Get RAG file
                result = await db.execute(
                    select(RagFile).where(RagFile.rag_file_id == rag_file_id)
                )
                rag_file = result.scalar_one_or_none()
                if not rag_file:
                    raise HTTPException(status_code=404, detail="RAG file not found")

                # Delete physical file
                file_path = Path(rag_file.file_path)
                if file_path.exists():
                    file_path.unlink()

                # Delete from Pinecone namespace
                try:
                    if rag_file.pinecone_namespace:
                        # Delete all vectors in this namespace
                        await self.pinecone_service.index.delete(
                            filter={"document_id": {"$eq": str(rag_file.rag_file_id)}},
                            namespace=rag_file.pinecone_namespace,
                        )
                        logger.info(
                            f"Deleted vectors from Pinecone namespace: {rag_file.pinecone_namespace}"
                        )
                except Exception as pinecone_error:
                    logger.warning(f"Failed to delete from Pinecone: {pinecone_error}")

                # Mark as inactive instead of hard delete
                rag_file.is_active = False
                rag_file.updated_at = datetime.utcnow()
                await db.commit()

                logger.info(f"Deleted RAG file: {rag_file.file_name}")
                return True

        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error deleting RAG file {rag_file_id}: {e}")
            raise HTTPException(status_code=500, detail=str(e))

    async def get_institution_stats(self, institution_id: int) -> Dict:
        """Get comprehensive statistics for an institution"""
        try:
            async with get_db_session() as db:
                # Get institution
                institution_result = await db.execute(
                    select(Institution).where(
                        Institution.institution_id == institution_id
                    )
                )
                institution = institution_result.scalar_one_or_none()
                if not institution:
                    raise HTTPException(status_code=404, detail="Institution not found")

                # Count RAG files by status
                rag_files_result = await db.execute(
                    select(
                        RagFile.processing_status,
                        func.count(RagFile.rag_file_id).label("count"),
                    )
                    .where(
                        and_(
                            RagFile.institution_id == institution_id,
                            RagFile.is_active,
                        )
                    )
                    .group_by(RagFile.processing_status)
                )
                rag_files_stats = {
                    row.processing_status: row.count for row in rag_files_result
                }

                # TODO: Add conversation and QA stats when linked to institutions

                return {
                    "institutionId": institution_id,
                    "institutionName": institution.name,
                    "ragFiles": {
                        "total": sum(rag_files_stats.values()),
                        "byStatus": rag_files_stats,
                    },
                    "conversations": {
                        "total": 0,  # TODO: Implement
                        "active": 0,
                        "resolved": 0,
                    },
                    "qaLogs": {
                        "total": 0,  # TODO: Implement
                        "lastWeek": 0,
                        "lastMonth": 0,
                    },
                }

        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error getting institution stats {institution_id}: {e}")
            raise HTTPException(status_code=500, detail=str(e))
