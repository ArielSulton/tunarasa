# Tunarasa Complete System Design Specification

## Executive Summary

Tunarasa is a comprehensive accessibility platform designed to help hearing-impaired users access public services through advanced sign language gesture recognition and AI-powered question answering. The system combines computer vision, large language models, and retrieval-augmented generation to provide real-time, accurate assistance.

## System Overview

### Core Capabilities
- **Real-time Sign Language Recognition**: MediaPipe Hands + TensorFlow.js for browser-based gesture recognition
- **AI-Powered Q&A**: LangChain + LLaMA 3 via ChatGroq for intelligent response generation
- **Knowledge Retrieval**: Pinecone vector database for document-based context retrieval
- **Admin Monitoring**: Comprehensive validation and analytics system
- **Accessibility-First Design**: WCAG 2.1 AA compliant interface optimized for hearing-impaired users

### Technical Architecture
```
User Device → Gesture Recognition → Text Processing → RAG System → LLM → Response + QR Code
     ↓              ↓                  ↓              ↓        ↓           ↓
Frontend → MediaPipe/TensorFlow.js → Next.js API → Pinecone → ChatGroq → Admin Dashboard
     ↓              ↓                  ↓              ↓        ↓           ↓
Session → Performance Monitoring → FastAPI Backend → Vector DB → Metrics → Grafana
```

## 1. Technology Stack

### Frontend Layer
- **Framework**: Next.js 15 with App Router, React 19, TypeScript
- **UI Components**: Shadcn UI, Radix UI primitives, Tailwind CSS v4
- **State Management**: React Hook Form with Zod validation, React Context API
- **Accessibility**: WCAG 2.1 AA compliance, screen reader optimization
- **Computer Vision**: MediaPipe Hands, TensorFlow.js for client-side processing

### Backend Layer
- **API Framework**: FastAPI with Python 3.11+
- **AI Integration**: LangChain for orchestration, ChatGroq for LLaMA 3 access
- **Vector Database**: Pinecone for document embeddings and similarity search
- **Caching**: Redis for session data and API response caching
- **File Processing**: PyPDF2, tiktoken for document processing and tokenization

### Database Layer
- **Primary Database**: Supabase PostgreSQL with Row Level Security
- **ORM**: Drizzle ORM for type-safe database operations
- **Monitoring Database**: TimescaleDB for metrics storage
- **Event Storage**: ClickHouse for user interaction logging

### Infrastructure Layer
- **Containerization**: Docker with multi-stage builds
- **Orchestration**: Docker Compose for development, Kubernetes for production
- **Deployment**: Dokploy for VPS deployment automation
- **Monitoring**: Prometheus + Grafana + DeepEval for comprehensive observability

### Authentication & Communication
- **Admin Authentication**: Clerk for multi-role authentication with JWT
- **Email Service**: Resend API for invitation and notification emails
- **Rate Limiting**: Redis-based with tiered limits by user type
- **API Security**: CORS, input validation, SQL injection prevention

## 2. System Architecture

### Microservices Design
```
┌─────────────────────────────────────────────────────────────────┐
│                         TUNARASA PLATFORM                       │
├─────────────────────────────────────────────────────────────────┤
│  Client Layer (Browser)                                         │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │   User Portal   │  │ Admin Dashboard │  │  Accessibility  │  │
│  │ • Camera Access │  │ • Validation UI │  │ • Screen Reader │  │
│  │ • Gesture UI    │  │ • Analytics     │  │ • High Contrast │  │
│  │ • Chat Interface│  │ • User Mgmt     │  │ • Keyboard Nav  │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
├─────────────────────────────────────────────────────────────────┤
│  API Gateway (Next.js API Routes)                               │
│  • Authentication Middleware • Rate Limiting • CORS             │
├─────────────────────────────────────────────────────────────────┤
│  Service Layer (FastAPI Microservices)                          │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │ Gesture Service │  │  AI/LLM Service │  │  Admin Service  │  │
│  │ • Recognition   │  │ • LangChain     │  │ • Validation    │  │
│  │ • Processing    │  │ • RAG Pipeline  │  │ • Analytics     │  │
│  │ • Confidence    │  │ • LLaMA via     │  │ • User Mgmt     │  │
│  │   Scoring       │  │   ChatGroq      │  │ • Reporting     │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
├─────────────────────────────────────────────────────────────────┤
│  Data Layer                                                     │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │   Supabase      │  │    Pinecone     │  │     Redis       │  │
│  │   PostgreSQL    │  │   Vector DB     │  │     Cache       │  │
│  │ • User Data     │  │ • Embeddings    │  │ • Sessions      │  │
│  │ • QnA Logs      │  │ • Documents     │  │ • Rate Limits   │  │
│  │ • Admin Data    │  │ • Knowledge     │  │ • Temp Data     │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
├─────────────────────────────────────────────────────────────────┤
│  Monitoring Stack                                               │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │   Prometheus    │  │    Grafana      │  │    DeepEval     │  │
│  │ • Metrics       │  │ • Dashboards    │  │ • LLM Quality   │  │
│  │ • Alerting      │  │ • Visualization │  │ • A/B Testing   │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## 3. Database Design

### Core Tables
- **admins**: Admin authentication and role management
- **user_sessions**: Anonymous user session tracking
- **qna_logs**: Complete conversation history with metrics
- **performance_metrics**: System performance and quality data
- **documents**: RAG knowledge base management
- **email_logs**: Email communication tracking
- **system_configs**: Dynamic configuration management

### Key Relationships
- QnA logs link to user sessions for analytics
- Admin validations track to specific QnA entries
- Performance metrics aggregate across sessions and responses
- Document management with versioning and approval workflows

## 4. User Flows

### End User Journey
1. **Access**: User visits platform via browser
2. **Permission**: Grant camera access for gesture recognition
3. **Gesture**: Perform sign language gestures
4. **Recognition**: MediaPipe processes hand landmarks
5. **Classification**: TensorFlow.js converts to text question
6. **Processing**: FastAPI receives and validates question
7. **RAG**: Pinecone retrieves relevant documents
8. **LLM**: ChatGroq processes with context to generate answer
9. **Response**: Answer displayed with optional QR code
10. **Feedback**: Optional user satisfaction rating

### Admin Workflow
1. **Authentication**: Clerk-based login with role verification
2. **Dashboard**: View system metrics and pending validations
3. **Validation**: Review and approve/reject LLM responses
4. **Analytics**: Monitor performance trends and user satisfaction
5. **Management**: Invite new admins (super admin only)
6. **Configuration**: Update system parameters and knowledge base

## 5. Security Framework

### Authentication Strategy
- **Public Access**: Session-based tracking without authentication
- **Admin Access**: Clerk JWT with role-based permissions
- **API Security**: Rate limiting, input validation, CORS protection
- **Data Protection**: Encryption at rest and in transit

### Privacy Considerations
- **Minimal Data Collection**: Only essential information stored
- **Anonymization**: User sessions without personal identification
- **GDPR Compliance**: Data export and deletion capabilities
- **Audit Trail**: Complete logging of admin actions

## 6. Performance Requirements

### Response Time Targets
- **Gesture Recognition**: <500ms for confidence scoring
- **LLM Response**: <3s for complete Q&A cycle
- **Dashboard Loading**: <2s for admin interface
- **Camera Initialization**: <1s for MediaPipe setup

### Scalability Targets
- **Concurrent Users**: 100+ simultaneous sessions
- **Daily Questions**: 10,000+ processed questions
- **Storage Growth**: 1TB+ knowledge base capacity
- **Uptime**: 99.9% availability target

### Quality Metrics
- **Gesture Accuracy**: >90% recognition rate
- **Answer Relevance**: >80% user satisfaction
- **System Reliability**: <0.1% error rate
- **Admin Efficiency**: <30s average validation time

## 7. Accessibility Features

### WCAG 2.1 AA Compliance
- **Keyboard Navigation**: Complete functionality without mouse
- **Screen Reader Support**: Semantic HTML with ARIA labels
- **High Contrast Modes**: Multiple theme options
- **Large Touch Targets**: 44px minimum for mobile
- **Focus Management**: Clear focus indicators and logical flow

### Hearing-Impaired Optimizations
- **Visual Feedback**: Clear gesture recognition indicators
- **Text Alternatives**: All audio content with text equivalents
- **Gesture Alternatives**: Text input and file upload options
- **QR Code Generation**: Quick sharing of responses
- **Simplified Navigation**: Intuitive, icon-based interface

## 8. Monitoring Strategy

### Real-Time Metrics
- **System Performance**: Response times, error rates, resource usage
- **User Experience**: Gesture accuracy, completion rates, satisfaction
- **AI Quality**: LLM response relevance, token usage, processing time
- **Business Intelligence**: Popular questions, usage patterns, trends

### Alert Framework
- **Critical Alerts**: System failures, security breaches
- **Performance Alerts**: High response times, low accuracy
- **Quality Alerts**: Degraded LLM performance, user dissatisfaction
- **Capacity Alerts**: Resource utilization, storage limits

## 9. Deployment Architecture

### Development Environment
```yaml
services:
  frontend:
    build: ./frontend
    ports: ["3000:3000"]
    environment:
      - NODE_ENV=development
  
  backend:
    build: ./backend
    ports: ["8000:8000"]
    environment:
      - ENVIRONMENT=development
  
  database:
    image: postgres:15
    environment:
      - POSTGRES_DB=tunarasa_dev
  
  redis:
    image: redis:7-alpine
  
  prometheus:
    image: prom/prometheus
    ports: ["9090:9090"]
  
  grafana:
    image: grafana/grafana
    ports: ["3001:3000"]
```

### Production Environment
- **Load Balancer**: Nginx with SSL termination
- **Container Orchestration**: Docker Swarm or Kubernetes
- **Database**: Managed Supabase with backups
- **CDN**: Cloudflare for static asset delivery
- **Monitoring**: External Grafana Cloud for alerts

## 10. Development Phases

### Phase 1: Core Infrastructure (Weeks 1-4)
- Database schema implementation with Drizzle ORM
- Basic Next.js frontend with accessibility framework
- FastAPI backend with core API endpoints
- Docker containerization and development environment

### Phase 2: AI Integration (Weeks 5-8)
- MediaPipe Hands integration for gesture recognition
- TensorFlow.js model training for Indonesian sign language
- LangChain + ChatGroq integration for Q&A
- Pinecone setup with document embedding pipeline

### Phase 3: Admin System (Weeks 9-12)
- Clerk authentication integration
- Admin dashboard with validation interface
- Email invitation system with Resend
- Role-based access control implementation

### Phase 4: Monitoring & Quality (Weeks 13-16)
- Prometheus metrics collection
- Grafana dashboard configuration
- DeepEval integration for LLM quality assessment
- Performance optimization and load testing

### Phase 5: Production Deployment (Weeks 17-20)
- Production environment setup
- Security hardening and penetration testing
- User acceptance testing with accessibility validation
- Documentation completion and training materials

## 11. Success Metrics

### Technical Metrics
- **System Uptime**: >99.9% availability
- **Response Performance**: <3s average Q&A cycle
- **Gesture Accuracy**: >90% recognition rate
- **Error Rate**: <0.1% system errors

### User Experience Metrics
- **User Satisfaction**: >4.0/5.0 average rating
- **Completion Rate**: >80% successful Q&A sessions
- **Return Usage**: >30% users return within 30 days
- **Accessibility Compliance**: 100% WCAG 2.1 AA adherence

### Business Impact Metrics
- **Service Adoption**: >1000 unique users in first month
- **Question Volume**: >5000 questions processed monthly
- **Admin Efficiency**: <2 minutes average validation time
- **Cost Efficiency**: <$0.10 per Q&A interaction

## 12. Risk Mitigation

### Technical Risks
- **AI Model Drift**: Continuous monitoring with DeepEval
- **Performance Degradation**: Auto-scaling with load balancing
- **Security Vulnerabilities**: Regular security audits and updates
- **Data Loss**: Multi-region backups with point-in-time recovery

### Operational Risks
- **Staff Training**: Comprehensive admin onboarding program
- **User Adoption**: Extensive user testing and feedback collection
- **Regulatory Compliance**: Legal review of accessibility standards
- **Budget Overruns**: Phased development with cost monitoring

This comprehensive design provides a robust foundation for building Tunarasa as a production-ready accessibility platform that serves hearing-impaired users while maintaining high standards for performance, security, and user experience.