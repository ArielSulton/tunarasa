"""
Summary and QR code endpoints for conversation downloads
"""

import json
import logging
from typing import Any, Dict, Optional

from app.core.database import get_db_session
from app.db.crud import MessageCRUD, NoteCRUD
from app.services.langchain_service import get_langchain_service
from app.services.qr_service import qr_service
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)
router = APIRouter()


def _clean_title_from_database(raw_title: str) -> str:
    """
    Clean title from database that might contain malformed JSON array responses
    """
    try:
        # Remove common prefixes and suffixes
        cleaned = raw_title.strip()

        # Remove "JUDUL:" prefix if present
        if cleaned.upper().startswith("JUDUL:"):
            cleaned = cleaned[6:].strip()

        # Check if response looks like JSON array string representation
        if cleaned.startswith("[") and "," in cleaned and cleaned.endswith("]"):
            try:
                # Try to parse as JSON array and join characters
                char_array = json.loads(cleaned)
                if isinstance(char_array, list):
                    # Join characters to form the actual title
                    cleaned = "".join(str(char) for char in char_array)
            except (json.JSONDecodeError, TypeError):
                # Try to fix the JSON by replacing single quotes with double quotes
                try:
                    fixed_json = cleaned.replace("'", '"')
                    char_array = json.loads(fixed_json)
                    if isinstance(char_array, list):
                        cleaned = "".join(str(char) for char in char_array)
                except (json.JSONDecodeError, TypeError):
                    # Manual parsing fallback
                    cleaned = cleaned.strip("[]")
                    cleaned = cleaned.replace("'", "").replace('"', "")
                    if "," in cleaned:
                        chars = [char.strip() for char in cleaned.split(",")]
                        cleaned = "".join(chars)

        # Remove extra quotes and whitespace
        cleaned = cleaned.strip("\"'")

        # Remove remaining JSON artifacts like { and }
        cleaned = cleaned.replace("{", "").replace("}", "")

        # Add spaces around colon for better readability
        cleaned = cleaned.replace(":", ": ")

        # Fix concatenated words by adding proper spacing
        cleaned = _add_proper_spacing(cleaned)

        # Fallback if still looks malformed or too short
        if len(cleaned) < 5:
            return "Ringkasan Percakapan Tunarasa"

        return cleaned

    except Exception as e:
        logger.error(f"Failed to clean title from database: {e}")
        return "Ringkasan Percakapan Tunarasa"


def _add_proper_spacing(text: str) -> str:
    """
    Add proper spacing between concatenated words using pattern-based approach
    """

    try:
        # If text already has proper spacing, return as is
        if " " in text and not _has_concatenated_words(text):
            return text

        # Apply basic spacing patterns
        return _apply_basic_spacing_patterns(text)

    except Exception as e:
        logger.error(f"Failed to add proper spacing: {e}")
        return text


def _has_concatenated_words(text: str) -> bool:
    """
    Check if text has concatenated words (camelCase or multiple capitals)
    """
    import re

    # Check for camelCase pattern or multiple consecutive capitals
    return bool(re.search(r"[a-z][A-Z]|[A-Z]{2,}[a-z]", text))


def _apply_basic_spacing_patterns(text: str) -> str:
    """
    Apply basic spacing patterns for common cases
    """
    import re

    # Handle specific Indonesian connectors first
    result = re.sub(r"([a-z])dan([A-Z])", r"\1 dan \2", text)

    # Generic pattern: lowercase followed by uppercase
    result = re.sub(r"([a-z])([A-Z])", r"\1 \2", result)

    # Handle remaining "dan" patterns after generic split
    result = re.sub(r"(?<!\w)dan([A-Z])", r"dan \1", result)
    result = re.sub(r"([a-z])dan(?!\w)", r"\1 dan", result)

    # Handle common abbreviations that got split incorrectly
    result = re.sub(r"SIM ([A-Z])", r"SIM\1", result)  # Keep SIMBaru as SIMBaru
    result = re.sub(
        r"([A-Z]{2,}) ([A-Z][a-z])", r"\1\2", result
    )  # Keep abbreviations together

    # Space before parentheses
    result = re.sub(r"([a-z])\(", r"\1 (", result)

    # Clean up multiple spaces
    result = re.sub(r"\s+", " ", result)

    return result.strip()


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
async def generate_conversation_summary(
    request: SummaryRequest, db: AsyncSession = Depends(get_db_session)
):
    """
    Generate downloadable summary for conversation with QR code
    """
    try:
        # Get conversation data (mock for now)
        conversation_data = {
            "conversation_id": request.conversation_id,
            "user_id": request.user_id,
            "title": f"Percakapan #{request.conversation_id}",
            "created_at": "2025-07-18T10:30:00Z",  # TODO: fetch real created_at if needed
        }

        # Fetch messages from database
        db_messages = await MessageCRUD.get_by_conversation(db, request.conversation_id)
        messages = [
            {
                "message_id": msg.message_id,
                "sender_type": "user" if msg.message_type == "user" else "ai",
                "content": msg.message_content,
                "created_at": (
                    msg.created_at.isoformat() if hasattr(msg, "created_at") else None
                ),
            }
            for msg in db_messages
        ]

        # Concatenate conversation content
        conversation_text = "\n".join([msg["content"] for msg in messages])

        langchain_service = get_langchain_service()
        summary_text = await langchain_service.generate_summary(conversation_text)
        title = await langchain_service.generate_title_of_summary(summary_text)

        # Log the raw title for debugging
        logger.info(f"Generated title: {repr(title)}")

        # Additional cleanup for title in case LLM returns malformed response
        if not title or len(title.strip()) < 5:
            title = "Ringkasan Percakapan Tunarasa"
            logger.warning(f"Title was too short or empty, using fallback: {title}")

        # Create summary document
        summary_content = qr_service.create_summary_document(
            title, summary_text, conversation_data, messages, request.format_type
        )

        # Generate QR code if requested
        qr_code_data = None
        download_url = None

        if request.include_qr:
            summary_data = {"title": title, "message_count": len(messages)}

            qr_result = qr_service.generate_conversation_summary_qr(
                request.conversation_id, request.user_id, summary_data
            )

            # Calculate actual expiry date (7 days from now)
            from datetime import datetime, timedelta, timezone

            expires_at = datetime.now(timezone.utc) + timedelta(days=7)

            qr_code_data = QRCodeResponse(
                qr_code_base64=qr_result["qr_code_base64"],
                access_token=qr_result["access_token"],
                download_url=qr_result["download_url"],
                expires_at=expires_at.isoformat() + "Z",
                summary_preview=summary_data,
            )

            download_url = qr_result["download_url"]
            print(f"Download URL: {download_url}")

        try:
            access_token = qr_result["access_token"]
            print(f"Generated access token: {access_token}")
            print(f"QR result keys: {list(qr_result.keys())}")
            print(f"QR download URL: {qr_result['download_url']}")

            existing_note = await NoteCRUD.get_by_conversation(
                db, request.conversation_id
            )
            if existing_note:
                # Update the existing note with a new title and content
                await NoteCRUD.update(
                    db,
                    note_id=existing_note[
                        0
                    ].note_id,  # Assuming we want to update the first note for the conversation
                    title=title,  # Set the title when updating
                    note_content=summary_text,
                    url_access=access_token,  # Set url_access when updating
                )
                print(
                    f"Updated note {existing_note[0].note_id} with access token: {access_token}"
                )
            else:
                # Create a new note if it doesn't exist
                created_note = await NoteCRUD.create(
                    db,
                    conversation_id=request.conversation_id,
                    note_content=summary_text,
                    title=title,  # Set the title when creating a new note
                    url_access=access_token,  # Set url_access when creating
                )
                print(
                    f"Created new note with ID: {created_note.note_id} and access token: {access_token}"
                )
        except Exception as e:
            logger.error(f"Failed to create or update note: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create or update conversation note",
            )
        return SummaryResponse(
            conversation_id=request.conversation_id,
            summary_content=summary_content,
            format_type=request.format_type,
            qr_code=qr_code_data,
            download_url=download_url,
        )

    except Exception as e:
        logger.error(f"Failed to generate summary: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate conversation summary",
        )


@router.get("/{access_token}")
async def download_summary(
    access_token: str,
    format_type: str = "text",
    db: AsyncSession = Depends(get_db_session),
):
    """
    Download conversation summary using QR code access token
    """
    try:
        print(f"Looking for access token: {access_token}")
        print(f"Requested format: {format_type}")  # Use format_type parameter
        # Validate access_token from database and get note
        notes = await NoteCRUD.get_by_url_access(db, access_token)
        print(f"Found {len(notes) if notes else 0} notes with access token")

        # Debug: Let's see what notes exist in the database
        from app.db.models import Note
        from sqlalchemy import select

        stmt = select(Note)
        result = await db.execute(stmt)
        all_notes = result.scalars().all()
        print(f"Total notes in database: {len(all_notes)}")
        for note in all_notes:
            print(
                f"Note {note.note_id}: url_access='{note.url_access}', conversation_id={note.conversation_id}"
            )

        if not notes:
            print("No notes found with the provided access token")
            raise HTTPException(status_code=404, detail="Note not found")
        note = notes[0]  # Get first note (or adjust if you want multi)
        print(f"Using note ID: {note.note_id}")

        # Prepare data with title cleaning
        raw_title = (
            note.title
            if isinstance(note.title, str)
            else (str(note.title) if note.title else "Ringkasan Percakapan Tunarasa")
        )

        # Clean the title to handle malformed JSON array responses
        title = _clean_title_from_database(raw_title)
        note_content = note.note_content
        url_access = note.url_access
        created_at = note.created_at.strftime("%Y-%m-%d %H:%M")

        print(
            f"Downloading note: {note.note_id}, Title: {title}, Created At: {created_at}, URL Access: {url_access}"
        )

        # Create PDF file in temp directory
        import os
        import tempfile

        # Create temp directory that's writable
        temp_dir = tempfile.mkdtemp()
        filename = os.path.join(temp_dir, f"note_{note.note_id}.pdf")

        qr_service.create_note_pdf(
            filename, title, note_content, url_access, created_at
        )

        # Return file response with cleanup
        response = FileResponse(
            filename, media_type="application/pdf", filename=os.path.basename(filename)
        )

        # Schedule cleanup of temp file after response
        import atexit
        import shutil

        atexit.register(lambda: shutil.rmtree(temp_dir, ignore_errors=True))

        return response
    except Exception as e:
        logger.error(f"Failed to download summary: {e}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Summary not found or access token expired",
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
            "qr_generated_at": "2025-07-18T10:35:00Z",
        }

        return {
            "note": note_data,
            "access_token": access_token,
            "expires_at": "2025-07-25T10:35:00Z",
        }

    except Exception as e:
        logger.error(f"Failed to access note: {e}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Note not found or access token expired",
        )
