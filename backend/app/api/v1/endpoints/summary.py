"""
Summary and QR code endpoints for conversation downloads
"""

import logging
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, HTTPException, status, Response
from pydantic import BaseModel, Field

from app.services.qr_service import qr_service
from app.models import Conversation, Message, Note
from app.core.config import settings

logger = logging.getLogger(__name__)
router = APIRouter()


class QRCodeResponse(BaseModel):
    """QR code generation response"""
    qr_code_base64: str
    access_token: str
    download_url: str
    expires_at: str
    summary_preview: Dict[str, Any]


class SummaryRequest(BaseModel):
    """Request for generating conversation summary"""
    conversation_id: int
    user_id: int
    format_type: str = Field(default="text", regex="^(text|json|html)$")
    include_qr: bool = Field(default=True)


class SummaryResponse(BaseModel):
    """Summary generation response"""
    conversation_id: int
    summary_content: str
    format_type: str
    qr_code: Optional[QRCodeResponse] = None
    download_url: Optional[str] = None


@router.post("/generate", response_model=SummaryResponse)
async def generate_conversation_summary(request: SummaryRequest):
    """
    Generate downloadable summary for conversation with QR code
    """
    try:
        # Get conversation data (mock for now)
        conversation_data = {
            "conversation_id": request.conversation_id,
            "user_id": request.user_id,
            "title": f"Percakapan #{request.conversation_id}",
            "created_at": "2025-07-18T10:30:00Z"
        }
        
        # Get messages (mock for now)
        messages = [
            {
                "message_id": 1,
                "sender_type": "user",
                "content": "Bagaimana cara menandatangani huruf A?",
                "created_at": "2025-07-18T10:30:00Z"
            },
            {
                "message_id": 2,
                "sender_type": "ai",
                "content": "Untuk menandatangani huruf A, buat kepalan tangan dengan tangan dominan Anda dan letakkan ibu jari di samping jari telunjuk.",
                "created_at": "2025-07-18T10:31:00Z"
            }
        ]
        
        # Create summary document
        summary_content = qr_service.create_summary_document(
            conversation_data, 
            messages, 
            request.format_type
        )
        
        # Generate QR code if requested
        qr_code_data = None
        download_url = None
        
        if request.include_qr:
            summary_data = {
                "title": conversation_data["title"],
                "message_count": len(messages),
                "duration": "2 menit",
                "topics": ["Bahasa Isyarat", "Huruf A"]
            }
            
            qr_result = qr_service.generate_conversation_summary_qr(
                request.conversation_id,
                request.user_id,
                summary_data
            )
            
            qr_code_data = QRCodeResponse(
                qr_code_base64=qr_result["qr_code_base64"],
                access_token=qr_result["access_token"],
                download_url=qr_result["download_url"],
                expires_at="2025-07-25T10:30:00Z",  # 7 days from now
                summary_preview=summary_data
            )
            
            download_url = qr_result["download_url"]
        
        return SummaryResponse(
            conversation_id=request.conversation_id,
            summary_content=summary_content,
            format_type=request.format_type,
            qr_code=qr_code_data,
            download_url=download_url
        )
        
    except Exception as e:
        logger.error(f"Failed to generate summary: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate conversation summary"
        )


@router.get("/{access_token}")
async def download_summary(access_token: str, format: str = "text"):
    """
    Download conversation summary using QR code access token
    """
    try:
        # In production, validate access_token from database/Redis
        # For now, return mock summary
        
        conversation_data = {
            "title": "Percakapan Bahasa Isyarat",
            "created_at": "2025-07-18T10:30:00Z"
        }
        
        messages = [
            {
                "sender_type": "user",
                "content": "Bagaimana cara menandatangani huruf A?",
                "created_at": "2025-07-18T10:30:00Z"
            },
            {
                "sender_type": "ai", 
                "content": "Untuk menandatangani huruf A, buat kepalan tangan dengan tangan dominan Anda dan letakkan ibu jari di samping jari telunjuk.",
                "created_at": "2025-07-18T10:31:00Z"
            }
        ]
        
        # Generate summary content
        summary_content = qr_service.create_summary_document(
            conversation_data,
            messages,
            format
        )
        
        # Set appropriate content type and filename
        if format == "json":
            media_type = "application/json"
            filename = f"tunarasa-summary-{access_token[:8]}.json"
        elif format == "html":
            media_type = "text/html"
            filename = f"tunarasa-summary-{access_token[:8]}.html"
        else:
            media_type = "text/plain"
            filename = f"tunarasa-summary-{access_token[:8]}.txt"
        
        # Return file download
        return Response(
            content=summary_content.encode('utf-8'),
            media_type=media_type,
            headers={
                "Content-Disposition": f"attachment; filename={filename}",
                "Content-Type": f"{media_type}; charset=utf-8"
            }
        )
        
    except Exception as e:
        logger.error(f"Failed to download summary: {e}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Summary not found or access token expired"
        )


@router.post("/note/qr", response_model=Dict[str, str])
async def generate_note_qr(
    note_id: int,
    conversation_id: int,
    note_content: str
):
    """
    Generate QR code for individual note access
    """
    try:
        qr_result = qr_service.generate_note_qr(
            note_id,
            conversation_id, 
            note_content
        )
        
        return {
            "qr_code_base64": qr_result["qr_code_base64"],
            "access_token": qr_result["access_token"],
            "access_url": qr_result["access_url"],
            "note_preview": note_content[:100] + "..." if len(note_content) > 100 else note_content
        }
        
    except Exception as e:
        logger.error(f"Failed to generate note QR: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate QR code for note"
        )


@router.get("/note/{access_token}")
async def access_note(access_token: str):
    """
    Access individual note using QR code token
    """
    try:
        # In production, validate access_token and fetch note from database
        # For now, return mock note data
        
        note_data = {
            "note_id": 1,
            "conversation_id": 1,
            "content": "Ringkasan: Pengguna belajar menandatangani huruf A dalam bahasa isyarat Indonesia. AI memberikan panduan langkah demi langkah.",
            "created_at": "2025-07-18T10:32:00Z",
            "qr_generated_at": "2025-07-18T10:35:00Z"
        }
        
        return {
            "note": note_data,
            "access_token": access_token,
            "expires_at": "2025-07-25T10:35:00Z"
        }
        
    except Exception as e:
        logger.error(f"Failed to access note: {e}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Note not found or access token expired"
        )