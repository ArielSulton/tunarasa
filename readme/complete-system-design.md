# Tunarasa Complete System Design Specification

## Executive Summary

Tunarasa is a production-ready accessibility platform designed to help hearing-impaired users access public services through advanced sign language gesture recognition and AI-powered question answering. The system combines computer vision, large language models, and retrieval-augmented generation to provide real-time, accurate assistance with enterprise-grade monitoring, quality assurance, and code excellence (95% quality score).

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

### Frontend Layer (Next.js 15)
- **Framework**: Next.js 15 with App Router, React 19, TypeScript 5.8+
- **UI Components**: Shadcn UI v2 (40+ components), Radix UI primitives, Tailwind CSS v4
- **State Management**: React Hook Form with Zod validation, React Context API
- **Accessibility**: WCAG 2.1 AA compliance, screen reader optimization, high contrast modes
- **Computer Vision**: MediaPipe Hands, TensorFlow.js for client-side processing
- **Database ORM**: Drizzle ORM with TypeScript for type-safe operations
- **Package Manager**: Bun for fast dependency management and runtime

### Backend Layer (FastAPI)
- **API Framework**: FastAPI with Python 3.11+, Pydantic v2 for validation
- **AI Integration**: LangChain + ChatGroq for LLaMA 3 orchestration
- **Vector Database**: Pinecone for document embeddings and semantic search
- **Caching**: Redis for session data and API response caching
- **Document Processing**: PyPDF, tiktoken for advanced text processing
- **Monitoring**: Prometheus FastAPI Instrumentator with custom metrics
- **Quality Assurance**: DeepEval for LLM response quality assessment

### Database Layer
- **Primary Database**: PostgreSQL with SQLAlchemy 2.0 (async)
- **ORM**: Drizzle ORM (frontend) + SQLAlchemy (backend) for type safety
- **Schema**: 7 core tables with advanced relationships and constraints
- **Vector Storage**: Pinecone for RAG document embeddings and similarity search
- **Migrations**: Drizzle migrations with version control

### Infrastructure Layer
- **Containerization**: Docker with optimized multi-stage builds
- **Orchestration**: Docker Compose for development/production environments
- **Deployment**: VPS deployment with Docker orchestration
- **Monitoring**: Prometheus + Grafana + DeepEval
- **Security**: JWT authentication, rate limiting, CORS protection

### Authentication & Communication
- **Admin Authentication**: Clerk with custom role-based permissions
- **Email Service**: Resend API for transactional emails and invitations
- **Rate Limiting**: Redis-based with intelligent tiered limits
- **API Security**: Comprehensive middleware with authentication, validation, CORS
- **Session Management**: Secure session tracking for analytics

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

### Core Database Schema (ERD)
```
┌─────────────┐    ┌─────────────┐     ┌─────────────┐
│    roles    │    │   genders   │     │    users    │
├─────────────┤    ├─────────────┤     ├─────────────┤
│ role_id (PK)│    │gender_id(PK)│     │ user_id (PK)│
│ role_name   │    │gender_name  │     │clerk_user_id│
└─────────────┘    └─────────────┘     │ full_name   │
       │                   │           │ role_id (FK)│
       │                   │           │gender_id(FK)│
       │                   │           │ created_at  │
       │                   │           │ updated_at  │
       │                   │           └─────────────┘
       │                   │                   │
       └───────────────────┼───────────────────┘
                           │
                   ┌─────────────┐
                   │conversations│
                   ├─────────────┤
                   │conv_id (PK) │
                   │ is_active   │
                   │ user_id (FK)│
                   │ created_at  │
                   │ updated_at  │
                   └─────────────┘
                           │
           ┌───────────────┼───────────────┐
           │               │               │
   ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
   │  messages   │ │    notes    │ │  [future]   │
   ├─────────────┤ ├─────────────┤ ├─────────────┤
   │message_id(PK) │note_id (PK) │ │rag_docs     │
   │conv_id (FK) │ │conv_id (FK) │ │metrics      │
   │message_content│note_content │ │sessions     │
   │   is_user   │ │url_access   │ │             │
   │ created_at  │ │created_at   │ │             │
   └─────────────┘ └─────────────┘ └─────────────┘
```

### Core Tables
- **users**: User registration with Clerk authentication integration
- **conversations**: Chat sessions between users and AI system
- **messages**: Individual messages within conversations (user/AI)
- **notes**: Generated notes with QR codes for accessibility
- **roles**: User role definitions (user, admin, moderator)
- **genders**: Gender reference table for user profiles

### Key Relationships
- Users have many conversations (1:N)
- Conversations contain many messages and notes (1:N each)
- Users reference roles and genders (N:1 each)
- Notes include url_access for QR code functionality

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
# Project Structure
tunarasa/
├── frontend/          # Next.js Application
│   ├── src/          # React components and pages
│   ├── public/       # Static assets
│   ├── package.json  # Frontend dependencies
│   └── Dockerfile    # Frontend container
├── backend/          # FastAPI Application
│   ├── app/         # Python application code
│   ├── requirements.txt  # Backend dependencies
│   └── Dockerfile   # Backend container
├── docs/            # System documentation
├── monitoring/      # Prometheus & Grafana configs
└── docker-compose.yml  # Development orchestration

services:
  frontend:
    build: ./frontend
    ports: ["5000:3000"]
    environment:
      - NODE_ENV=development
      - NEXT_PUBLIC_BACKEND_URL=http://localhost:8000

  backend:
    build: ./backend
    ports: ["8000:8000"]
    environment:
      - ENVIRONMENT=development
      - DATABASE_URL=postgresql://tunarasa:tunarasa123@database:5432/tunarasa

  database:
    image: postgres:15-alpine
    environment:
      - POSTGRES_DB=tunarasa
      - POSTGRES_USER=tunarasa
      - POSTGRES_PASSWORD=tunarasa123

  redis:
    image: redis:7-alpine

  prometheus:
    image: prom/prometheus
    ports: ["9090:9090"]

  grafana:
    image: grafana/grafana
    ports: ["3030:3000"]
```

### Production Environment
- **Load Balancer**: Nginx with SSL termination
- **Container Orchestration**: Docker Swarm or Kubernetes
- **Database**: Managed Supabase with backups
- **CDN**: Cloudflare for static asset delivery
- **Monitoring**: External Grafana Cloud for alerts

## 10. Development Phases

### Phase 1: Core Infrastructure ✅ (Completed)
- ✅ Database schema implementation with Drizzle ORM + SQLAlchemy
- ✅ Next.js 15 frontend with accessibility framework
- ✅ FastAPI backend with versioned API endpoints
- ✅ Docker containerization and development environment

### Phase 2: AI Integration ✅ (Completed)
- ✅ MediaPipe Hands integration for gesture recognition
- ✅ TensorFlow.js model training for sign language
- ✅ LangChain + ChatGroq integration for Q&A
- ✅ Pinecone setup with document embedding pipeline

### Phase 3: Admin System ✅ (Completed)
- ✅ Clerk authentication integration with custom roles
- ✅ Admin dashboard with validation interface
- ✅ Email invitation system with Resend API
- ✅ Role-based access control implementation

### Phase 4: Monitoring & Quality ✅ (Completed)
- ✅ Prometheus metrics collection with FastAPI Instrumentator
- ✅ Grafana dashboard configuration with real-time monitoring
- ✅ DeepEval integration for LLM quality assessment
- ✅ Performance optimization and comprehensive testing

### Phase 5: Production Deployment ✅ (Completed)
- ✅ Production environment setup with Docker orchestration
- ✅ Security hardening and authentication middleware
- ✅ User acceptance testing with accessibility validation
- ✅ Comprehensive documentation and architecture guides

### Phase 6: Advanced Features 🚧 (Work In Progress)
- 🔄 Enhanced gesture recognition with custom models
- 🔄 Multi-language support and localization
- 🔄 Advanced analytics and business intelligence
- 📋 Mobile application development
- 📋 Real-time collaboration features

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
