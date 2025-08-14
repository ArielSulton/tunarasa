"""
Institution Management API Endpoints

Handles institution CRUD operations, file uploads, and RAG processing
"""

import logging
from typing import Dict, Optional

from app.api.middleware.auth import get_current_admin_user
from app.models.api_response import ApiResponse, ResponseMetadata
from app.services.institution_service import InstitutionService
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel

logger = logging.getLogger(__name__)

router = APIRouter()
institution_service = InstitutionService()


# Request/Response Models
class CreateInstitutionRequest(BaseModel):
    name: str
    slug: str
    description: Optional[str] = None
    logo_url: Optional[str] = None
    contact_info: Optional[Dict] = None


class InstitutionResponse(BaseModel):
    institution_id: int
    name: str
    slug: str
    description: Optional[str]
    logo_url: Optional[str]
    contact_info: Optional[Dict]
    is_active: bool
    created_at: str
    updated_at: str


class RagFileResponse(BaseModel):
    rag_file_id: int
    file_name: str
    file_type: str
    file_size: Optional[int]
    description: Optional[str]
    processing_status: str
    pinecone_namespace: Optional[str]
    document_count: Optional[int]
    embedding_model: Optional[str]
    processing_error: Optional[str]
    is_active: bool
    processed_at: Optional[str]
    created_at: str
    updated_at: str


# Public Endpoints (no auth required)
@router.get("/public/institutions")
async def get_public_institutions():
    """Get all active institutions for public display"""
    try:
        institutions = await institution_service.get_institutions(
            active_only=True, include_stats=True
        )

        metadata = ResponseMetadata(
            message=f"Retrieved {len(institutions)} active institutions"
        )
        return ApiResponse(
            success=True,
            data={"institutions": institutions},
            metadata=metadata,
        )

    except Exception as e:
        logger.error(f"Error in get_public_institutions: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/public/institutions/{slug}")
async def get_public_institution_by_slug(slug: str):
    """Get institution details by slug (public access)"""
    try:
        institution = await institution_service.get_institution_by_slug(slug)
        if not institution:
            raise HTTPException(status_code=404, detail="Institution not found")

        # Get RAG files for this institution
        rag_files = await institution_service.get_institution_rag_files(
            institution.institution_id, active_only=True
        )

        institution_data = {
            "institutionId": institution.institution_id,
            "name": institution.name,
            "slug": institution.slug,
            "description": institution.description,
            "logoUrl": institution.logo_url,
            "contactInfo": institution.contact_info,
            "isActive": institution.is_active,
            "createdAt": institution.created_at.isoformat(),
            "updatedAt": institution.updated_at.isoformat(),
            "ragFiles": rag_files,
        }

        metadata = ResponseMetadata(
            message=f"Retrieved institution: {institution.name}"
        )
        return ApiResponse(
            success=True,
            data=institution_data,
            metadata=metadata,
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in get_public_institution_by_slug: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# Admin Endpoints (auth required)
@router.post("/admin/institutions")
async def create_institution(
    request: CreateInstitutionRequest, current_user=Depends(get_current_admin_user())
):
    """Create a new institution (admin only)"""
    try:
        institution = await institution_service.create_institution(
            name=request.name,
            slug=request.slug,
            description=request.description,
            logo_url=request.logo_url,
            contact_info=request.contact_info,
            created_by=current_user.user_id,
        )

        metadata = ResponseMetadata(
            message=f"Institution '{institution.name}' created successfully"
        )
        return ApiResponse(
            success=True,
            data={
                "institutionId": institution.institution_id,
                "name": institution.name,
                "slug": institution.slug,
            },
            metadata=metadata,
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in create_institution: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/admin/institutions")
async def get_all_institutions(
    include_stats: bool = True, current_user=Depends(get_current_admin_user())
):
    """Get all institutions with stats (admin only)"""
    try:
        institutions = await institution_service.get_institutions(
            active_only=False, include_stats=include_stats
        )

        metadata = ResponseMetadata(
            message=f"Retrieved {len(institutions)} institutions"
        )
        return ApiResponse(
            success=True,
            data={"institutions": institutions},
            metadata=metadata,
        )

    except Exception as e:
        logger.error(f"Error in get_all_institutions: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/admin/institutions/{institution_id}/rag-files")
async def upload_rag_file(
    institution_id: int,
    file: UploadFile = File(...),
    description: Optional[str] = Form(None),
    current_user=Depends(get_current_admin_user()),
):
    """Upload a RAG file for an institution (admin only)"""
    try:
        rag_file = await institution_service.upload_rag_file(
            institution_id=institution_id,
            file=file,
            description=description,
            created_by=current_user.user_id,
        )

        metadata = ResponseMetadata(
            message=f"File '{file.filename}' uploaded successfully and queued for processing"
        )
        return ApiResponse(
            success=True,
            data={
                "ragFileId": rag_file.rag_file_id,
                "fileName": rag_file.file_name,
                "processingStatus": rag_file.processing_status,
            },
            metadata=metadata,
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in upload_rag_file: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/admin/institutions/{institution_id}/rag-files")
async def get_institution_rag_files(
    institution_id: int, current_user=Depends(get_current_admin_user())
):
    """Get RAG files for an institution (admin only)"""
    try:
        rag_files = await institution_service.get_institution_rag_files(
            institution_id=institution_id, active_only=False
        )

        metadata = ResponseMetadata(message=f"Retrieved {len(rag_files)} RAG files")
        return ApiResponse(
            success=True,
            data={"ragFiles": rag_files},
            metadata=metadata,
        )

    except Exception as e:
        logger.error(f"Error in get_institution_rag_files: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/admin/rag-files/{rag_file_id}")
async def delete_rag_file(
    rag_file_id: int, current_user=Depends(get_current_admin_user())
):
    """Delete a RAG file (admin only)"""
    try:
        success = await institution_service.delete_rag_file(
            rag_file_id=rag_file_id, user_id=current_user.user_id
        )

        metadata = ResponseMetadata(message="RAG file deleted successfully")
        return ApiResponse(
            success=success,
            data={"ragFileId": rag_file_id},
            metadata=metadata,
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in delete_rag_file: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/admin/institutions/{institution_id}/stats")
async def get_institution_stats(
    institution_id: int, current_user=Depends(get_current_admin_user())
):
    """Get comprehensive stats for an institution (admin only)"""
    try:
        stats = await institution_service.get_institution_stats(institution_id)

        metadata = ResponseMetadata(
            message=f"Retrieved stats for institution {institution_id}"
        )
        return ApiResponse(
            success=True,
            data=stats,
            metadata=metadata,
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in get_institution_stats: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# Health check endpoint
@router.get("/health")
async def institution_health_check():
    """Health check for institution service"""
    metadata = ResponseMetadata(message="Institution service is running")
    return ApiResponse(
        success=True,
        data={"status": "healthy", "service": "institution-management"},
        metadata=metadata,
    )
