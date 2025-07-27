# Tunarasa API Specifications v1.3

## Overview
Production-ready RESTful API design for Tunarasa platform with FastAPI backend (Python 3.11+) and Next.js 15 frontend integration. Features comprehensive monitoring, authentication, and quality assurance.

## Base Configuration
- **Development URL**: `http://localhost:8000/api/v1`
- **Production URL**: `https://api.tunarasa.com/v1`
- **Documentation**: Available at `/api/v1/docs` (development only)
- **Authentication**: Clerk JWT tokens + Role-based access control
- **Rate Limiting**: Intelligent tiered limits (20-5000 req/min based on role)
- **Content-Type**: `application/json`
- **CORS**: Configured for frontend domains (localhost:5000 in dev)
- **Monitoring**: Prometheus metrics + DeepEval quality assessment

## Authentication & Authorization

### Headers
```
Authorization: Bearer <clerk_jwt_token>
X-API-Version: v1
Content-Type: application/json
```

### Roles
- `user`: Basic A-Z gesture recognition and Q&A access
- `admin`: Validation, monitoring, and analytics access
- `super_admin`: Full system access including user management

## API Endpoints

### 1. Gesture Recognition Service

#### POST /api/v1/gesture/recognize
Process A-Z hand gesture landmarks into text question.

**Request:**
```json
{
  "sessionId": "uuid",
  "gestureData": {
    "landmarks": [[x, y, z], ...],
    "timestamp": "2024-01-01T10:00:00Z"
  },
  "sequenceNumber": 1
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "recognizedText": "Bagaimana cara membuat KTP?",
    "confidence": 0.95,
    "processingTime": 150,
    "gestureCategory": "question",
    "qnaLogId": "uuid"
  }
}
```

#### POST /api/v1/gesture/process-sequence
Process multiple A-Z gesture sequences for complex questions.

**Request:**
```json
{
  "sessionId": "uuid",
  "gestureSequences": [
    {
      "sequenceId": 1,
      "gestureData": {...},
      "timestamp": "2024-01-01T10:00:00Z"
    }
  ]
}
```

### 2. Summary & QR Code Service

#### POST /api/v1/summary/generate
Generate summary and QR code for question-answer pairs.

**Request:**
```json
{
  "sessionId": "uuid",
  "question": "Bagaimana cara membuat KTP?",
  "answer": "Untuk membuat KTP, Anda perlu...",
  "context": {
    "userLocation": "Jakarta",
    "preferredLanguage": "id"
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "summary": "Proses pembuatan KTP meliputi...",
    "qrCode": "data:image/png;base64,...",
    "qrUrl": "https://tunarasa.com/s/abc123",
    "noteId": "uuid",
    "expiresAt": "2024-12-31T23:59:59Z"
  }
}
```

#### GET /api/v1/summary/history
Retrieve user's summary history.

**Query Parameters:**
- `sessionId`: UUID (required)
- `limit`: integer (default: 20, max: 100)
- `offset`: integer (default: 0)

**Response:**
```json
{
  "success": true,
  "data": {
    "summaries": [
      {
        "id": "uuid",
        "summary": "Proses pembuatan KTP...",
        "qrCode": "data:image/png;base64,...",
        "timestamp": "2024-01-01T10:00:00Z",
        "urlAccess": "https://tunarasa.com/s/abc123"
      }
    ],
    "pagination": {
      "total": 50,
      "limit": 20,
      "offset": 0,
      "hasNext": true
    }
  }
}
```

### 3. Admin Management Service

#### GET /api/v1/admin/dashboard-data
**Role Required:** `admin` or `super_admin`

Retrieve dashboard analytics data.

**Query Parameters:**
- `timeRange`: `1h|24h|7d|30d` (default: 24h)
- `metrics`: comma-separated list of metrics

**Response:**
```json
{
  "success": true,
  "data": {
    "metrics": {
      "totalQuestions": 1250,
      "uniqueSessions": 89,
      "averageResponseTime": 1.2,
      "gestureAccuracy": 0.94
    },
    "trends": {
      "questionsOverTime": [
        {"timestamp": "2024-01-01T00:00:00Z", "count": 45}
      ],
      "topCategories": [
        {"category": "KTP", "count": 234}
      ]
    }
  }
}
```

#### POST /api/v1/admin/validate-answer
**Role Required:** `admin` or `super_admin`

Validate or reject an LLM answer.

**Request:**
```json
{
  "qnaLogId": "uuid",
  "validationStatus": "approved|rejected|needs_review",
  "notes": "Answer is accurate and helpful",
  "suggestedImprovements": "Add more specific steps"
}
```

#### GET /api/v1/admin/performance-metrics
**Role Required:** `admin` or `super_admin`

**Query Parameters:**
- `metricType`: `gesture_accuracy|llm_response_time|user_satisfaction`
- `timeRange`: `1h|24h|7d|30d`
- `aggregation`: `avg|min|max|sum`

#### POST /api/v1/admin/invite-user
**Role Required:** `super_admin`

**Request:**
```json
{
  "email": "admin@example.com",
  "firstName": "John",
  "lastName": "Doe",
  "role": "admin"
}
```

### 4. RAG System Service

#### POST /api/v1/rag/query
**Role Required:** Internal service only

Query vector database for relevant documents.

**Request:**
```json
{
  "question": "Bagaimana cara membuat KTP?",
  "topK": 5,
  "filters": {
    "documentType": "ktp_guide",
    "category": "requirements"
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "documents": [
      {
        "id": "uuid",
        "title": "Panduan KTP",
        "content": "Untuk membuat KTP...",
        "similarity": 0.92,
        "metadata": {
          "documentType": "ktp_guide",
          "version": "1.0"
        }
      }
    ]
  }
}
```

#### POST /api/v1/rag/add-document
**Role Required:** `admin` or `super_admin`

Add new document to knowledge base.

**Request:**
```json
{
  "title": "Panduan KK Terbaru",
  "content": "Dokumen lengkap tentang...",
  "documentType": "kk_guide",
  "category": "procedures",
  "tags": ["kk", "keluarga", "update"]
}
```

### 5. Session Management

#### POST /api/v1/session/start
Start new user session.

**Request:**
```json
{
  "userAgent": "Mozilla/5.0...",
  "preferredLanguage": "id"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "sessionId": "uuid",
    "expiresAt": "2024-01-01T12:00:00Z"
  }
}
```

#### POST /api/v1/session/end
End user session.

**Request:**
```json
{
  "sessionId": "uuid",
  "feedback": {
    "overallSatisfaction": 4,
    "suggestions": "Improve gesture recognition speed"
  }
}
```

## Error Handling

### Standard Error Response
```json
{
  "success": false,
  "error": {
    "code": "GESTURE_RECOGNITION_FAILED",
    "message": "Unable to recognize gesture pattern",
    "details": {
      "confidence": 0.45,
      "threshold": 0.7
    },
    "timestamp": "2024-01-01T10:00:00Z",
    "requestId": "uuid"
  }
}
```

### Error Codes
- `AUTHENTICATION_FAILED` (401)
- `INSUFFICIENT_PERMISSIONS` (403)
- `GESTURE_RECOGNITION_FAILED` (422)
- `LLM_SERVICE_UNAVAILABLE` (503)
- `RATE_LIMIT_EXCEEDED` (429)
- `VALIDATION_ERROR` (400)
- `RESOURCE_NOT_FOUND` (404)

## Rate Limiting

### Headers
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 87
X-RateLimit-Reset: 1640995200
```

### Limits by Role
- Anonymous: 20 requests/minute
- User: 100 requests/minute
- Admin: 1000 requests/minute
- Super Admin: 5000 requests/minute

## Webhooks

### Admin Validation Required
Triggered when automatic validation fails.

**Endpoint:** `POST {configured_webhook_url}`
```json
{
  "event": "validation_required",
  "data": {
    "qnaLogId": "uuid",
    "question": "Complex question requiring manual review",
    "autoValidationScore": 0.65,
    "priority": "high"
  }
}
```

### System Alert
Triggered for system performance issues.

```json
{
  "event": "system_alert",
  "data": {
    "alertType": "high_response_time",
    "severity": "warning",
    "metrics": {
      "averageResponseTime": 5.2,
      "threshold": 3.0
    }
  }
}
```

## API Versioning

### Version Strategy
- URL versioning: `/api/v1/`, `/api/v2/`
- Backward compatibility for 1 major version
- Deprecation warnings in response headers

### Headers
```
X-API-Version: v1
X-Deprecated-Version: false
X-Sunset-Date: 2025-01-01
```

## Security Considerations

### Input Validation
- Maximum request size: 10MB
- Gesture data validation against MediaPipe format
- SQL injection prevention via parameterized queries
- XSS protection via input sanitization

### Output Sanitization
- HTML encoding for user-generated content
- Sensitive data filtering in responses
- GDPR compliance for data export

### Monitoring
- Request/response logging
- Suspicious activity detection
- Performance metric collection
- Error rate monitoring
