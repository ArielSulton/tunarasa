"""
Conversation management endpoints for saving and retrieving conversations
"""

import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from app.core.database import get_db_session
from app.db.crud import ConversationCRUD
from app.db.models import Conversation, Message
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)
router = APIRouter()


class MessageSaveRequest(BaseModel):
    """Request model for saving a message"""

    message_content: str = Field(..., min_length=1, max_length=10000)
    message_type: str = Field(..., pattern="^(user|assistant|admin|system)$")
    input_method: str = Field(default="text", pattern="^(text|speech|gesture)$")
    confidence: Optional[float] = Field(default=None, ge=0, le=1)
    admin_id: Optional[int] = Field(default=None)
    created_at: str  # ISO format timestamp


class ConversationSaveRequest(BaseModel):
    """Request model for saving a conversation with messages"""

    session_id: str = Field(
        ..., min_length=1, max_length=255, pattern="^[a-zA-Z0-9_-]+$"
    )
    service_mode: str = Field(
        default="full_llm_bot", pattern="^(full_llm_bot|bot_with_admin_validation)$"
    )
    messages: List[MessageSaveRequest] = Field(..., min_items=1)


class ConversationSaveResponse(BaseModel):
    """Response model for conversation save operation"""

    conversation_id: int
    session_id: str
    messages_saved: int
    service_mode: str
    created_at: str


@router.post("/save", response_model=Dict[str, Any])
async def save_conversation(
    request: ConversationSaveRequest, db: AsyncSession = Depends(get_db_session)
):
    """
    Save a complete conversation with messages to the database
    """
    try:
        logger.info(
            f"Saving conversation: session_id={request.session_id}, messages={len(request.messages)}"
        )

        # Create new conversation
        conversation = Conversation(
            session_id=request.session_id,
            service_mode=request.service_mode,
            is_active=True,
            status="active",
            priority="normal",
        )

        db.add(conversation)
        await db.flush()  # Get the conversation_id without committing

        logger.info(f"Created conversation with ID: {conversation.conversation_id}")

        # Save all messages for this conversation
        saved_messages = []
        for msg_data in request.messages:
            # Parse created_at timestamp
            try:
                created_at = datetime.fromisoformat(
                    msg_data.created_at.replace("Z", "+00:00")
                )
            except (ValueError, AttributeError):
                created_at = datetime.now(timezone.utc)

            # Map message types to database schema
            message_type = msg_data.message_type
            if message_type == "assistant":
                message_type = "llm_bot"

            # Convert confidence from 0-1 scale to 0-100 integer scale
            confidence_int = None
            if msg_data.confidence is not None:
                confidence_int = int(msg_data.confidence * 100)

            message = Message(
                conversation_id=conversation.conversation_id,
                message_content=msg_data.message_content,
                message_type=message_type,
                input_method=msg_data.input_method,
                confidence=confidence_int,
                admin_id=msg_data.admin_id,
                is_read=False,
                created_at=created_at,
            )

            db.add(message)
            saved_messages.append(message)

        # Commit all changes
        await db.commit()

        logger.info(
            f"Successfully saved conversation {conversation.conversation_id} with {len(saved_messages)} messages"
        )

        response_data = ConversationSaveResponse(
            conversation_id=conversation.conversation_id,
            session_id=conversation.session_id,
            messages_saved=len(saved_messages),
            service_mode=conversation.service_mode,
            created_at=conversation.created_at.isoformat(),
        )

        return {
            "success": True,
            "message": "Conversation saved successfully",
            "data": response_data.dict(),
        }

    except Exception as e:
        logger.error(f"Failed to save conversation: {e}")
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to save conversation: {str(e)}",
        )


@router.get("/{conversation_id}")
async def get_conversation(
    conversation_id: int, db: AsyncSession = Depends(get_db_session)
):
    """
    Get a conversation with all its messages
    """
    try:
        # Get conversation with messages
        conversation = await ConversationCRUD.get_by_id(db, conversation_id)

        if not conversation:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found"
            )

        # Format messages for response
        messages = []
        if conversation.messages:
            for msg in conversation.messages:
                messages.append(
                    {
                        "message_id": msg.message_id,
                        "content": msg.message_content,
                        "type": msg.message_type,
                        "input_method": msg.input_method,
                        "confidence": msg.confidence,
                        "admin_id": msg.admin_id,
                        "is_read": msg.is_read,
                        "created_at": (
                            msg.created_at.isoformat() if msg.created_at else None
                        ),
                    }
                )

        return {
            "success": True,
            "data": {
                "conversation_id": conversation.conversation_id,
                "session_id": conversation.session_id,
                "service_mode": conversation.service_mode,
                "status": conversation.status,
                "priority": conversation.priority,
                "is_active": conversation.is_active,
                "created_at": (
                    conversation.created_at.isoformat()
                    if conversation.created_at
                    else None
                ),
                "messages": messages,
            },
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get conversation {conversation_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve conversation",
        )
