# 🧪 Tunarasa Backend Testing Guide

**Secure Testing Environment for Tunarasa Backend**

---

## 🔒 **Security First**

**IMPORTANT**: All tests use **mock/test API keys only**. Real API keys are **NEVER** hardcoded in test files.

### ✅ **Safe Testing Practices**
- Tests load environment from `.env.test` file
- Fallback to secure test placeholders if `.env.test` not found
- All external API calls are mocked during testing
- No real API keys exposed in source code

### ❌ **Security Violations**
- **NEVER** commit real API keys to version control
- **NEVER** hardcode production credentials in test files
- **NEVER** use production databases for testing

---

## 🚀 **Quick Start**

### **Setup Test Environment**
```bash
cd backend/

# Ensure .env.test exists with test credentials
ls .env.test

# Install dependencies
pip install -r requirements.txt

# Run all tests
python -m pytest

# Run specific test file
python -m pytest tests/test_chatbot.py -v

# Run with detailed output
python -m pytest tests/ -v --tb=short
```

---

## 📁 **Test Structure**

```
backend/tests/
├── README.md                    # This file
├── test_chatbot.py             # Basic chatbot functionality tests
├── test_pinecone.py            # Pinecone service and RAG tests
└── test_integration.py         # Admin validation & monitoring tests
```

---

## 🔧 **Test Configuration**

### **Environment Variables**
Tests use `.env.test` file from backend directory:

```env
# backend/.env.test
GROQ_API_KEY=test_groq_api_key_for_testing_only
PINECONE_API_KEY=test_pinecone_api_key_for_testing_only
DEEPEVAL_API_KEY=test_deepeval_api_key_for_testing_only
# ... other test configurations
```

### **Fallback Configuration**
If `.env.test` is not found, tests use hardcoded safe placeholders:
- `test_groq_api_key_for_testing_only`
- `test_pinecone_api_key_for_testing_only`
- `test_deepeval_api_key_for_testing_only`

---

## 🧪 **Test Categories**

### **1. Basic Functionality Tests** (`test_chatbot.py`)
- ✅ **Basic Response Validation**: Response format and content validation
- ✅ **Quality Metrics**: Response length and keyword presence
- ✅ **Error Handling**: Empty input and error scenarios
- ✅ **Performance**: Response time requirements

```bash
# Run chatbot tests
python -m pytest tests/test_chatbot.py -v
```

### **2. Pinecone & RAG Tests** (`test_pinecone.py`)
- ✅ **Service Import**: Module and component availability
- ✅ **Configuration**: Settings validation and compatibility
- ✅ **Mocked Operations**: Document ingestion and search with mocks
- ✅ **Integration**: LangChain and embedding service compatibility

```bash
# Run Pinecone tests
python -m pytest tests/test_pinecone.py -v
```

### **3. Integration Tests** (`test_integration.py`)
- ✅ **Admin Validation**: Validation service functionality
- ✅ **DeepEval Monitoring**: Monitoring service operations
- ✅ **Service Integration**: Multiple services working together

```bash
# Run integration tests
python -m pytest tests/test_integration.py -v
```

---

## 🔒 **Security Features**

### **API Key Protection**
1. **Environment Loading**: Tests load from `.env.test` using python-dotenv
2. **Safe Fallbacks**: Hardcoded test placeholders if env file missing
3. **Mock External Calls**: All API calls are mocked, no real requests
4. **Clear Naming**: Test keys clearly labeled as "for_testing_only"

### **Test Isolation**
- SQLite in-memory database for tests
- Mocked Redis connections
- No external service dependencies
- Isolated environment variables

---

## 🚦 **Running Tests**

### **Individual Tests**
```bash
# Test basic chatbot functionality
python -m pytest tests/test_chatbot.py::test_basic_chatbot_response -v

# Test Pinecone configuration
python -m pytest tests/test_pinecone.py::TestPineconeConfiguration -v

# Test admin validation
python -m pytest tests/test_integration.py::TestAdminValidation -v
```

### **Test Categories**
```bash
# All basic tests
python -m pytest tests/test_chatbot.py -v

# All Pinecone tests
python -m pytest tests/test_pinecone.py -v

# All integration tests
python -m pytest tests/test_integration.py -v
```

### **Full Test Suite**
```bash
# All tests with coverage
python -m pytest tests/ -v --cov=app --cov-report=html

# All tests with detailed output
python -m pytest tests/ -v --tb=long
```

---

## 🔍 **Test Validation**

### **Expected Output**
```
tests/test_chatbot.py::test_basic_chatbot_response PASSED
tests/test_chatbot.py::test_chatbot_response_quality PASSED
tests/test_pinecone.py::TestPineconeServiceBasic::test_import_pinecone_service PASSED
tests/test_integration.py::TestAdminValidation::test_import_validation_service PASSED

✅ All tests passed with secure test credentials
```

### **Security Validation**
- ✅ No real API keys in test output
- ✅ All external calls mocked successfully
- ✅ Test environment isolated from production
- ✅ Environment loading working correctly

---

## 🛠️ **Troubleshooting**

### **Common Issues**

1. **ImportError**: Missing dependencies
   ```bash
   pip install -r requirements.txt
   ```

2. **Environment Issues**: Missing `.env.test`
   ```bash
   cp .env.test.example .env.test  # If available
   # Tests will use fallback test credentials
   ```

3. **Mock Failures**: Service import issues
   ```bash
   # Check Python path and dependencies
   python -c "import app.services.pinecone_service"
   ```

---

## 📋 **Development Guidelines**

### **Adding New Tests**
1. **Follow Security Pattern**: Use environment loading pattern from existing tests
2. **Mock External Services**: Never make real API calls in tests
3. **Use Test Credentials**: Always use placeholder test API keys
4. **Document Test Purpose**: Clear docstrings and test descriptions

### **Test Best Practices**
- 🔒 **Security**: Never commit real credentials
- 🧪 **Isolation**: Mock all external dependencies
- 📝 **Documentation**: Clear test descriptions and expected outcomes
- ⚡ **Performance**: Fast execution with minimal dependencies

---

## 🆘 **Support**

For testing issues or questions:
- 📧 **Email**: admin@tunarasa.com
- 📝 **Documentation**: Check main project `CLAUDE.md`
- 🐛 **Bug Reports**: Include test output and environment details

---

*Made with 🔒 Security First by the Tunarasa Team*