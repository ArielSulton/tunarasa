"""
Conversation management endpoints for new schema
"""

import logging
from typing import List
from fastapi import APIRouter, HTTPException, status

from app.models import Conversation, ConversationCreate, ConversationUpdate
from app.models import Message, MessageCreate
from app.core.config import settings

logger = logging.getLogger(__name__)
router = APIRouter()


class ConversationService:
    """Conversation service for database operations"""
    
    async def create_conversation(self, conv_data: ConversationCreate) -> Conversation:
        """Create new conversation"""
        try:
            # Mock implementation - in real app, insert into database
            conversation = Conversation(
                conversation_id=1,
                user_id=conv_data.user_id,
                title=conv_data.title
            )
            return conversation
        except Exception as e:
            logger.error(f"Failed to create conversation: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create conversation"
            )
    
    async def get_conversation(self, conversation_id: int) -> Conversation:
        """Get conversation by ID"""
        try:
            # Mock implementation
            conversation = Conversation(
                conversation_id=conversation_id,
                user_id=1,
                title="ASL Learning Session"
            )
            return conversation
        except Exception as e:
            logger.error(f"Failed to get conversation {conversation_id}: {e}")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Conversation not found"
            )
    
    async def get_user_conversations(self, user_id: int) -> List[Conversation]:
        """Get all conversations for a user"""
        try:
            # Mock implementation
            conversations = [
                Conversation(
                    conversation_id=1,
                    user_id=user_id,
                    title="ASL Learning Session"
                ),
                Conversation(
                    conversation_id=2,
                    user_id=user_id,
                    title="Sign Language Practice"
                )
            ]
            return conversations
        except Exception as e:
            logger.error(f"Failed to get conversations for user {user_id}: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to retrieve conversations"
            )
    
    async def update_conversation(self, conversation_id: int, conv_data: ConversationUpdate) -> Conversation:
        """Update conversation"""
        try:
            conversation = await self.get_conversation(conversation_id)
            
            if conv_data.title is not None:
                conversation.title = conv_data.title
            
            return conversation
        except Exception as e:
            logger.error(f"Failed to update conversation {conversation_id}: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to update conversation"
            )


# Initialize conversation service
conversation_service = ConversationService()


@router.post("/", response_model=Conversation, status_code=status.HTTP_201_CREATED)
async def create_conversation(conv_data: ConversationCreate):
    """Create new conversation"""
    return await conversation_service.create_conversation(conv_data)


@router.get("/{conversation_id}", response_model=Conversation)
async def get_conversation(conversation_id: int):
    """Get conversation by ID"""
    return await conversation_service.get_conversation(conversation_id)


@router.get("/user/{user_id}", response_model=List[Conversation])
async def get_user_conversations(user_id: int):
    """Get all conversations for a user"""
    return await conversation_service.get_user_conversations(user_id)


@router.put("/{conversation_id}", response_model=Conversation)
async def update_conversation(conversation_id: int, conv_data: ConversationUpdate):
    """Update conversation"""
    return await conversation_service.update_conversation(conversation_id, conv_data)