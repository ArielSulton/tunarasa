"""
Application configuration settings
"""

from pydantic_settings import BaseSettings
from typing import List, Optional
import os
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Load environment variables
load_dotenv()


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
    
    # Supabase Database Configuration
    user: Optional[str] = None
    password: Optional[str] = None  
    host: Optional[str] = None
    port: Optional[str] = None
    dbname: Optional[str] = None
    
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
    CORS_ORIGINS: str  # Comma-separated string, parsed manually
    ALLOWED_HOSTS: str  # Comma-separated string, parsed manually
    
    # Rate Limiting
    RATE_LIMIT_REQUESTS: int
    RATE_LIMIT_WINDOW: int
    
    DATABASE_URL: Optional[str] = None
    
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
    DB_POOL_SIZE: int = 5
    DB_MAX_OVERFLOW: int = 10
    DB_POOL_TIMEOUT: int = 30
    
    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()

# Parse comma-separated values
def get_cors_origins() -> List[str]:
    """Parse CORS origins from comma-separated string"""
    return [origin.strip() for origin in settings.CORS_ORIGINS.split(",") if origin.strip()]

def get_allowed_hosts() -> List[str]:
    """Parse allowed hosts from comma-separated string"""
    return [host.strip() for host in settings.ALLOWED_HOSTS.split(",") if host.strip()]

# Construct Supabase SQLAlchemy connection string
def get_database_url() -> str:
    """Construct database URL from environment variables"""
    USER = os.getenv("user")
    PASSWORD = os.getenv("password")
    HOST = os.getenv("host")
    PORT = os.getenv("port")
    DBNAME = os.getenv("dbname")
    
    if not all([USER, PASSWORD, HOST, PORT, DBNAME]):
        raise ValueError("Missing required database environment variables")
    
    return f"postgresql+psycopg2://{USER}:{PASSWORD}@{HOST}:{PORT}/{DBNAME}?sslmode=require"

# Create SQLAlchemy engine
# engine = create_engine(get_database_url())

# Create SessionLocal class
# SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Database dependency
# def get_db():
#     """Database session dependency"""
#     db = SessionLocal()
#     try:
#         yield db
#     finally:
#         db.close()

# Test database connection
# def test_database_connection():
#     """Test database connection"""
#     try:
#         with engine.connect() as connection:
#             print("✅ Database connection successful!")
#             return True
#     except Exception as e:
#         print(f"❌ Failed to connect to database: {e}")
#         return False

def test_database_connection():
    pass
