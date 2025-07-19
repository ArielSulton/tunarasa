"""
Message management endpoints for new schema
"""

import logging
from typing import List
from fastapi import APIRouter, HTTPException, status

from app.models import Message, MessageCreate, MessageUpdate
from app.core.config import settings

logger = logging.getLogger(__name__)
router = APIRouter()


class MessageService:
    """Message service for database operations"""
    
    async def create_message(self, message_data: MessageCreate) -> Message:
        """Create new message"""
        try:
            # Mock implementation - in real app, insert into database
            message = Message(
                message_id=1,
                conversation_id=message_data.conversation_id,
                sender_type=message_data.sender_type,
                content=message_data.content,
                gesture_data=message_data.gesture_data
            )
            return message
        except Exception as e:
            logger.error(f"Failed to create message: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create message"
            )
    
    async def get_message(self, message_id: int) -> Message:
        """Get message by ID"""
        try:
            # Mock implementation
            message = Message(
                message_id=message_id,
                conversation_id=1,
                sender_type="user",
                content="How do I sign the letter A?",
                gesture_data=None
            )
            return message
        except Exception as e:
            logger.error(f"Failed to get message {message_id}: {e}")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Message not found"
            )
    
    async def get_conversation_messages(self, conversation_id: int) -> List[Message]:
        """Get all messages for a conversation"""
        try:
            # Mock implementation
            messages = [
                Message(
                    message_id=1,
                    conversation_id=conversation_id,
                    sender_type="user",
                    content="How do I sign the letter A?",
                    gesture_data=None
                ),
                Message(
                    message_id=2,
                    conversation_id=conversation_id,
                    sender_type="ai",
                    content="To sign the letter A, make a fist with your dominant hand and place your thumb against the side of your index finger.",
                    gesture_data=None
                )
            ]
            return messages
        except Exception as e:
            logger.error(f"Failed to get messages for conversation {conversation_id}: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to retrieve messages"
            )
    
    async def update_message(self, message_id: int, message_data: MessageUpdate) -> Message:
        """Update message"""
        try:
            message = await self.get_message(message_id)
            
            if message_data.content is not None:
                message.content = message_data.content
            if message_data.gesture_data is not None:
                message.gesture_data = message_data.gesture_data
            
            return message
        except Exception as e:
            logger.error(f"Failed to update message {message_id}: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to update message"
            )


# Initialize message service
message_service = MessageService()


@router.post("/", response_model=Message, status_code=status.HTTP_201_CREATED)
async def create_message(message_data: MessageCreate):
    """Create new message"""
    return await message_service.create_message(message_data)


@router.get("/{message_id}", response_model=Message)
async def get_message(message_id: int):
    """Get message by ID"""
    return await message_service.get_message(message_id)


@router.get("/conversation/{conversation_id}", response_model=List[Message])
async def get_conversation_messages(conversation_id: int):
    """Get all messages for a conversation"""
    return await message_service.get_conversation_messages(conversation_id)


@router.put("/{message_id}", response_model=Message)
async def update_message(message_id: int, message_data: MessageUpdate):
    """Update message"""
    return await message_service.update_message(message_id, message_data)