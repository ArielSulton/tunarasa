# 🌟 Tunarasa - Sign Language Recognition & AI Assistant Platform

**Tunarasa** is a comprehensive accessibility platform designed to help hearing-impaired users access public services through advanced sign language gesture recognition and AI-powered question answering. The system combines computer vision, large language models, and retrieval-augmented generation to provide real-time, accurate assistance with enterprise-grade quality assurance.

![License](https://img.shields.io/badge/license-AGPL--3.0-blue.svg)
![Version](https://img.shields.io/badge/version-v1.3.0-green.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-60%25-blue.svg)
![Python](https://img.shields.io/badge/Python-40%25-green.svg)
![WCAG](https://img.shields.io/badge/WCAG-2.1%20AA-blue.svg)

## 🎯 Key Features & Capabilities

### 🤖 **AI & Recognition Engine**
- **Real-time Sign Language Recognition**: MediaPipe Hands + TensorFlow.js for browser-based gesture recognition
- **AI-Powered Q&A**: LangChain + LLaMA 3 via ChatGroq for intelligent response generation
- **Knowledge Retrieval**: Pinecone vector database for document-based context retrieval
- **Quality Assessment**: DeepEval integration for LLM response validation

### 👨‍💼 **Enterprise Administration**
- **Admin Monitoring**: Comprehensive validation and analytics system with business intelligence
- **Role-Based Access**: Multi-tier authentication with Clerk integration
- **Quality Assurance**: Advanced pre-commit hooks with automated code quality enforcement
- **Real-time Analytics**: SLI/SLO monitoring with Prometheus + Grafana dashboards

### ♿ **Accessibility Excellence**
- **WCAG 2.1 AA Compliant**: Complete accessibility framework optimized for hearing-impaired users
- **Multi-Modal Communication**: SIBI gesture recognition, Speech-to-Text, and admin interfaces
- **Professional UI/UX**: Tunarasa-UI design system with responsive layouts
- **Performance Optimized**: <500ms gesture recognition, <3s complete Q&A cycle

## 🏗️ Architecture Overview

```
User Device → Gesture Recognition → Text Processing → RAG System → LLM → Response + QR Code
     ↓              ↓                  ↓              ↓        ↓           ↓
Frontend → MediaPipe/TensorFlow.js → Next.js API → Pinecone → ChatGroq → Admin Dashboard
     ↓              ↓                  ↓              ↓        ↓           ↓
Session → Performance Monitoring → FastAPI Backend → Vector DB → Metrics → Grafana
```

### Microservices Design

```
┌─────────────────────────────────────────────────────────────────┐
│                         TUNARASA PLATFORM                       │
├─────────────────────────────────────────────────────────────────┤
│  Frontend (Next.js 15)                                          │
│  • Gesture Recognition UI • Admin Dashboard • Accessibility     │
├─────────────────────────────────────────────────────────────────┤
│  Backend (FastAPI)                                              │
│  • AI/LLM Service • Gesture Processing • Admin API              │
├─────────────────────────────────────────────────────────────────┤
│  Data Layer                                                     │
│  • Supabase PostgreSQL • Pinecone Vector DB • Redis Cache       │
├─────────────────────────────────────────────────────────────────┤
│  Monitoring Stack                                               │
│  • Prometheus • Grafana • DeepEval                              │
└─────────────────────────────────────────────────────────────────┘
```

## 🛠️ Technology Stack

### Frontend (Next.js 15)
- **Framework**: Next.js 15 with App Router, React 19, TypeScript 5.8+
- **UI Components**: Shadcn UI v2, Radix UI primitives, Tailwind CSS v4
- **State Management**: React Hook Form with Zod validation
- **Computer Vision**: MediaPipe Hands, TensorFlow.js
- **Package Manager**: Bun (latest)
- **Database ORM**: Drizzle ORM with TypeScript

### Backend (FastAPI)
- **API Framework**: FastAPI with Python 3.11+, Pydantic v2
- **AI Integration**: LangChain + ChatGroq (LLaMA 3 via Groq)
- **Vector Database**: Pinecone for document embeddings and RAG
- **Authentication**: JWT with role-based access control
- **Monitoring**: Prometheus FastAPI Instrumentator + DeepEval
- **Development**: Pre-commit hooks, Black, Ruff, MyPy

### Data & Infrastructure
- **Primary Database**: PostgreSQL with SQLAlchemy 2.0
- **Vector Store**: Pinecone for semantic search
- **Caching**: Redis for sessions and API responses
- **Admin Auth**: Clerk with custom role management
- **Email Service**: Resend API for notifications
- **Monitoring**: Prometheus + Grafana + DeepEval
- **Deployment**: Docker + Docker Compose (dev/prod)

## 📁 Project Structure

```
tunarasa/
├── backend/                    # FastAPI Application
│   ├── app/
│   │   ├── api/                # API routes with versioning
│   │   │   ├── middleware/     # Custom middleware (auth, rate limiting)
│   │   │   └── v1/endpoints/   # API endpoint modules (gesture, rag, admin)
│   │   ├── core/               # Core configuration & database
│   │   ├── models/             # SQLAlchemy & Pydantic models
│   │   ├── services/           # Business logic services
│   │   └── main.py             # FastAPI application entry
│   ├── tests/                  # Comprehensive test suite
│   ├── .pre-commit-config.yaml # Code quality automation
│   ├── Dockerfile              # Production container
│   └── requirements.txt        # Python dependencies
│
├── frontend/                   # Next.js Application
│   ├── src/
│   │   ├── app/                # App Router pages & API routes
│   │   │   ├── api/            # Next.js API routes (proxy layer)
│   │   │   ├── dashboard/      # Admin dashboard pages
│   │   │   └── komunikasi/     # Communication interface
│   │   ├── components/         # React components
│   │   │   ├── ui/             # 40+ Shadcn UI components
│   │   │   ├── gesture/        # Gesture recognition components
│   │   │   ├── admin/          # Admin dashboard components
│   │   │   ├── auth/           # Authentication components
│   │   │   └── emails/         # Email templates
│   │   ├── lib/                # Utilities and configurations
│   │   │   ├── ai/             # AI service integrations
│   │   │   ├── api/            # API client utilities
│   │   │   ├── db/             # Drizzle ORM schema
│   │   │   └── services/       # Frontend service layer
│   │   └── hooks/              # Custom React hooks
│   ├── public/                 # Static assets & ML models
│   ├── drizzle/                # Database migrations
│   ├── package.json            # Bun dependencies
│   └── Dockerfile.{dev,prod}   # Container configurations
│
├── monitoring/                 # Advanced Observability Stack
│   ├── prometheus/             # Prometheus Metrics collection & SLI/SLO alerting
│   │   └── rules/              # DeepEval and SLI/SLO monitoring rules
│   └── grafana/                # Business intelligence dashboards
│       ├── dashboards/         # Real-time monitoring & BI dashboards
│       └── provisioning/       # Grafana configuration and data sources
├── readme/                     # Comprehensive system documentation
├── compose.{dev,prod}.yaml     # Environment orchestration
├── .env.example                # Environment configuration template
└── README.md                   # This file
```

## 🚀 Getting Started

### Prerequisites

- **Bun** (latest): Package manager for frontend
- **Python 3.11+**: Backend runtime
- **Docker & Docker Compose**: For containerized development
- **Git**: Version control

### Environment Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/ArielSulton/tunarasa.git
   cd tunarasa
   ```

2. **Copy environment configuration**
   ```bash
   cp .env.example .env
   ```

3. **Configure environment variables**
   ```bash
   # Essential configuration in .env
   GROQ_API_KEY=your_groq_api_key
   PINECONE_API_KEY=your_pinecone_api_key
   CLERK_SECRET_KEY=your_clerk_secret_key
   ```

### Environment Variables
**Complete configuration across 6 files** - see `.env.example` for comprehensive environment variables organized in logical sections:
- Environment & Node Configuration
- Frontend Configuration
- Database Configuration
- Authentication & Security
- AI Services Configuration
- RAG System Configuration
- External Services
- API & Security Configuration
- Monitoring & Observability

**Synchronized Files**: `.env`, `.env.example`, `frontend/Dockerfile.prod`, `compose.dev.yaml`, `compose.prod.yaml`, `backend/app/core/config.py`

### 🧪 Development Setup

```bash
# Start all services including monitoring
COMPOSE_BAKE=true docker compose -f compose.dev.yaml up --build

# View logs
docker compose -f compose.dev.yaml logs -f

# Stop services
docker compose -f compose.dev.yaml down

# Health checks
curl http://localhost:5000/api/health
curl http://localhost:8000/api/health
```

Services available:
- **Frontend**: http://localhost:5000
- **Backend API**: http://localhost:8000/api/v1/docs#/rag/ask_question_with_rag_api_v1_rag_ask_post
- **Grafana Dashboard**: http://localhost:3030
- **Prometheus**: http://localhost:909
- **Database Studio**: `bun run db:studio`

### 📚 Database Setup

```bash
# Generate database migrations
cd frontend
bun run db:generate

# Apply migrations
bun run db:migrate

# Open database studio
bun run db:studio
```

### 🚢 Deployment Setup

```bash
# Deploy with production configuration
COMPOSE_BAKE=true docker compose -f compose.prod.yaml up --build

# View logs
docker compose -f compose.prod.yaml logs -f

# Stop services
docker compose -f compose.prod.yaml down

# Health checks
curl http://localhost:5000/api/health
curl http://localhost:8000/api/health
```

## 🎯 User Flows

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

## 🛡️ Security & Privacy

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

## ♿ Accessibility Features

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

## 📊 Advanced Monitoring & Business Intelligence

### SLI/SLO Monitoring
- **Service Level Indicators**: Real-time performance metrics with automated alerting
- **Response Time Monitoring**: <500ms gesture recognition, <3s Q&A cycle
- **Error Rate Tracking**: <0.1% system error tolerance with escalation
- **Quality Assessment**: AI response accuracy >80% with DeepEval validation

### Business Intelligence Dashboards
- **Executive Analytics**: Usage patterns, completion rates, user satisfaction trends
- **Performance Analytics**: Resource utilization, optimization recommendations
- **AI Quality Metrics**: LLM response relevance, token efficiency, processing optimization
- **Security Monitoring**: Authentication success rates, access pattern analysis

### Advanced Monitoring Stack
- **Prometheus**: Advanced metrics collection with SLI/SLO alerting rules
- **Grafana**: Multi-tier dashboards (operational, business intelligence, executive)
- **DeepEval**: Comprehensive LLM response quality assessment and optimization
- **Monitoring Rules**: Automated monitoring with deepeval_rules.yml and sli_slo_rules.yml

## 📈 Performance Targets

### Response Time Targets
- **Gesture Recognition**: <500ms for confidence scoring
- **LLM Response**: <3s for complete Q&A cycle
- **Dashboard Loading**: <2s for admin interface
- **Camera Initialization**: <1s for MediaPipe setup

### Quality Metrics
- **Gesture Accuracy**: >90% recognition rate
- **Answer Relevance**: >80% user satisfaction
- **System Reliability**: <0.1% error rate
- **Admin Efficiency**: <30s average validation time

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Follow the coding standards and accessibility guidelines
4. Run tests and ensure they pass
5. Commit your changes (`git commit -m 'Add amazing feature'`)
6. Push to the branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

### Development Guidelines
- **Code Quality**: Use pre-commit hooks (Black, Ruff, isort) for Python code
- **TypeScript Standards**: Follow strict TypeScript practices with ESLint enforcement
- **Accessibility First**: Maintain WCAG 2.1 AA compliance across all components
- **Testing Requirements**: Write comprehensive tests for new functionality
- **Documentation**: Update API specs and system documentation for changes
- **Commit Standards**: Use semantic commit messages with conventional format
- **Security**: Follow authentication patterns and input validation standards

## 📄 License

This project is licensed under the AGPL-3.0 License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

For support and questions:

1. **Issues**: Create an issue on GitHub for bugs and feature requests
2. **Documentation**: Check the comprehensive `readme/` directory for technical guides
3. **Release Notes**: Review `readme/release/` for version-specific information
4. **API Reference**: See `readme/api-specifications.md` for complete API documentation
5. **Architecture**: Review system design documents in `readme/` for technical understanding

## 🗺️ Roadmap

### Phase 1: Core Infrastructure ✅
- [x] Database schema implementation with Drizzle ORM
- [x] Basic Next.js frontend with accessibility framework
- [x] FastAPI backend with core API endpoints
- [x] Docker containerization and development environment

### Phase 2: AI Integration ✅
- [x] MediaPipe Hands integration for gesture recognition
- [x] TensorFlow.js model training for Indonesian sign language
- [x] LangChain + ChatGroq integration for Q&A
- [x] Pinecone setup with document embedding pipeline

### Phase 3: Admin System ✅
- [x] Clerk authentication integration
- [x] Admin dashboard with validation interface
- [x] Email invitation system with Resend
- [x] Role-based access control implementation

### Phase 4: Monitoring & Quality ✅
- [x] Prometheus metrics collection with FastAPI Instrumentator
- [x] DeepEval integration for LLM quality assessment
- [x] Grafana dashboard configuration with real-time monitoring
- [x] Performance optimization and comprehensive testing suite

### Phase 5: Production Deployment ✅
- [x] Production environment setup with Docker orchestration
- [x] Security hardening with authentication middleware
- [x] User acceptance testing with accessibility validation
- [x] Comprehensive documentation and system architecture guides

### Phase 6: Code Quality & Infrastructure Excellence ✅
- [x] Advanced monitoring system with SLI/SLO implementation
- [x] Pre-commit hook system with automated code quality enforcement
- [x] Environment variable synchronization across all configuration files
- [x] Authentication security hardening and vulnerability resolution
- [x] Business intelligence dashboards with real-time analytics

### Phase 7: Advanced Features (Work In Progress)
- [ ] Enhanced TypeScript quality with comprehensive type checking
- [ ] Advanced testing framework with automated quality gates
- [ ] Enhanced gesture recognition with custom models
- [ ] Multi-language support and localization
- [ ] Mobile application development

---

**Made with ❤️ for accessibility and inclusion**
