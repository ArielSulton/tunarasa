"""
Application configuration settings
"""

from pydantic_settings import BaseSettings
from typing import List, Optional
import os


class Settings(BaseSettings):
    """Application settings"""
    
    # Environment
    NODE_ENV: str
    ENVIRONMENT: str
    DEBUG: bool
    SITE_NAME: str
    
    # Frontend Configuration (Next.js)
    NEXT_PUBLIC_APP_URL: Optional[str] = None
    NEXT_PUBLIC_BACKEND_URL: Optional[str] = None
    NEXT_PUBLIC_API_URL: Optional[str] = None
    BACKEND_URL: Optional[str] = None
    NEXT_TELEMETRY_DISABLED: Optional[str] = None
    NEXT_PRIVATE_STANDALONE: Optional[str] = None
    
    # API Configuration
    API_V1_STR: str
    PROJECT_NAME: str
    
    # Database Configuration (PostgreSQL via Supabase)
    DATABASE_URL: Optional[str] = None
    
    # Database Pool Settings
    DB_POOL_SIZE: int
    DB_MAX_OVERFLOW: int
    DB_POOL_TIMEOUT: int
    
    # Authentication
    SECRET_KEY: str
    ACCESS_TOKEN_EXPIRE_MINUTES: int
    
    # Clerk Integration
    CLERK_SECRET_KEY: Optional[str] = None
    CLERK_PUBLISHABLE_KEY: Optional[str] = None
    
    # AI Services
    GROQ_API_KEY: Optional[str] = None
    PINECONE_API_KEY: Optional[str] = None
    PINECONE_INDEX_NAME: str
    
    # LLM Configuration
    LLM_MODEL: str
    LLM_TEMPERATURE: float
    LLM_MAX_TOKENS: int
    
    # RAG Configuration
    RAG_CHUNK_SIZE: int
    RAG_CHUNK_OVERLAP: int
    RAG_RETRIEVAL_K: int
    RAG_SIMILARITY_THRESHOLD: float
    
    # Redis
    REDIS_URL: str
    
    
    # Security
    CORS_ORIGINS: List[str]
    ALLOWED_HOSTS: List[str]
    
    # Rate Limiting
    RATE_LIMIT_REQUESTS: int
    RATE_LIMIT_WINDOW: int
    
    # Monitoring
    PROMETHEUS_PORT: int
    GRAFANA_ADMIN_USER: Optional[str] = None
    GRAFANA_ADMIN_PASSWORD: Optional[str] = None
    GRAFANA_DOMAIN: Optional[str] = None
    GRAFANA_URL: Optional[str] = None
    ALERTMANAGER_DOMAIN: Optional[str] = None
    
    # File Upload
    MAX_FILE_SIZE: int
    UPLOAD_DIR: str
    
    # Embedding Model Configuration
    EMBEDDING_MODEL: str
    
    # DeepEval Configuration
    DEEPEVAL_API_KEY: Optional[str] = None
    
    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()