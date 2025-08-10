# Prometheus Configuration

Well-organized Prometheus configuration for Tunarasa monitoring system.

## Directory Structure

```
prometheus/
├── configs/                    # Main Prometheus configurations
│   ├── prometheus.dev.yml      # Development environment
│   └── prometheus.prod.yml     # Production environment
├── alerting/                   # Alert rules and notifications
│   └── rules/
│       ├── deepeval-alerts.yml
│       └── sli-slo-alerts.yml
├── recording-rules/            # Recording rules for metrics
    └── sli-slo-recording-rules.yml
```

## Usage

### Development Environment
```bash
# Run with development compose
docker-compose -f compose.dev.yaml up prometheus

# Config mounting:
./monitoring/prometheus/configs/prometheus.dev.yml → /etc/prometheus/prometheus.yml
```

### Production Environment
```bash
# Run with production compose  
docker-compose -f compose.prod.yaml up prometheus

# Config mounting:
./monitoring/prometheus/configs/prometheus.prod.yml → /etc/prometheus/prometheus.yml
```

## Configuration

### Development vs Production

**Development (`prometheus.dev.yml`)**:
- More frequent scrape intervals: 10-15s
- External labels: `cluster: 'tunarasa-dev'`, `environment: 'development'`
- Target metrics: backend, monitoring endpoints, Prometheus, Grafana

**Production (`prometheus.prod.yml`)**:
- Standard scrape interval: 15s
- Data retention: 30 days
- Target metrics: backend, monitoring endpoints, Prometheus, Grafana

### Monitoring Targets

1. **tunarasa-backend** - FastAPI backend metrics (`/metrics`)
2. **tunarasa-monitoring** - DeepEval & system monitoring (`/api/v1/monitoring/prometheus-metrics`)
3. **prometheus** - Self-monitoring Prometheus
4. **grafana** - Grafana metrics (`/metrics`)

## Rules and Alerts

### Alert Rules
- **DeepEval Alerts**: AI/LLM response quality monitoring
- **SLI/SLO Alerts**: Service level indicators and objectives

### Recording Rules
- **SLI/SLO Recording**: Pre-computed metrics for dashboards

## Docker Integration

### Development Mount Points
```yaml
volumes:
  - ./monitoring/prometheus/configs/prometheus.dev.yml:/etc/prometheus/prometheus.yml:ro
  - ./monitoring/prometheus/alerting:/etc/prometheus/alerting:ro
  - ./monitoring/prometheus/recording-rules:/etc/prometheus/recording-rules:ro
```

### Production Mount Points  
```yaml
volumes:
  - ./monitoring/prometheus/configs/prometheus.prod.yml:/etc/prometheus/prometheus.yml:ro
  - ./monitoring/prometheus/alerting:/etc/prometheus/alerting:ro
  - ./monitoring/prometheus/recording-rules:/etc/prometheus/recording-rules:ro
```

## Configuration Editing

1. **Edit main configuration**: Modify files in `configs/prometheus.{env}.yml`
2. **Add alert rules**: Add/edit files in `alerting/rules/`
3. **Add recording rules**: Add/edit files in `recording-rules/`
4. **Restart container**: `docker-compose restart prometheus`

## Metrics Label Strategy

### Backend Metrics
- `service`: 'tunarasa'
- `component`: 'backend'
- `instance`: 'tunarasa-backend'

### AI/LLM Metrics
- `ai_component`: for AI/DeepEval/LLM metrics
- `deepeval_metric`: for DeepEval specific metrics
- `gesture_component`: for gesture recognition metrics

### Environment Labels
- `cluster`: 'tunarasa-dev' or 'tunarasa'
- `environment`: 'development' or 'production'