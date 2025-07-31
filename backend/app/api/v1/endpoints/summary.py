"""
Summary and QR code endpoints for conversation downloads
"""

import logging
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, HTTPException, status, Response, Depends, BackgroundTasks
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi.responses import FileResponse
import os

from app.services.qr_service import qr_service
from app.models import Conversation, Message, Note
from app.core.config import settings
from app.core.database import get_db_session
from app.db.crud import MessageCRUD
from app.db.crud import NoteCRUD
from app.services.langchain_service import get_langchain_service 

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
    format_type: str = Field(default="text", pattern="^(text|json|html)$")
    include_qr: bool = Field(default=True)


class SummaryResponse(BaseModel):
    """Summary generation response"""
    conversation_id: int
    summary_content: str
    format_type: str
    qr_code: Optional[QRCodeResponse] = None
    download_url: Optional[str] = None


@router.post("/generate", response_model=SummaryResponse)
async def generate_conversation_summary(request: SummaryRequest, db: AsyncSession = Depends(get_db_session)):
    """
    Generate downloadable summary for conversation with QR code
    """
    try:
        # Get conversation data (mock for now)
        conversation_data = {
            "conversation_id": request.conversation_id,
            "user_id": request.user_id,
            "title": f"Percakapan #{request.conversation_id}",
            "created_at": "2025-07-18T10:30:00Z"  # TODO: fetch real created_at if needed
        }
        
        # Fetch messages from database
        db_messages = await MessageCRUD.get_by_conversation(db, request.conversation_id)
        messages = [
            {
                "message_id": msg.message_id,
                "sender_type": "user" if msg.is_user else "ai",
                "content": msg.message_content,
                "created_at": msg.created_at.isoformat() if hasattr(msg, "created_at") else None
            }
            for msg in db_messages
        ]
         # Concatenate conversation content
           # Concatenate conversation content
        conversation_text = "\n".join([msg['content'] for msg in messages])

        langchain_service = get_langchain_service()
        summary_text = await langchain_service.generate_summary(conversation_text)
        title = await langchain_service.generate_title_of_summary(summary_text)

        
        # Create summary document
        summary_content = qr_service.create_summary_document(
            title,
            summary_text,
            conversation_data, 
            messages, 
            request.format_type
        )
        
        # Generate QR code if requested
        qr_code_data = None
        download_url = None
        
        if request.include_qr:
            summary_data = {
                "title": title,
                "message_count": len(messages)
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
            print(f"Download URL: {download_url}")

        try:
            existing_note = await NoteCRUD.get_by_conversation(db, request.conversation_id)
            if existing_note:
                # Update the existing note with a new title and content
                await NoteCRUD.update(
                    db,
                    note_id=existing_note[0].note_id,  # Assuming we want to update the first note for the conversation
                    title=[title],  # Set the title when updating
                    note_content=summary_text,
                    url_access=qr_result["access_token"]  # Set url_access when updating
                )
            else:
                # Create a new note if it doesn't exist
                await NoteCRUD.create(
                    db,
                    conversation_id=request.conversation_id,
                    note_content=summary_text,
                    title=[title],  # Set the title when creating a new note
                    url_access=qr_result["access_token"]  # Set url_access when creating
                )
        except Exception as e:
            logger.error(f"Failed to create or update note: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create or update conversation note"
            )

        
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
async def download_summary(access_token: str, format: str = "text", db: AsyncSession = Depends(get_db_session)):
    """
    Download conversation summary using QR code access token
    """
    try:
        # In production, validate access_token from database/Redis and get conversation_id
        # For now, you must implement logic to map access_token to conversation_id
        # Here, we use a placeholder conversation_id for demonstration
    
        
        # conversation_data = {
        #     "conversation_id": conversation_id,
        #     "user_id": user_id,
        #     "title": f"Percakapan #{conversation_id}",
        #     "created_at": "2025-07-18T10:30:00Z"  # TODO: fetch real created_at if needed
        # }
        

        notes = await NoteCRUD.get_by_url_access(db, access_token)
        if not notes:
            raise HTTPException(status_code=404, detail="Note not found")
        note = notes[0]  # Ambil satu note (atau sesuaikan jika ingin multi)

        # 2. Siapkan data
        title = note.title if isinstance(note.title, str) else (note.title[0] if note.title else "")
        note_content = note.note_content
        url_access = note.url_access
        created_at = note.created_at.strftime("%Y-%m-%d %H:%M")

        print(f"Downloading note: {note.note_id}, Title: {title}, Created At: {created_at}, URL Access: {url_access}")

        # filename = f"/home/dimas/tunarasa/assets/note_{note.note_id}.pdf"
        filename = f"/app/assets/note_{note.note_id}.pdf"
        qr_service.create_note_pdf(filename, title, note_content, url_access, created_at)

        return FileResponse(
            filename,
            media_type="application/pdf",
            filename=os.path.basename(filename)
        )
        # # Generate summary content
        # summary_content = qr_service.create_summary_document(
        #     conversation_data,
        #     messages,
        #     format
        # )
        
        # # Set appropriate content type and filename
        # if format == "json":
        #     media_type = "application/json"
        #     filename = f"tunarasa-summary-{access_token[:8]}.json"
        # elif format == "html":
        #     media_type = "text/html"
        #     filename = f"tunarasa-summary-{access_token[:8]}.html"
        # else:
        #     media_type = "text/plain"
        #     filename = f"tunarasa-summary-{access_token[:8]}.txt"
        
        # # Return file download
        # return Response(
        #     content=summary_content.encode('utf-8'),
        #     media_type=media_type,
        #     headers={
        #         "Content-Disposition": f"attachment; filename={filename}",
        #         "Content-Type": f"{media_type}; charset=utf-8"
        #     }
        # )
        
    except Exception as e:
        logger.error(f"Failed to download summary: {e}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Summary not found or access token expired"
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
    

# @router.post("/note/qr", response_model=Dict[str, str])
# async def generate_note_qr(
#     note_id: int,
#     conversation_id: int,
#     note_content: str
# ):
#     """
#     Generate QR code for individual note access
#     """
#     try:
#         qr_result = qr_service.generate_note_qr(
#             note_id,
#             conversation_id, 
#             note_content
#         )
        
#         return {
#             "qr_code_base64": qr_result["qr_code_base64"],
#             "access_token": qr_result["access_token"],
#             "access_url": qr_result["access_url"],
#             "note_preview": note_content[:100] + "..." if len(note_content) > 100 else note_content
#         }
        
#     except Exception as e:
#         logger.error(f"Failed to generate note QR: {e}")
#         raise HTTPException(
#             status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
#             detail="Failed to generate QR code for note"
#         )
