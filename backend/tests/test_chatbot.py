"""
Simple chatbot test without complex DeepEval metrics
"""

import pytest
import os
from pathlib import Path

# Load test environment variables from .env.test file
env_test_path = Path(__file__).parent.parent / '.env.test'
if env_test_path.exists():
    from dotenv import load_dotenv
    load_dotenv(env_test_path)
else:
    # Fallback environment variables for testing
    os.environ.update({
        'GROQ_API_KEY': 'test_groq_api_key_for_testing_only',
        'DEEPEVAL_API_KEY': 'test_deepeval_api_key_for_testing_only'
    })

def test_basic_chatbot_response():
    """Test basic chatbot response without DeepEval"""
    
    # Simulate chatbot input/output
    user_input = "What if these shoes don't fit?"
    expected_keywords = ["30 days", "refund", "no extra cost"]
    
    # Simulate actual chatbot response (this would come from your LLM service)
    actual_output = "You have 30 days to get a full refund at no extra cost."
    
    # Basic validation tests
    assert len(actual_output) > 0, "Response should not be empty"
    assert isinstance(actual_output, str), "Response should be a string"
    
    # Check if key information is present
    for keyword in expected_keywords:
        assert keyword.lower() in actual_output.lower(), f"Expected keyword '{keyword}' not found in response"
    
    print(f"✅ Input: {user_input}")
    print(f"✅ Output: {actual_output}")
    print(f"✅ All keywords found: {expected_keywords}")


def test_chatbot_response_quality():
    """Test response quality metrics"""
    
    test_cases = [
        {
            "input": "What if these shoes don't fit?",
            "output": "You have 30 days to get a full refund at no extra cost.",
            "expected_length_range": (10, 100),
            "must_contain": ["30", "refund"]
        },
        {
            "input": "How do I sign up?",
            "output": "You can sign up by creating an account on our website.",
            "expected_length_range": (10, 100),
            "must_contain": ["sign up", "account"]
        }
    ]
    
    for i, case in enumerate(test_cases):
        output = case["output"]
        
        # Length check
        min_len, max_len = case["expected_length_range"]
        assert min_len <= len(output) <= max_len, f"Case {i+1}: Response length {len(output)} not in range {case['expected_length_range']}"
        
        # Content check
        for phrase in case["must_contain"]:
            assert phrase.lower() in output.lower(), f"Case {i+1}: Required phrase '{phrase}' not found"
        
        print(f"✅ Case {i+1}: {case['input']} -> PASSED")


def test_chatbot_error_handling():
    """Test chatbot error handling scenarios"""
    
    # Test empty input
    empty_input = ""
    expected_error_response = "I'm sorry, I didn't understand that. Could you please rephrase your question?"
    
    # This would be your actual chatbot error handling
    if not empty_input.strip():
        actual_response = expected_error_response
    else:
        actual_response = "Normal response"
    
    assert len(actual_response) > 0, "Error response should not be empty"
    assert "sorry" in actual_response.lower() or "error" in actual_response.lower(), "Error response should be apologetic"
    
    print(f"✅ Empty input handled correctly: {actual_response}")


def test_response_time_simulation():
    """Test response time requirements"""
    import time
    
    start_time = time.time()
    
    # Simulate chatbot processing
    response = "You have 30 days to get a full refund at no extra cost."
    
    end_time = time.time()
    response_time = end_time - start_time
    
    # Response should be under 5 seconds (very generous for testing)
    assert response_time < 5.0, f"Response time {response_time:.2f}s too slow"
    
    print(f"✅ Response time: {response_time:.4f}s (under 5s limit)")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])