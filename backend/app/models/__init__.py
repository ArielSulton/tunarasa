"""
Database models for Tunarasa application (New 6-table schema)
"""

from .user import User, UserCreate, UserUpdate
from .conversation import Conversation, ConversationCreate, ConversationUpdate
from .messages import Message, MessageCreate, MessageUpdate
from .notes import Note, NoteCreate, NoteUpdate
from .roles import Role, RoleCreate, RoleUpdate
from .genders import Gender, GenderCreate, GenderUpdate

__all__ = [
    # Core models
    "User", "UserCreate", "UserUpdate",
    "Conversation", "ConversationCreate", "ConversationUpdate", 
    "Message", "MessageCreate", "MessageUpdate",
    "Note", "NoteCreate", "NoteUpdate",
    "Role", "RoleCreate", "RoleUpdate",
    "Gender", "GenderCreate", "GenderUpdate"
]