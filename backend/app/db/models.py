"""
SQLAlchemy models matching the Drizzle schema
6-table schema: roles, genders, users, conversations, messages, notes
"""

from datetime import datetime
from typing import List, Optional
from sqlalchemy import (
    Column, Integer, String, Text, Boolean, DateTime, 
    ForeignKey, Index, UniqueConstraint
)
from sqlalchemy.orm import relationship, Mapped, mapped_column
from sqlalchemy.sql import func
from sqlalchemy.dialects.postgresql import ARRAY

from app.core.database import Base


class Role(Base):
    """Roles table - user role definitions"""
    __tablename__ = "roles"
    
    role_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    role_name: Mapped[str] = mapped_column(String(50), nullable=False)
    
    # Relationships
    users: Mapped[List["User"]] = relationship("User", back_populates="role")
    
    # Indexes
    __table_args__ = (
        Index("roles_role_name_idx", "role_name"),
    )


class Gender(Base):
    """Genders table - gender definitions"""
    __tablename__ = "genders"
    
    gender_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    gender_name: Mapped[str] = mapped_column(String(50), nullable=False)
    
    # Relationships
    users: Mapped[List["User"]] = relationship("User", back_populates="gender")
    
    # Indexes
    __table_args__ = (
        Index("genders_gender_name_idx", "gender_name"),
    )


class User(Base):
    """Users table - user information"""
    __tablename__ = "users"
    
    user_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    clerk_user_id: Mapped[Optional[int]] = mapped_column(Integer, unique=True, nullable=True)
    full_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    role_id: Mapped[int] = mapped_column(Integer, ForeignKey("roles.role_id"), nullable=False)
    gender_id: Mapped[int] = mapped_column(Integer, ForeignKey("genders.gender_id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    
    # Relationships
    role: Mapped["Role"] = relationship("Role", back_populates="users")
    gender: Mapped["Gender"] = relationship("Gender", back_populates="users")
    conversations: Mapped[List["Conversation"]] = relationship("Conversation", back_populates="user")
    
    # Indexes
    __table_args__ = (
        Index("users_clerk_user_id_idx", "clerk_user_id"),
        Index("users_role_id_idx", "role_id"),
        Index("users_gender_id_idx", "gender_id"),
        Index("users_created_at_idx", "created_at"),
    )


class Conversation(Base):
    """Conversations table - user conversation sessions"""
    __tablename__ = "conversations"
    
    conversation_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.user_id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    
    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="conversations")
    messages: Mapped[List["Message"]] = relationship("Message", back_populates="conversation")
    notes: Mapped[List["Note"]] = relationship("Note", back_populates="conversation")
    
    # Indexes
    __table_args__ = (
        Index("conversations_user_id_idx", "user_id"),
        Index("conversations_is_active_idx", "is_active"),
        Index("conversations_created_at_idx", "created_at"),
    )


class Message(Base):
    """Messages table - conversation messages"""
    __tablename__ = "messages"
    
    message_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    conversation_id: Mapped[int] = mapped_column(Integer, ForeignKey("conversations.conversation_id"), nullable=False)
    message_content: Mapped[str] = mapped_column(Text, nullable=False)
    is_user: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    
    # Relationships
    conversation: Mapped["Conversation"] = relationship("Conversation", back_populates="messages")
    
    # Indexes
    __table_args__ = (
        Index("messages_conversation_id_idx", "conversation_id"),
        Index("messages_is_user_idx", "is_user"),
        Index("messages_created_at_idx", "created_at"),
    )


class Note(Base):
    """Notes table - conversation notes and summaries"""
    __tablename__ = "notes"
    
    note_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    conversation_id: Mapped[int] = mapped_column(Integer, ForeignKey("conversations.conversation_id"), nullable=False)
    note_content: Mapped[str] = mapped_column(Text, nullable=False)
    title: Mapped[Optional[list[str]]] = mapped_column(ARRAY(String), nullable=True)
    # qr_code_data: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    url_access: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    
    # Relationships
    conversation: Mapped["Conversation"] = relationship("Conversation", back_populates="notes")
    
    # Indexes
    __table_args__ = (
        Index("notes_conversation_id_idx", "conversation_id"),
        Index("notes_created_at_idx", "created_at"),
    )