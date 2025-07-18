# Tunarasa - Sign Language Recognition & AI Assistant Platform

**Tunarasa** is a comprehensive accessibility platform designed to help hearing-impaired users access public services through advanced sign language gesture recognition and AI-powered question answering. The system combines computer vision, large language models, and retrieval-augmented generation to provide real-time, accurate assistance.

![License](https://img.shields.io/badge/license-AGPL--3.0-blue.svg)
![Version](https://img.shields.io/badge/version-v0.4.0-green.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-99.9%25-blue.svg)
![WCAG](https://img.shields.io/badge/WCAG-2.1%20AA-green.svg)

## 🌟 Key Features

- **Real-time Sign Language Recognition**: MediaPipe Hands + TensorFlow.js for browser-based gesture recognition
- **AI-Powered Q&A**: LangChain + LLaMA 3 via ChatGroq for intelligent response generation
- **Knowledge Retrieval**: Pinecone vector database for document-based context retrieval
- **Admin Monitoring**: Comprehensive validation and analytics system
- **Accessibility-First Design**: WCAG 2.1 AA compliant interface optimized for hearing-impaired users

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
│  • Prometheus • Grafana • DeepEval • AlertManager               │
└─────────────────────────────────────────────────────────────────┘
```

## 🛠️ Technology Stack

### Frontend
- **Framework**: Next.js 15 with App Router, React 19, TypeScript
- **UI Components**: Shadcn UI, Radix UI primitives, Tailwind CSS v4
- **State Management**: React Hook Form with Zod validation
- **Computer Vision**: MediaPipe Hands, TensorFlow.js
- **Package Manager**: Bun

### Backend
- **API Framework**: FastAPI with Python 3.11+
- **AI Integration**: LangChain + ChatGroq (LLaMA 3)
- **Vector Database**: Pinecone for document embeddings
- **Caching**: Redis for sessions and API responses
- **ORM**: Drizzle ORM with PostgreSQL

### Infrastructure
- **Database**: Supabase PostgreSQL with Row Level Security
- **Authentication**: Clerk for admin authentication
- **Email**: Resend API for notifications
- **Monitoring**: Prometheus + Grafana + DeepEval
- **Deployment**: Docker + Docker Compose

## 📁 Project Structure

```
tunarasa/
├── frontend/                  # Next.js Application
│   ├── src/
│   │   ├── app/               # App Router pages
│   │   ├── components/        # React components
│   │   │   ├── ui/            # Shadcn UI components
│   │   │   ├── gesture/       # Gesture recognition components
│   │   │   ├── chat/          # Chat interface components
│   │   │   └── admin/         # Admin dashboard components
│   │   ├── hooks/             # Custom React hooks
│   │   └── lib/               # Utilities and configurations
│   ├── public/                # Static assets
│   ├── package.json           # Frontend dependencies
│   └── Dockerfile             # Frontend container
├── backend/                   # FastAPI Application
│   ├── app/
│   │   ├── core/              # Core configuration
│   │   ├── models/            # Database models
│   │   ├── api/               # API routes
│   │   ├── services/          # Business logic
│   │   └── main.py            # Application entry point
│   ├── requirements.txt       # Python dependencies
│   └── Dockerfile             # Backend container
├── monitoring/                # Observability configuration
│   ├── prometheus/            # Metrics collection
│   ├── grafana/               # Dashboards and visualization
│   └── alertmanager/          # Alert management
├── docs/                      # Additional documentation
├── compose.dev.yaml           # Development environment
├── compose.prod.yaml          # Production environment
└── README.md                  # This file
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
   git clone <repository-url>
   cd tunarasa
   ```

2. **Copy environment configuration**
   ```bash
   cp .env.example .env
   ```

3. **Configure environment variables**
   ```bash
   # Essential configuration in .env
   SUPABASE_URL=your_supabase_url
   SUPABASE_ANON_KEY=your_supabase_anon_key
   GROQ_API_KEY=your_groq_api_key
   PINECONE_API_KEY=your_pinecone_api_key
   CLERK_SECRET_KEY=your_clerk_secret_key
   ```

### Development Setup

#### Option 1: Docker Compose (Recommended)

```bash
# Start all services including monitoring
docker compose -f compose.dev.yaml up -d

# View logs
docker compose -f compose.dev.yaml logs -f

# Stop services
docker compose -f compose.dev.yaml down
```

Services available:
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000
- **Grafana Dashboard**: http://localhost:3030 (admin/admin123)
- **Prometheus**: http://localhost:9090
- **Mailhog**: http://localhost:8025

#### Option 2: Local Development

**Frontend Setup:**
```bash
cd frontend
bun install
bun run dev
```

**Backend Setup:**
```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Database Setup

```bash
# Generate database migrations
cd frontend
bun run db:generate

# Apply migrations
bun run db:migrate

# Open database studio
bun run db:studio
```

## 🧪 Development Commands

### Frontend Commands
```bash
cd frontend

# Development
bun run dev              # Start development server with Turbopack
bun run build            # Build for production
bun run start            # Start production server
bun run lint             # Run ESLint with auto-fix

# Database
bun run db:generate      # Generate Drizzle migrations
bun run db:migrate       # Apply database migrations
bun run db:studio        # Open Drizzle Studio
```

### Backend Commands
```bash
cd backend

# Development
python -m uvicorn app.main:app --reload   # Start development server
python -m pytest                          # Run tests
python -m black .                         # Format code
python -m isort .                         # Sort imports
python -m mypy .                          # Type checking
```

### Docker Commands
```bash
# Development environment
docker compose -f compose.dev.yaml up -d
docker compose -f compose.dev.yaml logs -f
docker compose -f compose.dev.yaml down

# Production environment
docker compose -f compose.prod.yaml up -d
docker compose -f compose.prod.yaml logs -f
docker compose -f compose.prod.yaml down

# Individual services
docker compose -f compose.dev.yaml up frontend backend redis
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

## 📊 Monitoring & Observability

### Real-Time Metrics
- **System Performance**: Response times, error rates, resource usage
- **User Experience**: Gesture accuracy, completion rates, satisfaction
- **AI Quality**: LLM response relevance, token usage, processing time
- **Business Intelligence**: Popular questions, usage patterns, trends

### Monitoring Stack
- **Prometheus**: Metrics collection and alerting
- **Grafana**: Dashboards and visualization
- **DeepEval**: LLM response quality assessment
- **AlertManager**: Alert routing and management

## 🚢 Deployment

### Production Environment
```bash
# Deploy with production configuration
docker compose -f compose.prod.yaml up -d

# Monitor deployment
docker compose -f compose.prod.yaml logs -f

# Health checks
curl http://localhost:3000/api/health
curl http://localhost:8000/api/health
```

### Environment Variables
See `.env.example` for complete configuration reference.

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
- Follow TypeScript best practices
- Maintain WCAG 2.1 AA compliance
- Write tests for new functionality
- Update documentation for API changes
- Use semantic commit messages

## 📄 License

This project is licensed under the AGPL-3.0 License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

For support and questions:

1. **Issues**: Create an issue on GitHub
2. **Documentation**: Check the `docs/` directory
3. **Community**: Join our community discussions

## 🗺️ Roadmap

### Phase 1: Core Infrastructure ✅
- [x] Database schema implementation with Drizzle ORM
- [x] Basic Next.js frontend with accessibility framework
- [x] FastAPI backend with core API endpoints
- [x] Docker containerization and development environment

### Phase 2: AI Integration (In Progress)
- [ ] MediaPipe Hands integration for gesture recognition
- [ ] TensorFlow.js model training for Indonesian sign language
- [ ] LangChain + ChatGroq integration for Q&A
- [ ] Pinecone setup with document embedding pipeline

### Phase 3: Admin System (Planned)
- [ ] Clerk authentication integration
- [ ] Admin dashboard with validation interface
- [ ] Email invitation system with Resend
- [ ] Role-based access control implementation

### Phase 4: Monitoring & Quality (Planned)
- [ ] Prometheus metrics collection
- [ ] Grafana dashboard configuration
- [ ] DeepEval integration for LLM quality assessment
- [ ] Performance optimization and load testing

### Phase 5: Production Deployment (Planned)
- [ ] Production environment setup
- [ ] Security hardening and penetration testing
- [ ] User acceptance testing with accessibility validation
- [ ] Documentation completion and training materials

---

**Made with ❤️ for accessibility and inclusion**