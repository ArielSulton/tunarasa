"""
Application configuration settings
"""

from pydantic_settings import BaseSettings
from typing import List, Optional
import os


class Settings(BaseSettings):
    """Application settings"""
    
    # Environment
    ENVIRONMENT: str = "development"
    DEBUG: bool = True
    
    # API Configuration
    API_V1_STR: str = "/api/v1"
    PROJECT_NAME: str = "Tunarasa"
    
    # Database Configuration (PostgreSQL via Supabase)
    DATABASE_URL: Optional[str] = None
    SUPABASE_URL: Optional[str] = None
    SUPABASE_ANON_KEY: Optional[str] = None
    SUPABASE_SERVICE_ROLE_KEY: Optional[str] = None
    
    # Database Pool Settings
    DB_POOL_SIZE: int = 10
    DB_MAX_OVERFLOW: int = 20
    DB_POOL_TIMEOUT: int = 30
    
    # Authentication
    SECRET_KEY: str = "your-secret-key-here"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    
    # Clerk Integration
    CLERK_SECRET_KEY: Optional[str] = None
    CLERK_PUBLISHABLE_KEY: Optional[str] = None
    
    # AI Services
    GROQ_API_KEY: Optional[str] = None
    PINECONE_API_KEY: Optional[str] = None
    PINECONE_ENVIRONMENT: str = "us-west1-gcp"
    PINECONE_INDEX_NAME: str = "tunarasa-documents"
    OPENAI_API_KEY: Optional[str] = None
    
    # LLM Configuration
    LLM_MODEL: str = "llama3-8b-8192"
    LLM_TEMPERATURE: float = 0.7
    LLM_MAX_TOKENS: int = 1024
    
    # RAG Configuration
    RAG_CHUNK_SIZE: int = 1000
    RAG_CHUNK_OVERLAP: int = 200
    RAG_RETRIEVAL_K: int = 3
    RAG_SIMILARITY_THRESHOLD: float = 0.7
    
    # Redis
    REDIS_URL: str = "redis://localhost:6379"
    
    # Email Service (Resend)
    RESEND_API_KEY: Optional[str] = None
    
    # Security
    CORS_ORIGINS: List[str] = ["http://localhost:3000", "http://localhost:3001"]
    ALLOWED_HOSTS: List[str] = ["localhost", "127.0.0.1"]
    
    # Rate Limiting
    RATE_LIMIT_REQUESTS: int = 100
    RATE_LIMIT_WINDOW: int = 60  # seconds
    
    # Monitoring
    PROMETHEUS_PORT: int = 9090
    GRAFANA_URL: Optional[str] = None
    
    # File Upload
    MAX_FILE_SIZE: int = 10 * 1024 * 1024  # 10MB
    UPLOAD_DIR: str = "/tmp/uploads"
    
    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()