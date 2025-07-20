"""
Simple functional tests for admin validation and deepeval monitoring
"""

import pytest
import asyncio
import os
from unittest.mock import Mock, AsyncMock, patch
from datetime import datetime
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


class TestAdminValidation:
    """Test admin validation system"""
    
    def test_import_validation_service(self):
        """Test importing admin validation service"""
        from app.middleware.admin_validation import (
            AdminValidationService, 
            ValidationLevel, 
            ValidationCategory
        )
        assert AdminValidationService is not None
        assert ValidationLevel.ERROR is not None
        assert ValidationCategory.SECURITY is not None
    
    @pytest.mark.asyncio
    async def test_admin_validation_basic(self):
        """Test basic admin validation functionality"""
        from app.middleware.admin_validation import AdminValidationService
        
        service = AdminValidationService()
        # Mock Redis to avoid connection issues
        service.redis_client = Mock()
        service.redis_client.get = AsyncMock(return_value=None)
        service.redis_client.setex = AsyncMock()
        
        # Create mock request
        mock_request = Mock()
        mock_request.client = Mock()
        mock_request.client.host = '127.0.0.1'
        mock_request.headers = {'user-agent': 'test-browser'}
        mock_request.state = Mock()
        mock_request.state.user = Mock()
        mock_request.state.user.get = Mock(return_value={'role': 'admin'})
        
        # Test validation
        results = await service.validate_admin_request(mock_request, 'test_operation')
        
        assert len(results) > 0
        assert all(hasattr(result, 'category') for result in results)
        assert all(hasattr(result, 'level') for result in results)
        assert all(hasattr(result, 'message') for result in results)


class TestDeepEvalMonitoring:
    """Test DeepEval monitoring system"""
    
    def test_import_deepeval_service(self):
        """Test importing deepeval monitoring service"""
        from app.services.deepeval_monitoring import (
            DeepEvalMonitoringService,
            EvaluationCategory,
            LLMConversation
        )
        assert DeepEvalMonitoringService is not None
        assert EvaluationCategory.RELEVANCY is not None
        assert LLMConversation is not None
    
    def test_deepeval_service_initialization(self):
        """Test DeepEval service initialization"""
        from app.services.deepeval_monitoring import DeepEvalMonitoringService
        
        service = DeepEvalMonitoringService()
        # Mock Redis to avoid connection issues  
        service.redis_client = Mock()
        
        assert service is not None
        assert hasattr(service, 'metrics')
        assert hasattr(service, 'performance_metrics')
        assert len(service.metrics) > 0
    
    def test_llm_conversation_creation(self):
        """Test LLM conversation data structure"""
        from app.services.deepeval_monitoring import LLMConversation
        
        conversation = LLMConversation(
            conversation_id='test_001',
            user_question='What is sign language?',
            llm_response='Sign language is a visual communication method.',
            context_documents=['Document 1'],
            response_time=1.5,
            model_used='llama3-70b-8192',
            confidence_score=0.85
        )
        
        assert conversation.conversation_id == 'test_001'
        assert conversation.user_question == 'What is sign language?'
        assert conversation.response_time == 1.5
        assert conversation.model_used == 'llama3-70b-8192'
        assert conversation.confidence_score == 0.85


class TestIntegration:
    """Integration tests for both systems"""
    
    def test_services_work_together(self):
        """Test that both services can be imported and initialized together"""
        from app.middleware.admin_validation import AdminValidationService
        from app.services.deepeval_monitoring import DeepEvalMonitoringService
        
        admin_service = AdminValidationService()
        deepeval_service = DeepEvalMonitoringService()
        
        # Mock Redis for both services
        admin_service.redis_client = Mock()
        deepeval_service.redis_client = Mock()
        
        assert admin_service is not None
        assert deepeval_service is not None
        assert hasattr(admin_service, 'redis_client')
        assert hasattr(deepeval_service, 'metrics')


if __name__ == "__main__":
    pytest.main([__file__, "-v"])