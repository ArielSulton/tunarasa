"""
Database models for Tunarasa application (New 6-table schema)
"""

from .conversation import Conversation, ConversationCreate, ConversationUpdate
from .genders import Gender, GenderCreate, GenderUpdate
from .messages import Message, MessageCreate, MessageUpdate
from .notes import Note, NoteCreate, NoteUpdate
from .roles import Role, RoleCreate, RoleUpdate
from .user import User, UserCreate, UserUpdate

__all__ = [
    # Core models
    "User",
    "UserCreate",
    "UserUpdate",
    "Conversation",
    "ConversationCreate",
    "ConversationUpdate",
    "Message",
    "MessageCreate",
    "MessageUpdate",
    "Note",
    "NoteCreate",
    "NoteUpdate",
    "Role",
    "RoleCreate",
    "RoleUpdate",
    "Gender",
    "GenderCreate",
    "GenderUpdate",
]
