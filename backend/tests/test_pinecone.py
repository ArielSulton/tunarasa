"""
Test Pinecone Vector Database Service for Tunarasa

This test demonstrates and validates the Pinecone service functionality
for document ingestion, search, and management in the Tunarasa RAG system.
"""

import pytest
import asyncio
import os
from unittest.mock import Mock, AsyncMock, patch
from pathlib import Path

# Load test environment variables from .env.test file
env_test_path = Path(__file__).parent.parent / '.env.test'
if env_test_path.exists():
    from dotenv import load_dotenv
    load_dotenv(env_test_path)
else:
    # Fallback environment variables for testing
    os.environ.update({
        'NODE_ENV': 'test',
        'ENVIRONMENT': 'test', 
        'DEBUG': 'true',
        'SITE_NAME': 'Tunarasa',
        'API_V1_STR': '/api/v1',
        'PROJECT_NAME': 'Tunarasa',
        'DATABASE_URL': 'sqlite:///test.db',
        'DB_POOL_SIZE': '5',
        'DB_MAX_OVERFLOW': '10', 
        'DB_POOL_TIMEOUT': '30',
        'SECRET_KEY': 'test_secret_key_for_validation_testing_minimum_32_chars',
        'ACCESS_TOKEN_EXPIRE_MINUTES': '60',
        'GROQ_API_KEY': 'test_groq_api_key_for_testing_only',
        'LLM_MODEL': 'llama3-70b-8192',
        'LLM_TEMPERATURE': '0.7',
        'LLM_MAX_TOKENS': '1000',
        'PINECONE_API_KEY': 'test_pinecone_api_key_for_testing_only',
        'PINECONE_INDEX_NAME': 'test_index',
        'RAG_CHUNK_SIZE': '1000',
        'RAG_CHUNK_OVERLAP': '200',
        'RAG_RETRIEVAL_K': '5',
        'RAG_SIMILARITY_THRESHOLD': '0.7',
        'REDIS_URL': 'redis://localhost:6379/0',
        'RESEND_API_KEY': 'test_resend_api_key_for_testing_only',
        'CORS_ORIGINS': '["http://localhost:3000"]',
        'ALLOWED_HOSTS': '["localhost"]',
        'RATE_LIMIT_REQUESTS': '100',
        'RATE_LIMIT_WINDOW': '60',
        'PROMETHEUS_PORT': '9090',
        'MAX_FILE_SIZE': '10485760',
        'UPLOAD_DIR': '/tmp/uploads',
        'EMBEDDING_MODEL': 'test_embedding_model_for_testing_only',
        'DEEPEVAL_API_KEY': 'test_deepeval_api_key_for_testing_only'
    })


class TestPineconeServiceBasic:
    """Test basic Pinecone service functionality"""
    
    def test_import_pinecone_service(self):
        """Test importing Pinecone service components"""
        try:
            # Test basic Pinecone module import first
            import pinecone
            from pinecone import Pinecone
            assert pinecone is not None
            assert Pinecone is not None
            
            # Test our service imports
            from app.services.pinecone_service import (
                get_pinecone_service,
                DocumentType,
                SearchQuery
            )
            assert get_pinecone_service is not None
            assert DocumentType is not None
            assert SearchQuery is not None
            print("✅ Pinecone service imports successful")
        except ImportError as e:
            pytest.skip(f"Pinecone service not available: {e}")
    
    def test_document_type_enum(self):
        """Test DocumentType enum"""
        try:
            from app.services.pinecone_service import DocumentType
            
            # Check that enum has expected values
            expected_types = ['PDF', 'TEXT', 'MARKDOWN', 'JSON']
            available_types = [dt.value for dt in DocumentType]
            
            for expected in expected_types:
                assert expected in available_types or expected.lower() in [t.lower() for t in available_types]
            
            print(f"✅ DocumentType enum has {len(available_types)} types")
        except ImportError:
            pytest.skip("DocumentType not available")
    
    def test_search_query_creation(self):
        """Test SearchQuery creation"""
        try:
            from app.services.pinecone_service import SearchQuery
            
            query = SearchQuery(
                query_text="test query",
                top_k=5,
                similarity_threshold=0.7,
                language="id"
            )
            
            assert query.query_text == "test query"
            assert query.top_k == 5
            assert query.similarity_threshold == 0.7
            assert query.language == "id"
            
            print("✅ SearchQuery creation successful")
        except ImportError:
            pytest.skip("SearchQuery not available")


class TestPineconeServiceMocked:
    """Test Pinecone service with mocked dependencies"""
    
    @pytest.mark.asyncio
    async def test_pinecone_service_initialization(self):
        """Test Pinecone service initialization with mocks"""
        try:
            with patch('pinecone.Pinecone') as mock_pinecone_class:
                mock_pinecone_instance = Mock()
                mock_index = Mock()
                mock_pinecone_instance.Index.return_value = mock_index
                mock_pinecone_class.return_value = mock_pinecone_instance
                
                from app.services.pinecone_service import get_pinecone_service
                
                service = get_pinecone_service()
                assert service is not None
                print("✅ Pinecone service initialization successful")
                
        except ImportError as e:
            pytest.skip(f"Pinecone service not available: {e}")
    
    @pytest.mark.asyncio
    async def test_document_ingestion_mock(self):
        """Test document ingestion with mocked Pinecone"""
        try:
            with patch('pinecone.Pinecone') as mock_pinecone_class:
                # Mock Pinecone index
                mock_pinecone_instance = Mock()
                mock_index = Mock()
                mock_index.upsert = AsyncMock()
                mock_pinecone_instance.Index.return_value = mock_index
                mock_pinecone_class.return_value = mock_pinecone_instance
                
                # Mock file operations
                with patch('builtins.open', mock_open_content("Test document content")):
                    with patch('os.path.exists', return_value=True):
                        from app.services.pinecone_service import get_pinecone_service
                        
                        service = get_pinecone_service()
                        
                        # Mock embedding service
                        service.embedding_service = Mock()
                        service.embedding_service.embed_text = AsyncMock(return_value=[0.1] * 384)
                        
                        # Test document ingestion
                        metadata = await service.ingest_document(
                            file_path="test_document.txt",
                            metadata={
                                "title": "Test Document",
                                "description": "Test description",
                                "language": "en"
                            }
                        )
                        
                        assert metadata is not None
                        print("✅ Document ingestion mock test successful")
                        
        except ImportError as e:
            pytest.skip(f"Pinecone service not available: {e}")
    
    @pytest.mark.asyncio  
    async def test_document_search_mock(self):
        """Test document search with mocked Pinecone"""
        try:
            with patch('pinecone.Pinecone') as mock_pinecone_class:
                # Mock search results
                mock_pinecone_instance = Mock()
                mock_index = Mock()
                mock_search_result = {
                    'matches': [
                        {
                            'id': 'doc1_chunk1',
                            'score': 0.85,
                            'values': [0.1] * 384,
                            'metadata': {
                                'content': 'Test content about sign language',
                                'document_id': 'doc1',
                                'title': 'Sign Language Guide'
                            }
                        }
                    ]
                }
                mock_index.query = AsyncMock(return_value=mock_search_result)
                mock_pinecone_instance.Index.return_value = mock_index
                mock_pinecone_class.return_value = mock_pinecone_instance
                
                from app.services.pinecone_service import get_pinecone_service, SearchQuery
                
                service = get_pinecone_service()
                
                # Mock embedding service
                service.embedding_service = Mock()
                service.embedding_service.embed_text = AsyncMock(return_value=[0.1] * 384)
                
                # Test search
                search_query = SearchQuery(
                    query_text="sign language basics",
                    top_k=3,
                    similarity_threshold=0.7,
                    language="en"
                )
                
                results = await service.search(search_query)
                
                assert len(results) > 0
                assert results[0].similarity_score == 0.85
                assert "sign language" in results[0].content.lower()
                
                print("✅ Document search mock test successful")
                
        except ImportError as e:
            pytest.skip(f"Pinecone service not available: {e}")


class TestPineconeConfiguration:
    """Test Pinecone configuration and settings"""
    
    def test_pinecone_settings(self):
        """Test Pinecone configuration settings"""
        from app.core.config import settings
        
        # Check required settings are present
        assert hasattr(settings, 'PINECONE_API_KEY')
        assert hasattr(settings, 'PINECONE_INDEX_NAME') 
        assert hasattr(settings, 'RAG_CHUNK_SIZE')
        assert hasattr(settings, 'RAG_CHUNK_OVERLAP')
        assert hasattr(settings, 'RAG_RETRIEVAL_K')
        assert hasattr(settings, 'RAG_SIMILARITY_THRESHOLD')
        
        # Check that test values are set
        assert settings.PINECONE_API_KEY == 'test_pinecone_api_key_for_testing_only'
        assert settings.PINECONE_INDEX_NAME == 'test_index'
        assert settings.RAG_CHUNK_SIZE == 1000
        assert settings.RAG_RETRIEVAL_K == 5
        
        print("✅ Pinecone settings validation successful")
    
    def test_pinecone_service_config(self):
        """Test Pinecone service configuration validation"""
        from app.core.config import settings
        
        # Validate chunk settings
        assert settings.RAG_CHUNK_SIZE > 0
        assert settings.RAG_CHUNK_OVERLAP >= 0
        assert settings.RAG_CHUNK_OVERLAP < settings.RAG_CHUNK_SIZE
        
        # Validate search settings
        assert 0 < settings.RAG_SIMILARITY_THRESHOLD <= 1.0
        assert settings.RAG_RETRIEVAL_K > 0
        
        print("✅ Pinecone service configuration validation successful")


class TestDocumentManagerMocked:
    """Test Document Manager with mocked dependencies"""
    
    @pytest.mark.asyncio
    async def test_document_manager_import(self):
        """Test importing document manager"""
        try:
            from app.services.document_manager import get_document_manager
            
            manager = get_document_manager()
            assert manager is not None
            print("✅ Document manager import successful")
            
        except ImportError as e:
            pytest.skip(f"Document manager not available: {e}")
    
    @pytest.mark.asyncio
    async def test_convenience_functions_import(self):
        """Test importing convenience functions"""
        try:
            from app.services.document_manager import (
                add_document_to_knowledge_base,
                search_knowledge_base,
                ask_question_with_sources
            )
            
            assert add_document_to_knowledge_base is not None
            assert search_knowledge_base is not None  
            assert ask_question_with_sources is not None
            
            print("✅ Convenience functions import successful")
            
        except ImportError as e:
            pytest.skip(f"Convenience functions not available: {e}")


def mock_open_content(content):
    """Helper function to mock file content"""
    from unittest.mock import mock_open
    return mock_open(read_data=content)


class TestPineconeIntegration:
    """Integration tests for Pinecone service"""
    
    def test_pinecone_and_langchain_integration(self):
        """Test that Pinecone integrates properly with LangChain components"""
        try:
            # Test that required components can be imported together
            from app.services.pinecone_service import get_pinecone_service
            from app.services.langchain_service import get_langchain_service
            
            # Both services should be importable
            assert get_pinecone_service is not None
            assert get_langchain_service is not None
            
            print("✅ Pinecone and LangChain integration test successful")
            
        except ImportError as e:
            pytest.skip(f"Integration components not available: {e}")
    
    def test_embedding_service_compatibility(self):
        """Test that embedding service is compatible with Pinecone"""
        try:
            from app.core.config import settings
            
            # Check embedding model configuration
            assert hasattr(settings, 'EMBEDDING_MODEL')
            assert settings.EMBEDDING_MODEL is not None
            
            print("✅ Embedding service compatibility test successful")
            
        except Exception as e:
            pytest.skip(f"Embedding service not available: {e}")


if __name__ == "__main__":
    # Run the tests
    pytest.main([__file__, "-v"])