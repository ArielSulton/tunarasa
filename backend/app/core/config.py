"""
Application configuration settings
"""

import os
from typing import List, Optional
from urllib.parse import quote_plus

from dotenv import load_dotenv
from pydantic_settings import BaseSettings
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import QueuePool

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
    NEXT_PUBLIC_ENABLE_CLERK_AUTH: Optional[str] = None
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: Optional[str] = None
    CLERK_SECRET_KEY: Optional[str] = None
    CLERK_WEBHOOK_SIGNING_SECRET: Optional[str] = None
    NEXT_PUBLIC_CLERK_SIGN_IN_URL: Optional[str] = None
    NEXT_PUBLIC_CLERK_SIGN_UP_URL: Optional[str] = None
    NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL: Optional[str] = None
    NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL: Optional[str] = None

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


# Construct secure Supabase SQLAlchemy connection string
def get_database_url() -> str:
    """Construct secure database URL with enhanced security parameters"""
    # Support both environment variables and settings
    USER = os.getenv("user") or settings.user
    PASSWORD = os.getenv("password") or settings.password
    HOST = os.getenv("host") or settings.host
    PORT = os.getenv("port") or settings.port
    DBNAME = os.getenv("dbname") or settings.dbname

    if not all([USER, PASSWORD, HOST, PORT, DBNAME]):
        raise ValueError("Missing required database environment variables")

    # URL encode credentials to handle special characters
    encoded_user = quote_plus(USER)
    encoded_password = quote_plus(PASSWORD)

    # Enhanced security parameters for production
    security_params = {
        "sslmode": "require",
        "connect_timeout": "10",
        "command_timeout": "30",
        "application_name": "tunarasa_backend",
        "tcp_keepalives_idle": "600",
        "tcp_keepalives_interval": "30",
        "tcp_keepalives_count": "3",
    }

    # Build connection string with security parameters
    params_string = "&".join([f"{k}={v}" for k, v in security_params.items()])

    return f"postgresql+psycopg2://{encoded_user}:{encoded_password}@{HOST}:{PORT}/{DBNAME}?{params_string}"


# Support for async database connection (dimas-dev feature)
def get_async_database_url() -> str:
    """Construct async database URL for async operations"""
    USER = os.getenv("user") or settings.user
    PASSWORD = os.getenv("password") or settings.password
    HOST = os.getenv("host") or settings.host
    PORT = os.getenv("port") or settings.port
    DBNAME = os.getenv("dbname") or settings.dbname

    if not all([USER, PASSWORD, HOST, PORT, DBNAME]):
        raise ValueError("Missing required database environment variables")

    return f"postgresql+asyncpg://{USER}:{PASSWORD}@{HOST}:{PORT}/{DBNAME}"


# Create secure SQLAlchemy engine with connection pooling
engine = create_engine(
    get_database_url(),
    poolclass=QueuePool,
    pool_size=5,  # Maximum number of connections to maintain in pool
    max_overflow=10,  # Maximum number of connections that can be created beyond pool_size
    pool_pre_ping=True,  # Validate connections before use
    pool_recycle=3600,  # Recycle connections every hour
    pool_timeout=30,  # Timeout for getting connection from pool
    echo=settings.DEBUG,  # Log SQL queries in debug mode
    echo_pool=settings.DEBUG,  # Log connection pool events in debug mode
    connect_args={
        "sslmode": "require",
        "connect_timeout": 10,
        "command_timeout": 30,
        "application_name": "tunarasa_backend",
        # Additional security options
        "options": "-c default_transaction_isolation=read_committed",
    },
)

# Create SessionLocal class
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


# Database dependency
def get_db():
    """Database session dependency"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# Enhanced database connection testing
def test_database_connection():
    """Test database connection with comprehensive checks"""
    try:
        # Test basic connection
        with engine.connect() as connection:
            # Test SSL connection
            ssl_result = connection.execute("SELECT ssl_is_used()").scalar()
            if not ssl_result:
                print("⚠️ Warning: SSL is not enabled for database connection")
            else:
                print("🔒 SSL connection verified")

            # Test connection parameters
            app_name_result = connection.execute(
                "SELECT current_setting('application_name')"
            ).scalar()
            if app_name_result != "tunarasa_backend":
                print(f"⚠️ Warning: Unexpected application name: {app_name_result}")

            # Test basic query performance
            import time

            start_time = time.time()
            connection.execute("SELECT 1").scalar()
            query_time = time.time() - start_time

            print(
                f"✅ Database connection successful! (SSL: {ssl_result}, Query time: {query_time:.3f}s)"
            )
            return True

    except Exception as e:
        print(f"❌ Failed to connect to database: {e}")
        return False


# Connection health check for monitoring
def get_database_health() -> dict:
    """Get database connection health status"""
    try:
        with engine.connect() as connection:
            # Basic connectivity test
            connection.execute("SELECT 1").scalar()

            # Pool status
            pool = engine.pool

            return {
                "status": "healthy",
                "ssl_enabled": bool(
                    connection.execute("SELECT ssl_is_used()").scalar()
                ),
                "pool_size": pool.size(),
                "checked_in": pool.checkedin(),
                "checked_out": pool.checkedout(),
                "overflow": pool.overflow(),
                "invalid": pool.invalidated(),
            }
    except Exception as e:
        return {"status": "unhealthy", "error": str(e)}
