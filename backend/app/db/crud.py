"""
CRUD operations for all database models
Provides async database operations matching the Drizzle schema
Enhanced with query optimizations and N+1 problem elimination
"""

from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy import and_, case, delete, func, select, text, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload, selectinload
from sqlalchemy.sql import distinct

from .models import Conversation, Message, Note, Role, User


class UserCRUD:
    """CRUD operations for User model"""

    @staticmethod
    async def create(
        db: AsyncSession,
        supabase_user_id: Optional[str] = None,
        full_name: Optional[str] = None,
        role_id: int = 1,
    ) -> User:
        """Create a new user"""
        user = User(
            supabase_user_id=supabase_user_id,
            full_name=full_name,
            role_id=role_id,
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
        return user

    @staticmethod
    async def get_by_id(db: AsyncSession, user_id: int) -> Optional[User]:
        """Get user by ID with relationships"""
        stmt = (
            select(User)
            .options(
                selectinload(User.role),
                selectinload(User.conversations),
            )
            .where(User.user_id == user_id)
        )
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    @staticmethod
    async def get_by_supabase_id(
        db: AsyncSession, supabase_user_id: str
    ) -> Optional[User]:
        """Get user by Supabase ID"""
        stmt = (
            select(User)
            .options(selectinload(User.role))
            .where(User.supabase_user_id == supabase_user_id)
        )
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    @staticmethod
    async def get_all(db: AsyncSession, skip: int = 0, limit: int = 100) -> List[User]:
        """Get all users with pagination - optimized with joins"""
        stmt = select(User).options(joinedload(User.role)).offset(skip).limit(limit)
        result = await db.execute(stmt)
        return result.unique().scalars().all()

    @staticmethod
    async def get_users_with_stats(
        db: AsyncSession, skip: int = 0, limit: int = 100
    ) -> List[Tuple[User, Dict[str, Any]]]:
        """Get users with conversation and message statistics in single query"""
        stmt = (
            select(
                User,
                func.count(distinct(Conversation.conversation_id)).label(
                    "conversation_count"
                ),
                func.count(distinct(Message.message_id)).label("message_count"),
                func.max(Conversation.updated_at).label("last_activity"),
            )
            .outerjoin(Conversation, User.user_id == Conversation.user_id)
            .outerjoin(Message, Conversation.conversation_id == Message.conversation_id)
            .options(joinedload(User.role))
            .group_by(User.user_id)
            .offset(skip)
            .limit(limit)
        )

        result = await db.execute(stmt)
        rows = result.all()

        return [
            (
                row.User,
                {
                    "conversation_count": row.conversation_count or 0,
                    "message_count": row.message_count or 0,
                    "last_activity": row.last_activity,
                },
            )
            for row in rows
        ]

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
    async def create(
        db: AsyncSession, user_id: int, is_active: bool = True
    ) -> Conversation:
        """Create a new conversation"""
        conversation = Conversation(user_id=user_id, is_active=is_active)
        db.add(conversation)
        await db.commit()
        await db.refresh(conversation)
        return conversation

    @staticmethod
    async def get_by_id(
        db: AsyncSession, conversation_id: int
    ) -> Optional[Conversation]:
        """Get conversation by ID with relationships"""
        stmt = (
            select(Conversation)
            .options(
                selectinload(Conversation.user),
                selectinload(Conversation.messages),
                selectinload(Conversation.notes),
            )
            .where(Conversation.conversation_id == conversation_id)
        )
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    @staticmethod
    async def get_by_user(
        db: AsyncSession, user_id: int, active_only: bool = True
    ) -> List[Conversation]:
        """Get conversations by user ID with optimized loading"""
        stmt = (
            select(Conversation)
            .options(
                selectinload(Conversation.messages), selectinload(Conversation.notes)
            )
            .where(Conversation.user_id == user_id)
        )

        if active_only:
            stmt = stmt.where(Conversation.is_active)

        result = await db.execute(stmt)
        return result.scalars().all()

    @staticmethod
    async def get_conversations_with_stats(
        db: AsyncSession,
        user_id: int = None,
        active_only: bool = True,
        skip: int = 0,
        limit: int = 50,
    ) -> List[Tuple[Conversation, Dict[str, Any]]]:
        """Get conversations with message statistics in single query"""
        stmt = (
            select(
                Conversation,
                func.count(Message.message_id).label("message_count"),
                func.count(case((Message.is_user, 1))).label("user_message_count"),
                func.count(case((~Message.is_user, 1))).label("ai_message_count"),
                func.max(Message.created_at).label("last_message_at"),
            )
            .outerjoin(Message, Conversation.conversation_id == Message.conversation_id)
            .options(joinedload(Conversation.user))
            .group_by(Conversation.conversation_id)
        )

        if user_id:
            stmt = stmt.where(Conversation.user_id == user_id)
        if active_only:
            stmt = stmt.where(Conversation.is_active)

        stmt = stmt.offset(skip).limit(limit).order_by(Conversation.updated_at.desc())

        result = await db.execute(stmt)
        rows = result.all()

        return [
            (
                row.Conversation,
                {
                    "message_count": row.message_count or 0,
                    "user_message_count": row.user_message_count or 0,
                    "ai_message_count": row.ai_message_count or 0,
                    "last_message_at": row.last_message_at,
                },
            )
            for row in rows
        ]

    @staticmethod
    async def update(
        db: AsyncSession, conversation_id: int, **updates
    ) -> Optional[Conversation]:
        """Update conversation by ID"""
        stmt = (
            update(Conversation)
            .where(Conversation.conversation_id == conversation_id)
            .values(**updates)
        )
        await db.execute(stmt)
        await db.commit()
        return await ConversationCRUD.get_by_id(db, conversation_id)

    @staticmethod
    async def delete(db: AsyncSession, conversation_id: int) -> bool:
        """Delete conversation by ID"""
        stmt = delete(Conversation).where(
            Conversation.conversation_id == conversation_id
        )
        result = await db.execute(stmt)
        await db.commit()
        return result.rowcount > 0


class MessageCRUD:
    """CRUD operations for Message model"""

    @staticmethod
    async def create(
        db: AsyncSession,
        conversation_id: int,
        message_content: str,
        is_user: bool = False,
    ) -> Message:
        """Create a new message"""
        message = Message(
            conversation_id=conversation_id,
            message_content=message_content,
            is_user=is_user,
        )
        db.add(message)
        await db.commit()
        await db.refresh(message)
        return message

    @staticmethod
    async def get_by_conversation(
        db: AsyncSession, conversation_id: int
    ) -> List[Message]:
        """Get all messages for a conversation"""
        stmt = (
            select(Message)
            .where(Message.conversation_id == conversation_id)
            .order_by(Message.created_at)
        )
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
    async def create(
        db: AsyncSession,
        conversation_id: int,
        note_content: str,
        title: Optional[str] = None,
        url_access: Optional[str] = None,
    ) -> Note:
        """Create a new note"""
        note = Note(
            conversation_id=conversation_id,
            note_content=note_content,
            title=[title] if title else None,  # Include the new title column
            url_access=url_access,  # Include url_access column
        )
        db.add(note)
        await db.commit()
        await db.refresh(note)
        return note

    @staticmethod
    async def get_by_conversation(db: AsyncSession, conversation_id: int) -> List[Note]:
        """Get all notes for a conversation"""
        stmt = (
            select(Note)
            .where(Note.conversation_id == conversation_id)
            .order_by(Note.created_at)
        )
        result = await db.execute(stmt)
        return result.scalars().all()

    @staticmethod
    async def get_by_url_access(db: AsyncSession, url_access: str) -> List[Note]:
        """Get all notes for a given URL access"""
        stmt = (
            select(Note).where(Note.url_access == url_access).order_by(Note.created_at)
        )
        result = await db.execute(stmt)
        return result.scalars().all()

    @staticmethod
    async def get_by_id(db: AsyncSession, note_id: int) -> Optional[Note]:
        """Get note by ID"""
        stmt = select(Note).where(Note.note_id == note_id)
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    @staticmethod
    async def update(
        db: AsyncSession,
        note_id: int,
        title: Optional[str] = None,
        note_content: Optional[str] = None,
        url_access: Optional[str] = None,
        **updates
    ) -> Optional[Note]:
        """Update note by ID"""
        update_data = {}
        if title is not None:
            update_data["title"] = [title] if title else None
        if note_content is not None:
            update_data["note_content"] = note_content
        if url_access is not None:
            update_data["url_access"] = url_access

        # Include any additional updates
        update_data.update(updates)

        stmt = update(Note).where(Note.note_id == note_id).values(**update_data)
        await db.execute(stmt)
        await db.commit()
        return await NoteCRUD.get_by_id(db, note_id)

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


class StatsCRUD:
    """CRUD operations for dashboard statistics"""

    @staticmethod
    async def get_dashboard_stats(db: AsyncSession) -> Dict[str, Any]:
        """Get comprehensive dashboard statistics - optimized single query"""

        # Single optimized query for all statistics
        stmt = select(
            func.count(distinct(User.user_id)).label("total_users"),
            func.count(distinct(Conversation.conversation_id)).label(
                "total_conversations"
            ),
            func.count(
                distinct(case((Conversation.is_active, Conversation.conversation_id)))
            ).label("active_conversations"),
            func.count(Message.message_id).label("total_messages"),
            func.count(case((Message.is_user, Message.message_id))).label(
                "user_messages"
            ),
            func.count(case((~Message.is_user, Message.message_id))).label(
                "ai_messages"
            ),
        ).select_from(
            User.__table__.outerjoin(Conversation.__table__).outerjoin(
                Message.__table__
            )
        )

        result = await db.execute(stmt)
        row = result.first()

        total_messages = row.total_messages or 0
        total_conversations = row.total_conversations or 1  # Avoid division by zero

        return {
            "total_users": row.total_users or 0,
            "total_conversations": row.total_conversations or 0,
            "total_messages": total_messages,
            "active_conversations": row.active_conversations or 0,
            "user_messages": row.user_messages or 0,
            "ai_messages": row.ai_messages or 0,
            "total_questions": row.user_messages or 0,  # User messages are questions
            "total_sessions": row.total_conversations
            or 0,  # Conversations are sessions
            "avg_messages_per_conversation": round(
                total_messages / total_conversations, 2
            ),
        }

    @staticmethod
    async def get_time_filtered_stats(
        db: AsyncSession, start_date: datetime, end_date: datetime
    ) -> Dict[str, Any]:
        """Get dashboard statistics filtered by time range - optimized single query"""

        # Single optimized query for all time-filtered statistics
        stmt = select(
            func.count(
                distinct(
                    case((User.created_at.between(start_date, end_date), User.user_id))
                )
            ).label("total_users"),
            func.count(
                distinct(
                    case(
                        (
                            Conversation.created_at.between(start_date, end_date),
                            Conversation.conversation_id,
                        )
                    )
                )
            ).label("total_conversations"),
            func.count(
                distinct(
                    case(
                        (
                            and_(
                                Conversation.is_active,
                                Conversation.updated_at.between(start_date, end_date),
                            ),
                            Conversation.conversation_id,
                        )
                    )
                )
            ).label("active_conversations"),
            func.count(
                case(
                    (
                        Message.created_at.between(start_date, end_date),
                        Message.message_id,
                    )
                )
            ).label("total_messages"),
            func.count(
                case(
                    (
                        and_(
                            Message.is_user,
                            Message.created_at.between(start_date, end_date),
                        ),
                        Message.message_id,
                    )
                )
            ).label("user_messages"),
            func.count(
                case(
                    (
                        and_(
                            ~Message.is_user,
                            Message.created_at.between(start_date, end_date),
                        ),
                        Message.message_id,
                    )
                )
            ).label("ai_messages"),
        ).select_from(
            User.__table__.outerjoin(Conversation.__table__).outerjoin(
                Message.__table__
            )
        )

        result = await db.execute(stmt)
        row = result.first()

        total_messages = row.total_messages or 0
        total_conversations = row.total_conversations or 1  # Avoid division by zero

        return {
            "total_users": row.total_users or 0,
            "total_conversations": row.total_conversations or 0,
            "total_messages": total_messages,
            "active_conversations": row.active_conversations or 0,
            "user_messages": row.user_messages or 0,
            "ai_messages": row.ai_messages or 0,
            "total_questions": row.user_messages or 0,  # User messages are questions
            "total_sessions": row.total_conversations
            or 0,  # Conversations are sessions
            "avg_messages_per_conversation": round(
                total_messages / total_conversations, 2
            ),
            "time_range": {
                "start": start_date.isoformat(),
                "end": end_date.isoformat(),
            },
        }

    @staticmethod
    async def get_advanced_analytics(
        db: AsyncSession, start_date: datetime = None, end_date: datetime = None
    ) -> Dict[str, Any]:
        """Get advanced analytics with optimized queries"""

        # Base conditions for time filtering
        time_filter = (
            and_(Message.created_at.between(start_date, end_date))
            if start_date and end_date
            else text("1=1")
        )

        # Single query for conversation analytics
        conversation_analytics = (
            select(
                func.avg(func.count(Message.message_id))
                .over()
                .label("avg_messages_per_conversation"),
                func.percentile_cont(0.5)
                .within_group(func.count(Message.message_id))
                .label("median_messages"),
                func.max(func.count(Message.message_id)).label(
                    "max_messages_conversation"
                ),
                func.min(func.count(Message.message_id)).label(
                    "min_messages_conversation"
                ),
            )
            .select_from(Conversation.__table__.join(Message.__table__))
            .where(time_filter)
            .group_by(Conversation.conversation_id)
        )

        # User activity analytics
        user_activity = (
            select(
                func.count(distinct(User.user_id)).label("active_users"),
                func.avg(func.count(Message.message_id))
                .over()
                .label("avg_messages_per_user"),
                func.count(
                    distinct(
                        case(
                            (
                                Message.created_at
                                >= func.date_trunc("day", func.now())
                                - text("interval '7 days'"),
                                User.user_id,
                            )
                        )
                    )
                ).label("weekly_active_users"),
                func.count(
                    distinct(
                        case(
                            (
                                Message.created_at
                                >= func.date_trunc("day", func.now())
                                - text("interval '30 days'"),
                                User.user_id,
                            )
                        )
                    )
                ).label("monthly_active_users"),
            )
            .select_from(
                User.__table__.join(Conversation.__table__).join(Message.__table__)
            )
            .where(time_filter)
            .group_by(User.user_id)
        )

        # Execute analytics queries
        conv_result = await db.execute(conversation_analytics)
        conv_stats = conv_result.first()

        user_result = await db.execute(user_activity)
        user_stats = user_result.first()

        return {
            "conversation_analytics": {
                "avg_messages_per_conversation": float(
                    conv_stats.avg_messages_per_conversation or 0
                ),
                "median_messages": float(conv_stats.median_messages or 0),
                "max_messages_conversation": conv_stats.max_messages_conversation or 0,
                "min_messages_conversation": conv_stats.min_messages_conversation or 0,
            },
            "user_analytics": {
                "active_users": user_stats.active_users or 0,
                "avg_messages_per_user": float(user_stats.avg_messages_per_user or 0),
                "weekly_active_users": user_stats.weekly_active_users or 0,
                "monthly_active_users": user_stats.monthly_active_users or 0,
            },
            "generated_at": datetime.now().isoformat(),
            "time_range": {
                "start": start_date.isoformat() if start_date else None,
                "end": end_date.isoformat() if end_date else None,
            },
        }
