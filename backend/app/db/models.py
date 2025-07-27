"""
SQLAlchemy models matching the Drizzle schema
Complete 14-table synchronized schema with frontend
Includes: roles, genders, users, adminInvitations, userSyncLog, conversations, messages, notes, sessions, qaLogs, appSettings, adminQueue
"""

import uuid
from datetime import datetime
from typing import Dict, List, Optional, Union

from app.core.database import Base
from sqlalchemy import Boolean, DateTime, ForeignKey, Index, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func


class Role(Base):
    """Enhanced Roles table with admin role support"""

    __tablename__ = "roles"

    role_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    role_name: Mapped[str] = mapped_column(String(50), nullable=False, unique=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    permissions: Mapped[Optional[List[str]]] = mapped_column(
        JSONB, default=list, nullable=True
    )
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    # Relationships
    users: Mapped[List["User"]] = relationship("User", back_populates="role")

    # Indexes
    __table_args__ = (
        Index("roles_role_name_idx", "role_name"),
        Index("roles_is_active_idx", "is_active"),
    )


class Gender(Base):
    """Genders table - gender definitions"""

    __tablename__ = "genders"

    gender_id: Mapped[int] = mapped_column(
        Integer, primary_key=True, autoincrement=True
    )
    gender_name: Mapped[str] = mapped_column(String(50), nullable=False)

    # Relationships
    users: Mapped[List["User"]] = relationship("User", back_populates="gender")

    # Indexes
    __table_args__ = (Index("genders_gender_name_idx", "gender_name"),)


class User(Base):
    """Enhanced Users table with better Clerk integration"""

    __tablename__ = "users"

    user_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    clerk_user_id: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    email: Mapped[str] = mapped_column(String(255), nullable=False)
    first_name: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    last_name: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    full_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    image_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    role_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("roles.role_id"), default=3, nullable=True
    )  # Default to regular user
    gender_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("genders.gender_id"), nullable=True
    )
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    last_sign_in_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    email_verified: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    # Clerk metadata sync
    clerk_metadata: Mapped[Optional[Dict]] = mapped_column(JSONB, nullable=True)
    # Admin invitation tracking
    invited_by: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    invited_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    invitation_accepted_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    # Relationships
    role: Mapped[Optional["Role"]] = relationship("Role", back_populates="users")
    gender: Mapped[Optional["Gender"]] = relationship("Gender", back_populates="users")
    # Admin-only sessions (authenticated users)
    admin_sessions: Mapped[List["Session"]] = relationship(
        "Session", back_populates="user", cascade="all, delete-orphan"
    )
    sent_invitations: Mapped[List["AdminInvitation"]] = relationship(
        "AdminInvitation",
        back_populates="invited_by_user",
        cascade="all, delete-orphan",
    )
    sync_logs: Mapped[List["UserSyncLog"]] = relationship(
        "UserSyncLog", back_populates="user", cascade="all, delete-orphan"
    )
    # CS Support relations (admin-only)
    assigned_conversations: Mapped[List["Conversation"]] = relationship(
        "Conversation",
        foreign_keys="[Conversation.assigned_admin_id]",
        back_populates="assigned_admin",
    )
    admin_messages: Mapped[List["Message"]] = relationship(
        "Message", back_populates="admin"
    )
    admin_qa_logs: Mapped[List["QaLog"]] = relationship("QaLog", back_populates="admin")

    # Indexes
    __table_args__ = (
        Index("users_clerk_user_id_idx", "clerk_user_id"),
        Index("users_email_idx", "email"),
        Index("users_role_id_idx", "role_id"),
        Index("users_gender_id_idx", "gender_id"),
        Index("users_is_active_idx", "is_active"),
        Index("users_created_at_idx", "created_at"),
        Index("users_invited_by_idx", "invited_by"),
    )


class Conversation(Base):
    """Enhanced Conversations table for dual-mode service with anonymous users"""

    __tablename__ = "conversations"

    conversation_id: Mapped[int] = mapped_column(
        Integer, primary_key=True, autoincrement=True
    )
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    # Anonymous user session tracking (no foreign key to users table)
    session_id: Mapped[str] = mapped_column(String(255), nullable=False)
    user_agent: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    ip_address: Mapped[Optional[str]] = mapped_column(String(45), nullable=True)
    # Service mode: 'full_llm_bot' or 'human_cs_support'
    service_mode: Mapped[str] = mapped_column(
        String(20), nullable=False, default="full_llm_bot"
    )
    # For human CS support mode
    assigned_admin_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("users.user_id"), nullable=True
    )
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="active"
    )  # 'active', 'waiting', 'in_progress', 'resolved'
    priority: Mapped[str] = mapped_column(
        String(10), nullable=False, default="normal"
    )  # 'low', 'normal', 'high', 'urgent'
    last_message_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=True
    )
    resolved_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    # Relationships
    assigned_admin: Mapped[Optional["User"]] = relationship(
        "User",
        foreign_keys=[assigned_admin_id],
        back_populates="assigned_conversations",
    )
    messages: Mapped[List["Message"]] = relationship(
        "Message", back_populates="conversation", cascade="all, delete-orphan"
    )
    notes: Mapped[List["Note"]] = relationship(
        "Note", back_populates="conversation", cascade="all, delete-orphan"
    )
    qa_logs: Mapped[List["QaLog"]] = relationship(
        "QaLog", back_populates="conversation", cascade="all, delete-orphan"
    )
    queue_item: Mapped[Optional["AdminQueue"]] = relationship(
        "AdminQueue", back_populates="conversation", uselist=False
    )

    # Indexes
    __table_args__ = (
        Index("conversations_session_id_idx", "session_id"),
        Index("conversations_is_active_idx", "is_active"),
        Index("conversations_service_mode_idx", "service_mode"),
        Index("conversations_assigned_admin_id_idx", "assigned_admin_id"),
        Index("conversations_status_idx", "status"),
        Index("conversations_last_message_at_idx", "last_message_at"),
        Index("conversations_created_at_idx", "created_at"),
    )


class Message(Base):
    """Enhanced Messages table for multi-party chat"""

    __tablename__ = "messages"

    message_id: Mapped[int] = mapped_column(
        Integer, primary_key=True, autoincrement=True
    )
    conversation_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("conversations.conversation_id", ondelete="CASCADE"),
        nullable=False,
    )
    message_content: Mapped[str] = mapped_column(Text, nullable=False)
    # Message types: 'user', 'admin', 'llm_bot', 'llm_recommendation', 'system'
    message_type: Mapped[str] = mapped_column(
        String(20), nullable=False, default="user"
    )
    # For admin messages
    admin_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("users.user_id"), nullable=True
    )
    # For LLM recommendations (parent message they're responding to)
    parent_message_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    # Message metadata
    confidence: Mapped[Optional[int]] = mapped_column(
        Integer, nullable=True
    )  # 0-100 for LLM responses
    is_read: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    # For speech-to-text metadata
    input_method: Mapped[str] = mapped_column(
        String(20), default="text", nullable=True
    )  # 'text', 'speech', 'gesture'
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationships
    conversation: Mapped["Conversation"] = relationship(
        "Conversation", back_populates="messages"
    )
    admin: Mapped[Optional["User"]] = relationship(
        "User", back_populates="admin_messages"
    )
    # Self-referencing relation for parent messages
    parent_message: Mapped[Optional["Message"]] = relationship(
        "Message", remote_side=[message_id]
    )

    # Indexes
    __table_args__ = (
        Index("messages_conversation_id_idx", "conversation_id"),
        Index("messages_message_type_idx", "message_type"),
        Index("messages_admin_id_idx", "admin_id"),
        Index("messages_parent_message_id_idx", "parent_message_id"),
        Index("messages_is_read_idx", "is_read"),
        Index("messages_created_at_idx", "created_at"),
    )


class Note(Base):
    """Notes table - conversation notes and summaries"""

    __tablename__ = "notes"

    note_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    conversation_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("conversations.conversation_id"), nullable=False
    )
    note_content: Mapped[str] = mapped_column(Text, nullable=False)
    url_access: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationships
    conversation: Mapped["Conversation"] = relationship(
        "Conversation", back_populates="notes"
    )

    # Indexes
    __table_args__ = (
        Index("notes_conversation_id_idx", "conversation_id"),
        Index("notes_created_at_idx", "created_at"),
    )


class AdminInvitation(Base):
    """Admin Invitations table for managing admin user invitations"""

    __tablename__ = "admin_invitations"

    invitation_id: Mapped[str] = mapped_column(
        String(255), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    email: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(
        String(50), nullable=False
    )  # 'admin' or 'superadmin'
    invited_by: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.user_id"), nullable=False
    )
    custom_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="pending"
    )  # pending, accepted, expired, cancelled
    token: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    accepted_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    cancelled_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    # Relationships
    invited_by_user: Mapped["User"] = relationship(
        "User", back_populates="sent_invitations"
    )

    # Indexes
    __table_args__ = (
        Index("admin_invitations_email_idx", "email"),
        Index("admin_invitations_status_idx", "status"),
        Index("admin_invitations_token_idx", "token"),
        Index("admin_invitations_expires_at_idx", "expires_at"),
        Index("admin_invitations_invited_by_idx", "invited_by"),
    )


class UserSyncLog(Base):
    """User Sync Log table for tracking Clerk synchronization"""

    __tablename__ = "user_sync_log"

    sync_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    clerk_user_id: Mapped[str] = mapped_column(String(255), nullable=False)
    event_type: Mapped[str] = mapped_column(
        String(50), nullable=False
    )  # user.created, user.updated, user.deleted
    sync_status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="success"
    )  # success, failed, retry
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    clerk_payload: Mapped[Optional[Dict]] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="sync_logs")

    # Indexes
    __table_args__ = (
        Index("user_sync_log_clerk_user_id_idx", "clerk_user_id"),
        Index("user_sync_log_event_type_idx", "event_type"),
        Index("user_sync_log_sync_status_idx", "sync_status"),
        Index("user_sync_log_created_at_idx", "created_at"),
    )


class Session(Base):
    """Sessions table - Supporting both anonymous users and authenticated admins"""

    __tablename__ = "sessions"

    session_id: Mapped[int] = mapped_column(
        Integer, primary_key=True, autoincrement=True
    )
    # Anonymous session identifier (for non-authenticated users)
    anonymous_session_id: Mapped[Optional[str]] = mapped_column(
        String(255), nullable=True
    )
    # Optional user reference (only for admin/superadmin sessions)
    user_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("users.user_id", ondelete="CASCADE"), nullable=True
    )
    session_type: Mapped[str] = mapped_column(
        String(20), nullable=False, default="anonymous"
    )  # 'anonymous', 'admin'
    session_start: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    session_end: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    user_agent: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    ip_address: Mapped[Optional[str]] = mapped_column(String(45), nullable=True)
    device_info: Mapped[Optional[Dict]] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    # Relationships
    user: Mapped[Optional["User"]] = relationship(
        "User", back_populates="admin_sessions"
    )

    # Indexes
    __table_args__ = (
        Index("sessions_anonymous_session_id_idx", "anonymous_session_id"),
        Index("sessions_user_id_idx", "user_id"),
        Index("sessions_session_type_idx", "session_type"),
        Index("sessions_is_active_idx", "is_active"),
        Index("sessions_session_start_idx", "session_start"),
        Index("sessions_created_at_idx", "created_at"),
    )


class QaLog(Base):
    """Q&A Logs table - Enhanced for dual-mode tracking with anonymous users"""

    __tablename__ = "qa_logs"

    qa_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    # Anonymous session tracking (no foreign key to users table)
    session_id: Mapped[str] = mapped_column(String(255), nullable=False)
    conversation_id: Mapped[Optional[int]] = mapped_column(
        Integer,
        ForeignKey("conversations.conversation_id", ondelete="CASCADE"),
        nullable=True,
    )
    question: Mapped[str] = mapped_column(Text, nullable=False)
    answer: Mapped[str] = mapped_column(Text, nullable=False)
    confidence: Mapped[Optional[int]] = mapped_column(
        Integer, nullable=True
    )  # 0-100 percentage
    response_time: Mapped[Optional[int]] = mapped_column(
        Integer, nullable=True
    )  # milliseconds
    gesture_input: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    context_used: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    evaluation_score: Mapped[Optional[int]] = mapped_column(
        Integer, nullable=True
    )  # 0-100 for LLM evaluation
    # Service mode tracking
    service_mode: Mapped[str] = mapped_column(
        String(20), nullable=False, default="full_llm_bot"
    )
    responded_by: Mapped[str] = mapped_column(
        String(20), nullable=False, default="llm"
    )  # 'llm', 'admin'
    admin_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("users.user_id"), nullable=True
    )  # If responded by admin
    llm_recommendation_used: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationships
    conversation: Mapped[Optional["Conversation"]] = relationship(
        "Conversation", back_populates="qa_logs"
    )
    admin: Mapped[Optional["User"]] = relationship(
        "User", back_populates="admin_qa_logs"
    )

    # Indexes
    __table_args__ = (
        Index("qa_logs_session_id_idx", "session_id"),
        Index("qa_logs_conversation_id_idx", "conversation_id"),
        Index("qa_logs_service_mode_idx", "service_mode"),
        Index("qa_logs_responded_by_idx", "responded_by"),
        Index("qa_logs_admin_id_idx", "admin_id"),
        Index("qa_logs_created_at_idx", "created_at"),
        Index("qa_logs_confidence_idx", "confidence"),
        Index("qa_logs_evaluation_score_idx", "evaluation_score"),
    )


class AppSetting(Base):
    """App Settings table - Global application configuration"""

    __tablename__ = "app_settings"

    setting_id: Mapped[int] = mapped_column(
        Integer, primary_key=True, autoincrement=True
    )
    setting_key: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)
    setting_value: Mapped[str] = mapped_column(Text, nullable=False)
    setting_type: Mapped[str] = mapped_column(
        String(20), nullable=False, default="string"
    )  # 'string', 'number', 'boolean', 'json'
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_public: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False
    )  # Can be accessed by non-admin users
    updated_by: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("users.user_id"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    # Relationships
    updated_by_user: Mapped[Optional["User"]] = relationship("User")

    # Indexes
    __table_args__ = (
        Index("app_settings_setting_key_idx", "setting_key"),
        Index("app_settings_is_public_idx", "is_public"),
        Index("app_settings_updated_at_idx", "updated_at"),
    )


class AdminQueue(Base):
    """Admin Queue table - For managing user conversations in CS mode"""

    __tablename__ = "admin_queue"

    queue_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    conversation_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("conversations.conversation_id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )
    assigned_admin_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("users.user_id"), nullable=True
    )
    priority: Mapped[str] = mapped_column(String(10), nullable=False, default="normal")
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="waiting"
    )  # 'waiting', 'assigned', 'in_progress', 'resolved'
    queued_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    assigned_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    resolved_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Relationships
    conversation: Mapped["Conversation"] = relationship(
        "Conversation", back_populates="queue_item"
    )
    assigned_admin: Mapped[Optional["User"]] = relationship("User")

    # Indexes
    __table_args__ = (
        Index("admin_queue_status_idx", "status"),
        Index("admin_queue_priority_idx", "priority"),
        Index("admin_queue_assigned_admin_id_idx", "assigned_admin_id"),
        Index("admin_queue_queued_at_idx", "queued_at"),
    )


# Export all models for easy importing
__all__ = [
    "Base",
    # Core tables
    "Role",
    "Gender",
    "User",
    # Admin management
    "AdminInvitation",
    "UserSyncLog",
    # Conversation system
    "Conversation",
    "Message",
    "Note",
    "Session",
    "QaLog",
    # Application management
    "AppSetting",
    "AdminQueue",
]

# Type definitions for API compatibility (matching frontend types)
UserRole = Union[str]  # 'superadmin', 'admin', 'user'
InvitationStatus = Union[str]  # 'pending', 'accepted', 'expired', 'cancelled'
SyncStatus = Union[str]  # 'success', 'failed', 'retry'
ClerkEventType = Union[str]  # 'user.created', 'user.updated', 'user.deleted'
ServiceMode = Union[str]  # 'full_llm_bot', 'human_cs_support'
ConversationStatus = Union[str]  # 'active', 'waiting', 'in_progress', 'resolved'
MessageType = Union[str]  # 'user', 'admin', 'llm_bot', 'llm_recommendation', 'system'
Priority = Union[str]  # 'low', 'normal', 'high', 'urgent'
InputMethod = Union[str]  # 'text', 'speech', 'gesture'
QueueStatus = Union[str]  # 'waiting', 'assigned', 'in_progress', 'resolved'
SettingType = Union[str]  # 'string', 'number', 'boolean', 'json'
