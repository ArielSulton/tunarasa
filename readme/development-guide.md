# 🛠️ Tunarasa Development Guide

---

## 📋 Table of Contents

1. [Development Environment Setup](#development-environment-setup)
2. [Code Quality Standards](#code-quality-standards)
3. [Development Workflow](#development-workflow)
4. [Testing Strategy](#testing-strategy)
5. [Deployment Procedures](#deployment-procedures)
6. [Troubleshooting Guide](#troubleshooting-guide)

---

## 🚀 Development Environment Setup

### Prerequisites Checklist

- [ ] **Bun** (latest): `curl -fsSL https://bun.sh/install | bash`
- [ ] **Python 3.11+**: `python --version` should show 3.11 or higher
- [ ] **Docker & Docker Compose**: `docker --version && docker compose version`
- [ ] **Git**: `git --version`
- [ ] **Node.js 18+**: For fallback compatibility

### Environment Configuration

#### 1. Repository Setup
```bash
# Clone and navigate
git clone <repository-url>
cd tunarasa

# Copy and configure environment
cp .env.example .env
# Edit .env with your API keys and configuration
```

#### 2. Backend Setup (Python)
```bash
cd backend

# Create and activate virtual environment
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Install pre-commit hooks for code quality
pre-commit install

# Verify installation
pre-commit run --files $(find . -type f -name '*.py' -not -path './.venv/*')
```

#### 3. Frontend Setup (Bun)
```bash
cd frontend

# Install dependencies
bun install

# Generate database schema
bun run db:generate

# Start development server
bun run dev
```

#### 4. Docker Development (Recommended)
```bash
# Start all services
docker compose -f compose.dev.yaml up -d

# View logs
docker compose -f compose.dev.yaml logs -f

# Stop services
docker compose -f compose.dev.yaml down
```

### Service Endpoints

| Service         | URL                   | Purpose                    |
|-----------------|-----------------------|----------------------------|
| Frontend        | http://localhost:5000 | Tunarasa-UI interface      |
| Backend API     | http://localhost:8000 | FastAPI with Swagger docs  |
| Grafana         | http://localhost:3030 | Monitoring dashboards      |
| Prometheus      | http://localhost:9090 | SLI/SLO monitoring         |
| Database Studio | `bun run db:studio`   | Drizzle database interface |

---

## ✅ Code Quality Standards

### Python Code Quality (Backend)

#### Pre-commit Hook System
**Automated quality enforcement** - all Python code must pass:

```bash
# Install and run pre-commit hooks
cd backend
source .venv/bin/activate
pre-commit install
pre-commit run --files $(find . -type f -name '*.py' -not -path './.venv/*')
```

#### Quality Tools Configuration

| Tool      | Purpose          | Configuration          |
|-----------|------------------|------------------------|
| **Black** | Code formatting  | Auto-applied on commit |
| **Ruff**  | Advanced linting | Auto-fix enabled       |
| **isort** | Import sorting   | Auto-applied on commit |

#### Code Standards
- **Function signatures**: Include type annotations for all parameters and return values
- **Error handling**: Use proper exception handling with meaningful error messages
- **Documentation**: Include docstrings for all public functions and classes
- **Security**: Never commit API keys or sensitive information

### TypeScript Code Quality (Frontend)

#### ESLint Configuration
```bash
cd frontend
bun run lint  # Run ESLint with auto-fix
```

#### Standards
- **Strict TypeScript**: Enable strict mode in `tsconfig.json`
- **Component patterns**: Use functional components with TypeScript interfaces
- **Accessibility**: WCAG 2.1 AA compliance for all components
- **Performance**: Optimize bundle size and loading times

### Environment Variables

**57 environment variables synchronized across 6 files**:
- `.env` (canonical reference)
- `.env.example` (template)
- `frontend/Dockerfile.prod` (production build)
- `compose.dev.yaml` (development)
- `compose.prod.yaml` (production)
- `backend/app/core/config.py` (Python configuration)

---

## 🔄 Development Workflow

### Branch Strategy
```
main (production-ready)
├── develop (integration branch)
├── feature/gesture-recognition-enhancement
├── feature/admin-dashboard-improvements
└── hotfix/authentication-security-fix
```

### Commit Standards
Use conventional commit format:
```
type(scope): description

feat(auth): add multi-factor authentication support
fix(gesture): resolve MediaPipe initialization issue
docs(readme): update development setup instructions
```

### Pull Request Process
1. **Create feature branch** from `develop`
2. **Implement changes** following code quality standards
3. **Run tests** and ensure all quality checks pass
4. **Update documentation** if API or architecture changes
5. **Submit PR** with detailed description and testing instructions
6. **Code review** by at least one team member
7. **Merge to develop** after approval

### Code Review Checklist
- [ ] Code quality checks pass (pre-commit hooks)
- [ ] Tests added for new functionality
- [ ] Documentation updated for changes
- [ ] Accessibility compliance maintained
- [ ] Security best practices followed
- [ ] Performance impact assessed

---

## 🧪 Testing Strategy

### Backend Testing
```bash
cd backend
source .venv/bin/activate

# Run all tests
python -m pytest

# Run specific test file
python -m pytest tests/test_chatbot.py -v

# Run with coverage
python -m pytest --cov=app tests/
```

### Frontend Testing
```bash
cd frontend

# E2E testing with Playwright
bun run test:e2e

# Run with UI mode
bun run test:e2e:ui

# Run in headed mode
bun run test:e2e:headed
```

### Test Categories

| Test Type               | Purpose                     | Tools              |
|-------------------------|-----------------------------|--------------------|
| **Unit Tests**          | Individual function testing | pytest, Jest       |
| **Integration Tests**   | API endpoint testing        | FastAPI TestClient |
| **E2E Tests**           | User workflow testing       | Playwright         |
| **Accessibility Tests** | WCAG compliance             | axe-core           |

### Quality Gates
- **Test Coverage**: Minimum 80% for critical paths
- **Performance**: Response times within SLA targets
- **Accessibility**: WCAG 2.1 AA compliance
- **Security**: No high-severity vulnerabilities

---

## 🚢 Deployment Procedures

### Development Deployment
```bash
# Start development environment
docker compose -f compose.dev.yaml up -d

# Monitor logs
docker compose -f compose.dev.yaml logs -f frontend backend

# Health checks
curl http://localhost:5000/api/health
curl http://localhost:8000/api/v1/health/check
```

### Production Deployment
```bash
# Deploy production environment
docker compose -f compose.prod.yaml up -d

# Verify deployment
curl http://localhost:5000/api/health
curl http://localhost:8000/api/v1/health/check

# Monitor deployment
docker compose -f compose.prod.yaml logs -f
```

### Deployment Checklist
- [ ] Environment variables configured
- [ ] Database migrations applied
- [ ] SSL certificates valid
- [ ] Monitoring dashboards operational
- [ ] Health checks passing
- [ ] Performance metrics within targets

### Rollback Procedures
```bash
# Stop current deployment
docker compose -f compose.prod.yaml down

# Rollback to previous version
git checkout [previous-tag]
docker compose -f compose.prod.yaml up -d

# Verify rollback
curl http://localhost:8000/api/v1/health/check
```

---

## 🔧 Troubleshooting Guide

### Common Issues

#### Docker Issues
**Problem**: Container build failures
```bash
# Solution: Clean Docker cache
docker system prune -a
docker compose -f compose.dev.yaml build --no-cache
```

#### Database Issues
**Problem**: Migration errors
```bash
# Solution: Reset and reapply migrations
cd frontend
bun run db:generate
bun run db:migrate
```

#### Python Dependencies
**Problem**: Package conflicts
```bash
# Solution: Recreate virtual environment
cd backend
rm -rf .venv
python3.11 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

#### Code Quality Issues
**Problem**: Pre-commit hooks failing
```bash
# Solution: Run individual tools
cd backend
source .venv/bin/activate
python -m black .
python -m isort .
python -m ruff . --fix
```

### Performance Issues

#### Slow API Responses
1. **Check monitoring**: Grafana dashboards for bottlenecks
2. **Database queries**: Optimize slow queries
3. **Cache utilization**: Verify Redis cache performance
4. **Resource limits**: Check Docker container resources

#### Frontend Performance
1. **Bundle analysis**: Check bundle size and loading times
2. **Image optimization**: Verify Next.js image optimization
3. **MediaPipe performance**: Check gesture recognition timing
4. **Memory leaks**: Monitor browser memory usage

### Security Issues

#### Authentication Problems
1. **Clerk configuration**: Verify API keys and domain settings
2. **JWT validation**: Check token expiration and signing
3. **CORS issues**: Verify allowed origins configuration
4. **Rate limiting**: Check rate limit configurations

### Monitoring & Alerts

#### Dashboard Access
- **Grafana**: http://localhost:3030 (admin/admin123)
- **Prometheus**: http://localhost:9090
- **Monitoring Rules**: Check `monitoring/prometheus/rules/` configuration

#### Key Metrics to Monitor
- **Response Times**: <500ms for gesture recognition, <3s for Q&A
- **Error Rates**: <0.1% system error rate
- **Resource Usage**: CPU, memory, and disk utilization
- **AI Quality**: Response relevance and user satisfaction

---

## 📚 Additional Resources

### Documentation Links
- **API Specifications**: `readme/api-specifications.md`
- **Authentication Design**: `readme/auth-system-design.md`
- **System Architecture**: `readme/complete-system-design.md`
- **Frontend Architecture**: `readme/frontend-architecture.md`
- **Monitoring Guide**: `readme/monitoring-architecture.md`

---

**Made with ❤️ for accessibility and inclusion**
