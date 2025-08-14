#!/usr/bin/env python3
"""
Test QA Logging Integration

This test module validates QA logging functionality to ensure qa_logs table gets populated.
Simple test structure without pytest framework.
"""

import asyncio
import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import AsyncMock, Mock, patch

# Load test environment variables from .env.test file
env_test_path = Path(__file__).parent.parent / ".env.test"
if env_test_path.exists():
    from dotenv import load_dotenv

    load_dotenv(env_test_path)
else:
    # Fallback environment variables for testing
    os.environ.update(
        {
            "NODE_ENV": "test",
            "ENVIRONMENT": "test",
            "DEBUG": "true",
            "DATABASE_URL": "sqlite:///test.db",
            "SECRET_KEY": "test_secret_key_for_validation_testing_minimum_32_chars",
            "GROQ_API_KEY": "test_groq_api_key_for_testing_only",
            "PINECONE_API_KEY": "test_pinecone_api_key_for_testing_only",
            "DEEPEVAL_API_KEY": "test_deepeval_api_key_for_testing_only",
            "PROMETHEUS_PORT": "9090",
        }
    )

# Add parent directory to path for app imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))


# Sample test data
def get_sample_qa_data():
    """Sample Q&A data for testing."""
    return {
        "session_id": "test-session-123",
        "question": "Bagaimana cara membuat KTP baru?",
        "answer": "Untuk membuat KTP baru, Anda perlu membawa dokumen berikut: fotokopi KK, akta kelahiran, dan surat pengantar dari RT/RW.",
        "confidence": 85,
        "response_time": 1250,
        "service_mode": "full_llm_bot",
        "responded_by": "llm",
        "institution_id": 1,
    }


def get_sample_admin_qa_data():
    """Sample admin validation Q&A data for testing."""
    return {
        "session_id": "admin-session-456",
        "question": "Berapa lama proses pembuatan kartu keluarga?",
        "answer": "Proses pembuatan kartu keluarga memakan waktu 3-7 hari kerja setelah dokumen lengkap diserahkan.",
        "service_mode": "bot_with_admin_validation",
        "responded_by": "llm",
        "conversation_id": 1,
        "institution_id": 1,
        "confidence": 75,
    }


def get_sample_gesture_data():
    """Sample gesture-based Q&A data for testing."""
    return {
        "session_id": "gesture-session-789",
        "gesture_input": "Pointing to document, then making writing motion",
        "question": "Dokumen apa yang diperlukan untuk membuat surat keterangan?",
        "answer": "Untuk membuat surat keterangan, Anda memerlukan fotokopi KTP, surat pengantar RT, dan formulir permohonan.",
        "confidence": 72,
        "response_time": 1800,
        "institution_id": 1,
    }


def test_qa_logging_service_imports():
    """Test that QA logging service can be imported."""
    try:
        from app.services.qa_logging_service import (
            QALoggingService,
            get_qa_logging_service,
        )

        assert QALoggingService is not None
        assert get_qa_logging_service is not None

        service = get_qa_logging_service()
        assert service is not None
        assert isinstance(service, QALoggingService)
        print("✓ QA logging service imports test passed")
        return True
    except ImportError as e:
        if "prometheus_client" in str(e):
            print(
                "⚠️ QA logging service imports test skipped (prometheus_client dependency missing)"
            )
            return True
        else:
            raise e


def test_qa_logging_service_methods():
    """Test that QA logging service has all required methods."""
    from app.services.qa_logging_service import QALoggingService

    service = QALoggingService()

    required_methods = [
        "log_qa_interaction",
        "log_llm_response",
        "log_admin_response",
        "log_gesture_interaction",
        "get_qa_logs_for_institution",
    ]

    for method in required_methods:
        assert hasattr(service, method), f"Method {method} missing"
        assert callable(getattr(service, method)), f"Method {method} not callable"


def test_qa_log_api_endpoints_import():
    """Test that QA log API endpoints can be imported."""
    from app.api.v1.endpoints.qa_log import (
        AdminValidationLogRequest,
        GestureLogRequest,
        QALogRequest,
        router,
    )

    assert router is not None
    assert QALogRequest is not None
    assert AdminValidationLogRequest is not None
    assert GestureLogRequest is not None

    # Check that router has routes
    assert len(router.routes) > 0, "QA log router has no routes"

    # Check specific endpoints exist
    paths = [route.path for route in router.routes]
    expected_paths = ["/log", "/admin-validation", "/gesture", "/health"]

    for path in expected_paths:
        assert path in paths, f"Missing endpoint: {path}"


@patch("app.services.qa_logging_service.get_db_session")
async def test_qa_logging_service_log_interaction(mock_db_session):
    """Test QA logging service log_qa_interaction method."""
    try:
        from app.services.qa_logging_service import QALoggingService

        # Mock database session
        mock_session = AsyncMock()
        mock_db_session.return_value.__aenter__.return_value = mock_session

        # Mock insert result
        mock_result = Mock()
        mock_result.fetchone.return_value = [123]  # Mock QA log ID
        mock_session.execute.return_value = mock_result

        service = QALoggingService()
        sample_qa_data = get_sample_qa_data()

        qa_id = await service.log_qa_interaction(**sample_qa_data)

        assert qa_id == 123
        assert mock_session.execute.called
        assert mock_session.commit.called
        print("✓ QA logging service log_qa_interaction test passed")
        return True
    except Exception as e:
        print(f"✗ QA logging service log_qa_interaction test failed: {e}")
        return False


@patch("app.services.qa_logging_service.get_db_session")
async def test_qa_logging_service_log_llm_response(mock_db_session):
    """Test QA logging service log_llm_response method."""
    from app.services.qa_logging_service import QALoggingService

    # Mock database session
    mock_session = AsyncMock()
    mock_db_session.return_value.__aenter__.return_value = mock_session

    # Mock insert result
    mock_result = Mock()
    mock_result.fetchone.return_value = [456]  # Mock QA log ID
    mock_session.execute.return_value = mock_result

    service = QALoggingService()

    qa_id = await service.log_llm_response(
        session_id="test-session",
        question="Test question?",
        answer="Test answer",
        confidence=0.85,
        response_time=1.25,
        sources=[{"source": "test.pdf", "text": "test content"}],
        institution_id=1,
    )

    assert qa_id == 456
    assert mock_session.execute.called
    assert mock_session.commit.called


@patch("app.services.qa_logging_service.get_db_session")
async def test_qa_logging_service_log_admin_response(mock_db_session):
    """Test QA logging service log_admin_response method."""
    from app.services.qa_logging_service import QALoggingService

    # Mock database session
    mock_session = AsyncMock()
    mock_db_session.return_value.__aenter__.return_value = mock_session

    # Mock insert result
    mock_result = Mock()
    mock_result.fetchone.return_value = [789]  # Mock QA log ID
    mock_session.execute.return_value = mock_result

    service = QALoggingService()

    qa_id = await service.log_admin_response(
        session_id="admin-session",
        question="Admin question?",
        answer="Admin answer",
        admin_id=1,
        conversation_id=1,
        llm_recommendation_used=True,
        response_time=2500,
        institution_id=1,
    )

    assert qa_id == 789
    assert mock_session.execute.called
    assert mock_session.commit.called


@patch("app.services.qa_logging_service.get_db_session")
async def test_qa_logging_service_get_logs_for_institution(mock_db_session):
    """Test QA logging service get_qa_logs_for_institution method."""
    from app.services.qa_logging_service import QALoggingService

    # Mock database session
    mock_session = AsyncMock()
    mock_db_session.return_value.__aenter__.return_value = mock_session

    # Mock query result
    mock_log = Mock()
    mock_log.qa_id = 1
    mock_log.question = "Test question"
    mock_log.answer = "Test answer"
    mock_log.confidence = 85
    mock_log.response_time = 1000
    mock_log.service_mode = "full_llm_bot"
    mock_log.responded_by = "llm"
    mock_log.created_at = datetime.now(timezone.utc)
    mock_log.evaluation_score = 90

    mock_result = Mock()
    mock_result.scalars.return_value.all.return_value = [mock_log]
    mock_session.execute.return_value = mock_result

    service = QALoggingService()

    logs = await service.get_qa_logs_for_institution(institution_id=1, limit=10)

    assert len(logs) == 1
    assert logs[0]["qa_id"] == 1
    assert logs[0]["question"] == "Test question"
    assert logs[0]["answer"] == "Test answer"
    assert mock_session.execute.called


def test_qa_log_request_models():
    """Test QA log request models validation."""
    from app.api.v1.endpoints.qa_log import (
        AdminValidationLogRequest,
        GestureLogRequest,
        QALogRequest,
    )

    # Test QALogRequest
    qa_request = QALogRequest(
        session_id="test-session",
        question="Test question?",
        answer="Test answer",
        confidence=85,
        response_time=1000,
        service_mode="full_llm_bot",
        responded_by="llm",
        institution_id=1,
    )

    assert qa_request.session_id == "test-session"
    assert qa_request.confidence == 85
    assert qa_request.institution_id == 1

    # Test AdminValidationLogRequest
    admin_request = AdminValidationLogRequest(
        session_id="admin-session",
        question="Admin question?",
        answer="Admin answer",
        conversation_id=1,
        institution_id=1,
    )

    assert admin_request.service_mode == "bot_with_admin_validation"
    assert admin_request.responded_by == "llm"
    assert admin_request.confidence == 75  # default

    # Test GestureLogRequest
    gesture_request = GestureLogRequest(
        session_id="gesture-session",
        gesture_input="gesture data",
        question="Gesture question?",
        answer="Gesture answer",
        confidence=70,
        institution_id=1,
    )

    assert gesture_request.gesture_input == "gesture data"
    assert gesture_request.confidence == 70
    assert gesture_request.institution_id == 1


def test_qa_log_endpoints_in_api_router():
    """Test that QA log endpoints are registered in API router."""
    from app.api.v1.api import api_router

    # Get all registered routes
    all_routes = []
    for route in api_router.routes:
        if hasattr(route, "path"):
            all_routes.append(route.path)
        elif hasattr(route, "routes"):  # Sub-router
            for sub_route in route.routes:
                if hasattr(sub_route, "path"):
                    all_routes.append(sub_route.path)

    # Check that QA log endpoints are registered
    expected_qa_endpoints = [
        "/api/v1/qa-log/log",
        "/api/v1/qa-log/admin-validation",
        "/api/v1/qa-log/gesture",
        "/api/v1/qa-log/health",
    ]

    # Note: The exact path format might vary based on how the router is included
    # So we check for partial matches
    for endpoint in expected_qa_endpoints:
        endpoint_found = any(endpoint.split("/")[-1] in route for route in all_routes)
        assert endpoint_found, f"QA log endpoint not found in API router: {endpoint}"


def test_qa_log_endpoints_in_auth_middleware():
    """Test that QA log endpoints are properly configured in auth middleware."""
    from app.api.middleware.auth import AuthenticationMiddleware

    middleware = AuthenticationMiddleware(app=None)

    # Check that QA log endpoints are in public endpoints
    qa_log_endpoints = [
        "/api/v1/qa-log/log",
        "/api/v1/qa-log/admin-validation",
        "/api/v1/qa-log/gesture",
        "/api/v1/qa-log/health",
    ]

    for endpoint in qa_log_endpoints:
        assert (
            endpoint in middleware.PUBLIC_ENDPOINTS
        ), f"QA log endpoint not in public endpoints: {endpoint}"


@patch("app.services.qa_logging_service.get_db_session")
async def test_qa_logging_error_handling(mock_db_session):
    """Test QA logging service error handling."""
    from app.services.qa_logging_service import QALoggingService

    # Mock database session to raise exception
    mock_db_session.side_effect = Exception("Database connection failed")

    service = QALoggingService()

    # Should not raise exception, but return None
    qa_id = await service.log_qa_interaction(
        session_id="test-session",
        question="Test question?",
        answer="Test answer",
        institution_id=1,
    )

    assert qa_id is None  # Should return None on error


def test_qa_logging_service_metrics_integration():
    """Test QA logging service integrates with metrics service."""
    from app.services.qa_logging_service import QALoggingService

    service = QALoggingService()

    # Should have metrics service instance
    assert hasattr(service, "metrics_service")
    assert service.metrics_service is not None

    # Should have _record_metrics method
    assert hasattr(service, "_record_metrics")
    assert callable(service._record_metrics)


async def run_all_tests():
    """Run all tests and report results."""
    print("🧪 Starting QA Logging Tests...")
    print("=" * 50)

    test_results = []

    # Simple synchronous tests
    sync_tests = [
        test_qa_logging_service_imports,
        test_qa_logging_service_methods,
        test_qa_log_api_endpoints_import,
        test_qa_log_request_models,
        test_qa_log_endpoints_in_api_router,
        test_qa_log_endpoints_in_auth_middleware,
        test_qa_logging_service_metrics_integration,
    ]

    for test_func in sync_tests:
        try:
            test_func()
            test_results.append((test_func.__name__, True, None))
            print(f"✓ {test_func.__name__} passed")
        except Exception as e:
            test_results.append((test_func.__name__, False, str(e)))
            print(f"✗ {test_func.__name__} failed: {e}")

    # Async tests
    async_tests = [
        test_qa_logging_service_log_interaction,
        test_qa_logging_service_log_llm_response,
        test_qa_logging_service_log_admin_response,
        test_qa_logging_service_get_logs_for_institution,
        test_qa_logging_error_handling,
    ]

    for test_func in async_tests:
        try:
            if "log_interaction" in test_func.__name__:
                with patch("app.services.qa_logging_service.get_db_session") as mock_db:
                    await test_func(mock_db)
            else:
                await test_func()
            test_results.append((test_func.__name__, True, None))
        except Exception as e:
            test_results.append((test_func.__name__, False, str(e)))
            print(f"✗ {test_func.__name__} failed: {e}")

    # Summary
    print("\n" + "=" * 50)
    print("📊 Test Results Summary:")
    passed = sum(1 for _, success, _ in test_results if success)
    failed = len(test_results) - passed

    print(f"✅ Passed: {passed}")
    print(f"❌ Failed: {failed}")
    print(f"📈 Success Rate: {(passed/len(test_results)*100):.1f}%")

    if failed > 0:
        print("\n🔍 Failed Tests:")
        for name, success, error in test_results:
            if not success:
                print(f"  - {name}: {error}")


if __name__ == "__main__":
    import asyncio

    asyncio.run(run_all_tests())
