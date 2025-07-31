"""
CRUD operations for all database models
Provides async database operations matching the Drizzle schema
"""

from typing import List, Optional, Dict, Any
from sqlalchemy import select, update, delete, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from .models import User, Conversation, Message, Note, Role, Gender


class UserCRUD:
    """CRUD operations for User model"""
    
    @staticmethod
    async def create(db: AsyncSession, clerk_user_id: Optional[int] = None, 
                    full_name: Optional[str] = None, role_id: int = 1, 
                    gender_id: int = 1) -> User:
        """Create a new user"""
        user = User(
            clerk_user_id=clerk_user_id,
            full_name=full_name,
            role_id=role_id,
            gender_id=gender_id
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
        return user
    
    @staticmethod
    async def get_by_id(db: AsyncSession, user_id: int) -> Optional[User]:
        """Get user by ID with relationships"""
        stmt = select(User).options(
            selectinload(User.role),
            selectinload(User.gender),
            selectinload(User.conversations)
        ).where(User.user_id == user_id)
        result = await db.execute(stmt)
        return result.scalar_one_or_none()
    
    @staticmethod
    async def get_by_clerk_id(db: AsyncSession, clerk_user_id: int) -> Optional[User]:
        """Get user by Clerk ID"""
        stmt = select(User).options(
            selectinload(User.role),
            selectinload(User.gender)
        ).where(User.clerk_user_id == clerk_user_id)
        result = await db.execute(stmt)
        return result.scalar_one_or_none()
    
    @staticmethod
    async def get_all(db: AsyncSession, skip: int = 0, limit: int = 100) -> List[User]:
        """Get all users with pagination"""
        stmt = select(User).options(
            selectinload(User.role),
            selectinload(User.gender)
        ).offset(skip).limit(limit)
        result = await db.execute(stmt)
        return result.scalars().all()
    
    @staticmethod
    async def update(db: AsyncSession, user_id: int, **updates) -> Optional[User]:
        """Update user by ID"""
        stmt = update(User).where(User.user_id == user_id).values(**updates)
        await db.execute(stmt)
        await db.commit()
        return await UserCRUD.get_by_id(db, user_id)
    
    @staticmethod
    async def delete(db: AsyncSession, user_id: int) -> bool:
        """Delete user by ID"""
        stmt = delete(User).where(User.user_id == user_id)
        result = await db.execute(stmt)
        await db.commit()
        return result.rowcount > 0


class ConversationCRUD:
    """CRUD operations for Conversation model"""
    
    @staticmethod
    async def create(db: AsyncSession, user_id: int, is_active: bool = True) -> Conversation:
        """Create a new conversation"""
        conversation = Conversation(user_id=user_id, is_active=is_active)
        db.add(conversation)
        await db.commit()
        await db.refresh(conversation)
        return conversation
    
    @staticmethod
    async def get_by_id(db: AsyncSession, conversation_id: int) -> Optional[Conversation]:
        """Get conversation by ID with relationships"""
        stmt = select(Conversation).options(
            selectinload(Conversation.user),
            selectinload(Conversation.messages),
            selectinload(Conversation.notes)
        ).where(Conversation.conversation_id == conversation_id)
        result = await db.execute(stmt)
        return result.scalar_one_or_none()
    
    @staticmethod
    async def get_by_user(db: AsyncSession, user_id: int, active_only: bool = True) -> List[Conversation]:
        """Get conversations by user ID"""
        stmt = select(Conversation).options(
            selectinload(Conversation.messages),
            selectinload(Conversation.notes)
        ).where(Conversation.user_id == user_id)
        
        if active_only:
            stmt = stmt.where(Conversation.is_active == True)
            
        result = await db.execute(stmt)
        return result.scalars().all()
    
    @staticmethod
    async def update(db: AsyncSession, conversation_id: int, **updates) -> Optional[Conversation]:
        """Update conversation by ID"""
        stmt = update(Conversation).where(Conversation.conversation_id == conversation_id).values(**updates)
        await db.execute(stmt)
        await db.commit()
        return await ConversationCRUD.get_by_id(db, conversation_id)
    
    @staticmethod
    async def delete(db: AsyncSession, conversation_id: int) -> bool:
        """Delete conversation by ID"""
        stmt = delete(Conversation).where(Conversation.conversation_id == conversation_id)
        result = await db.execute(stmt)
        await db.commit()
        return result.rowcount > 0


class MessageCRUD:
    """CRUD operations for Message model"""
    
    @staticmethod
    async def create(db: AsyncSession, conversation_id: int, message_content: str, 
                    is_user: bool = False) -> Message:
        """Create a new message"""
        message = Message(
            conversation_id=conversation_id,
            message_content=message_content,
            is_user=is_user
        )
        db.add(message)
        await db.commit()
        await db.refresh(message)
        return message
    
    @staticmethod
    async def get_by_conversation(db: AsyncSession, conversation_id: int) -> List[Message]:
        """Get all messages for a conversation"""
        stmt = select(Message).where(Message.conversation_id == conversation_id).order_by(Message.created_at)
        result = await db.execute(stmt)
        return result.scalars().all()
    
    @staticmethod
    async def get_by_id(db: AsyncSession, message_id: int) -> Optional[Message]:
        """Get message by ID"""
        stmt = select(Message).where(Message.message_id == message_id)
        result = await db.execute(stmt)
        return result.scalar_one_or_none()
    
    @staticmethod
    async def delete(db: AsyncSession, message_id: int) -> bool:
        """Delete message by ID"""
        stmt = delete(Message).where(Message.message_id == message_id)
        result = await db.execute(stmt)
        await db.commit()
        return result.rowcount > 0


class NoteCRUD:
    """CRUD operations for Note model"""
    
    @staticmethod
    async def create(db: AsyncSession, conversation_id: int, note_content: str, title: Optional[str] = None,
                    url_access: Optional[str] = None) -> Note:
        """Create a new note"""
        note = Note(
            conversation_id=conversation_id,
            note_content=note_content,
            title=[title],  # Include the new title column
            url_access=url_access  # Include url_access column
        )
        db.add(note)
        await db.commit()
        await db.refresh(note)
        return note

    
    @staticmethod
    async def update(db: AsyncSession, note_id: int, title: Optional[str] = None, note_content: Optional[str] = None,
                    url_access: Optional[str] = None) -> Optional[Note]:
        """Update note by ID"""
        stmt = update(Note).where(Note.note_id == note_id).values(
            title=title, 
            note_content=note_content, 
            url_access=url_access  # Ensure url_access is included in the update query
        )
        await db.execute(stmt)
        await db.commit()
        return await NoteCRUD.get_by_id(db, note_id)

    
    @staticmethod
    async def get_by_conversation(db: AsyncSession, conversation_id: int) -> List[Note]:
        """Get all notes for a conversation"""
        stmt = select(Note).where(Note.conversation_id == conversation_id).order_by(Note.created_at)
        result = await db.execute(stmt)
        return result.scalars().all()
    
    @staticmethod
    async def get_by_url_access(db: AsyncSession, url_access: str) -> List[Note]:
        """Get all notes for a given URL access"""
        stmt = select(Note).where(Note.url_access == url_access).order_by(Note.created_at)
        result = await db.execute(stmt)
        return result.scalars().all()
    
    @staticmethod
    async def get_by_id(db: AsyncSession, note_id: int) -> Optional[Note]:
        """Get note by ID"""
        stmt = select(Note).where(Note.note_id == note_id)
        result = await db.execute(stmt)
        return result.scalar_one_or_none()
    
    @staticmethod
    async def delete(db: AsyncSession, note_id: int) -> bool:
        """Delete note by ID"""
        stmt = delete(Note).where(Note.note_id == note_id)
        result = await db.execute(stmt)
        await db.commit()
        return result.rowcount > 0


class RoleCRUD:
    """CRUD operations for Role model"""
    
    @staticmethod
    async def create(db: AsyncSession, role_name: str) -> Role:
        """Create a new role"""
        role = Role(role_name=role_name)
        db.add(role)
        await db.commit()
        await db.refresh(role)
        return role
    
    @staticmethod
    async def get_all(db: AsyncSession) -> List[Role]:
        """Get all roles"""
        stmt = select(Role)
        result = await db.execute(stmt)
        return result.scalars().all()
    
    @staticmethod
    async def get_by_name(db: AsyncSession, role_name: str) -> Optional[Role]:
        """Get role by name"""
        stmt = select(Role).where(Role.role_name == role_name)
        result = await db.execute(stmt)
        return result.scalar_one_or_none()


class GenderCRUD:
    """CRUD operations for Gender model"""
    
    @staticmethod
    async def create(db: AsyncSession, gender_name: str) -> Gender:
        """Create a new gender"""
        gender = Gender(gender_name=gender_name)
        db.add(gender)
        await db.commit()
        await db.refresh(gender)
        return gender
    
    @staticmethod
    async def get_all(db: AsyncSession) -> List[Gender]:
        """Get all genders"""
        stmt = select(Gender)
        result = await db.execute(stmt)
        return result.scalars().all()
    
    @staticmethod
    async def get_by_name(db: AsyncSession, gender_name: str) -> Optional[Gender]:
        """Get gender by name"""
        stmt = select(Gender).where(Gender.gender_name == gender_name)
        result = await db.execute(stmt)
        return result.scalar_one_or_none()


class StatsCRUD:
    """CRUD operations for dashboard statistics"""
    
    @staticmethod
    async def get_dashboard_stats(db: AsyncSession) -> Dict[str, Any]:
        """Get comprehensive dashboard statistics"""
        
        # Total counts
        total_users = await db.scalar(select(func.count(User.user_id)))
        total_conversations = await db.scalar(select(func.count(Conversation.conversation_id)))
        total_messages = await db.scalar(select(func.count(Message.message_id)))
        active_conversations = await db.scalar(
            select(func.count(Conversation.conversation_id)).where(Conversation.is_active == True)
        )
        
        # User messages vs AI messages
        user_messages = await db.scalar(
            select(func.count(Message.message_id)).where(Message.is_user == True)
        )
        ai_messages = await db.scalar(
            select(func.count(Message.message_id)).where(Message.is_user == False)
        )
        
        return {
            "total_users": total_users or 0,
            "total_conversations": total_conversations or 0,
            "total_messages": total_messages or 0,
            "active_conversations": active_conversations or 0,
            "user_messages": user_messages or 0,
            "ai_messages": ai_messages or 0,
            "avg_messages_per_conversation": round((total_messages or 0) / max(total_conversations or 1, 1), 2)
        }