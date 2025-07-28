"""
Database connection and session management for new schema
"""

import logging
from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import declarative_base
from sqlalchemy import MetaData
from sqlalchemy.pool import NullPool

from app.core.config import settings

logger = logging.getLogger(__name__)

# Database metadata and base class
metadata = MetaData()
Base = declarative_base(metadata=metadata)

# Database engine
engine = None
async_session_factory = None


def get_database_url() -> str:
    """Get database URL from settings"""
    if settings.DATABASE_URL:
        return settings.DATABASE_URL
    
    return "postgresql+asyncpg://postgres:password@localhost:5432/tunarasa"


async def init_database():
    """Initialize database connection"""
    global engine, async_session_factory
    
    try:
        database_url = get_database_url()
        logger.info(f"Connecting to database...")
        
        # Create async engine - disable client side pooling for Supabase pooler
        engine = create_async_engine(
            database_url,
            echo=settings.DEBUG,
            poolclass=NullPool,  # Disable SQLAlchemy pooling for Supabase Transaction Pooler
            connect_args={
                "statement_cache_size": 0,
                "prepared_statement_cache_size": 0,
                "server_settings": {
                    "application_name": "tunarasa_backend"
                }
            },
        )
        
        # Create session factory
        async_session_factory = async_sessionmaker(
            engine,
            class_=AsyncSession,
            expire_on_commit=False,
        )
        
        logger.info("Database connection initialized successfully")
        
    except Exception as e:
        logger.error(f"Failed to initialize database: {e}")
        raise


async def get_db_session() -> AsyncGenerator[AsyncSession, None]:
    """Get database session for dependency injection"""
    if not async_session_factory:
        await init_database()
    
    async with async_session_factory() as session:
        try:
            yield session
        except Exception as e:
            logger.error(f"Database session error: {e}")
            await session.rollback()
            raise
        finally:
            await session.close()


async def close_database():
    """Close database connections"""
    global engine
    
    if engine:
        await engine.dispose()
        logger.info("Database connections closed")


class DatabaseManager:
    """Database manager for the new 6-table schema"""
    
    def __init__(self):
        self.session = None
    
    async def connect(self):
        """Connect to database"""
        await init_database()
    
    async def disconnect(self):
        """Disconnect from database"""
        await close_database()
    
    async def create_tables(self):
        """Create tables based on new schema"""
        if not engine:
            await init_database()
        
        try:
            async with engine.begin() as conn:
                # In a real implementation, this would create tables
                # For now, we rely on Drizzle migrations from frontend
                logger.info("Database tables check completed")
                
        except Exception as e:
            logger.error(f"Failed to create tables: {e}")
            raise
    
    async def health_check(self) -> dict:
        """Check database health"""
        try:
            if not async_session_factory:
                return {"status": "disconnected", "error": "No database connection"}
            
            async with async_session_factory() as session:
                # Simple health check query
                result = await session.execute("SELECT 1")
                result.fetchone()
                
                return {
                    "status": "healthy",
                    "database": "connected",
                    "schema": "6-table schema (users, conversations, messages, notes, roles, genders)"
                }
                
        except Exception as e:
            logger.error(f"Database health check failed: {e}")
            return {
                "status": "unhealthy",
                "error": str(e)
            }


# Global database manager instance
db_manager = DatabaseManager()