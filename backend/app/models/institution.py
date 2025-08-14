"""
Institution Management Models
SQLAlchemy models for institutions and RAG files management
"""

from datetime import datetime
from typing import Dict, List, Optional

from app.core.database import Base
from sqlalchemy import Boolean, DateTime, ForeignKey, Index, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

# Note: User relationship is commented out to avoid circular imports


class Institution(Base):
    """Institutions table for managing different service organizations"""

    __tablename__ = "institutions"

    institution_id: Mapped[int] = mapped_column(
        Integer, primary_key=True, autoincrement=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    logo_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    contact_info: Mapped[Optional[Dict]] = mapped_column(JSONB, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_by: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.user_id"), nullable=False
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

    # Relationships (using string references to avoid circular imports)
    # creator: Mapped["User"] = relationship("User", foreign_keys=[created_by])
    rag_files: Mapped[List["RagFile"]] = relationship(
        "RagFile", back_populates="institution", cascade="all, delete-orphan"
    )

    # Indexes
    __table_args__ = (
        Index("institutions_slug_idx", "slug"),
        Index("institutions_is_active_idx", "is_active"),
        Index("institutions_created_by_idx", "created_by"),
        Index("institutions_created_at_idx", "created_at"),
    )


class RagFile(Base):
    """RAG Files table for managing document files per institution"""

    __tablename__ = "rag_files"

    rag_file_id: Mapped[int] = mapped_column(
        Integer, primary_key=True, autoincrement=True
    )
    institution_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("institutions.institution_id", ondelete="CASCADE"),
        nullable=False,
    )
    file_name: Mapped[str] = mapped_column(String(255), nullable=False)
    file_type: Mapped[str] = mapped_column(String(50), nullable=False)  # pdf, txt, docx
    file_path: Mapped[str] = mapped_column(Text, nullable=False)
    file_size: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)  # bytes
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    processing_status: Mapped[str] = mapped_column(
        String(50), nullable=False, default="pending"
    )  # pending, processing, completed, failed
    pinecone_namespace: Mapped[Optional[str]] = mapped_column(
        String(255), nullable=True
    )
    document_count: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    embedding_model: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    processing_error: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_by: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.user_id"), nullable=False
    )
    processed_at: Mapped[Optional[datetime]] = mapped_column(
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
    institution: Mapped["Institution"] = relationship(
        "Institution", back_populates="rag_files"
    )
    # creator: Mapped["User"] = relationship("User", foreign_keys=[created_by])

    # Indexes
    __table_args__ = (
        Index("rag_files_institution_id_idx", "institution_id"),
        Index("rag_files_file_name_idx", "file_name"),
        Index("rag_files_processing_status_idx", "processing_status"),
        Index("rag_files_is_active_idx", "is_active"),
        Index("rag_files_created_by_idx", "created_by"),
        Index("rag_files_created_at_idx", "created_at"),
        Index("rag_files_pinecone_namespace_idx", "pinecone_namespace"),
        # Composite indexes for common queries
        Index(
            "rag_files_institution_status_idx", "institution_id", "processing_status"
        ),
        Index("rag_files_institution_active_idx", "institution_id", "is_active"),
    )


# Export for easy importing
__all__ = ["Institution", "RagFile"]
