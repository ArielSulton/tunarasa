"""
Application configuration settings
"""

from typing import List, Optional

from dotenv import load_dotenv
from pydantic_settings import BaseSettings

# Load environment variables
load_dotenv()


class Settings(BaseSettings):
    """Application settings"""

    # Environment Configuration
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

    # Database Configuration
    DATABASE_URL: Optional[str] = None
    NEXT_PUBLIC_SUPABASE_URL: Optional[str] = None
    NEXT_PUBLIC_SUPABASE_ANON_KEY: Optional[str] = None
    SUPABASE_SERVICE_ROLE_KEY: Optional[str] = None
    user: Optional[str] = None
    password: Optional[str] = None
    host: Optional[str] = None
    port: Optional[str] = None
    dbname: Optional[str] = None

    # Authentication & Security
    SECRET_KEY: str
    ACCESS_TOKEN_EXPIRE_MINUTES: int
    SUPABASE_JWT_SECRET: Optional[str] = None
    SUPABASE_PROJECT_ID: Optional[str] = None

    # AI Services Configuration
    GROQ_API_KEY: Optional[str] = None
    LLM_MODEL: str
    LLM_TEMPERATURE: float
    LLM_MAX_TOKENS: int

    # RAG System Configuration
    PINECONE_API_KEY: Optional[str] = None
    PINECONE_INDEX_NAME: str
    EMBEDDING_MODEL: str
    RAG_CHUNK_SIZE: int
    RAG_CHUNK_OVERLAP: int
    RAG_RETRIEVAL_K: int
    RAG_SIMILARITY_THRESHOLD: float

    # External Services
    RESEND_API_KEY: Optional[str] = None
    FROM_EMAIL: Optional[str] = None
    FROM_NAME: Optional[str] = None
    ADMIN_EMAIL: Optional[str] = None
    REDIS_URL: str

    # API & Security Configuration
    CORS_ORIGINS: str  # Comma-separated string, parsed manually
    ALLOWED_HOSTS: str  # Comma-separated string, parsed manually
    RATE_LIMIT_REQUESTS: int
    RATE_LIMIT_WINDOW: int
    MAX_FILE_SIZE: int
    UPLOAD_DIR: str
    API_V1_STR: str
    PROJECT_NAME: str

    # Monitoring & Observability
    PROMETHEUS_PORT: int
    GRAFANA_ADMIN_USER: Optional[str] = None
    GRAFANA_ADMIN_PASSWORD: Optional[str] = None
    GRAFANA_DOMAIN: Optional[str] = None
    GRAFANA_URL: Optional[str] = None

    # Database Security
    DATABASE_SSL_CERT: Optional[str] = None
    DATABASE_SSL_KEY: Optional[str] = None
    DATABASE_SSL_ROOT_CERT: Optional[str] = None
    DATABASE_MAX_CONNECTIONS: int = 20
    DATABASE_CONNECTION_TIMEOUT: int = 30

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()


# Parse comma-separated values
def get_cors_origins() -> List[str]:
    """Parse CORS origins from comma-separated string"""
    return [
        origin.strip() for origin in settings.CORS_ORIGINS.split(",") if origin.strip()
    ]


def get_allowed_hosts() -> List[str]:
    """Parse allowed hosts from comma-separated string"""
    return [host.strip() for host in settings.ALLOWED_HOSTS.split(",") if host.strip()]


# Construct Supabase SQLAlchemy connection string
def get_database_url() -> str:
    """Construct database URL from environment variables"""
    USER = settings.user
    PASSWORD = settings.password
    HOST = settings.host
    PORT = settings.port
    DBNAME = settings.dbname

    if not all([USER, PASSWORD, HOST, PORT, DBNAME]):
        raise ValueError("Missing required database environment variables")

    return f"postgresql+asyncpg://{USER}:{PASSWORD}@{HOST}:{PORT}/{DBNAME}"


def test_database_connection():
    pass
