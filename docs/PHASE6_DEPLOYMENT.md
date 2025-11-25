# 🚀 PHASE 6 - STAGING DEPLOYMENT GUIDE

## 📋 Table of Contents
1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Infrastructure Components](#infrastructure-components)
4. [Deployment Process](#deployment-process)
5. [Environment Configuration](#environment-configuration)
6. [Monitoring & Observability](#monitoring--observability)
7. [Security Features](#security-features)
8. [Troubleshooting](#troubleshooting)

---

## Overview

Phase 6 deploys the Super App backend to a **staging environment** on Render.com with comprehensive monitoring, logging, and CI/CD automation.

### Key Features Delivered
✅ Multi-stage Docker deployment  
✅ PM2 clustering (2 instances)  
✅ MongoDB Atlas integration (replica set)  
✅ Sentry error tracking  
✅ Winston logging infrastructure  
✅ Telegram ops bot for alerts  
✅ Real-time telemetry API  
✅ Load testing with Artillery  
✅ CI/CD pipeline with GitHub Actions  
✅ Staging-specific features (faucet, disabled payouts)  

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    GitHub Repository                    │
│                    (staging branch)                     │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│              GitHub Actions CI/CD Pipeline              │
│  • Lint & Test                                          │
│  • Security Scan (Trivy)                                │
│  • Docker Build                                         │
│  • Deploy to Render                                     │
│  • Health Check & Rollback                              │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│                    Render.com Platform                  │
│  ┌───────────────────────────────────────────────────┐  │
│  │            Docker Container (Node.js)             │  │
│  │  ┌─────────────────────────────────────────────┐  │  │
│  │  │          PM2 Cluster Manager               │  │  │
│  │  │  ┌──────────────┐  ┌──────────────┐       │  │  │
│  │  │  │  Instance 1  │  │  Instance 2  │       │  │  │
│  │  │  │  Express +   │  │  Express +   │       │  │  │
│  │  │  │  Socket.io   │  │  Socket.io   │       │  │  │
│  │  │  └──────────────┘  └──────────────┘       │  │  │
│  │  └─────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────┘  │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│               External Services                         │
│  • MongoDB Atlas (Replica Set)                          │
│  • Sentry (Error Tracking)                              │
│  • Telegram Bot (Alerts)                                │
│  • PM2 Plus (Optional Metrics)                          │
└─────────────────────────────────────────────────────────┘
```

---

## Infrastructure Components

### 1. **Dockerfile (Multi-Stage)**
- **Builder Stage**: Installs dependencies
- **Production Stage**: Runs PM2 in cluster mode
- **Security**: Non-root user, minimal image
- **Health Check**: Built-in endpoint monitoring

**Location**: `/Dockerfile`

### 2. **Render Configuration**
- **Service Type**: Docker web service
- **Region**: Oregon (configurable)
- **Scaling**: 1-3 instances (auto-scaling)
- **Health Check**: `/api/health` endpoint

**Location**: `/render.yaml`

### 3. **PM2 Ecosystem**
- **Instances**: 2 (cluster mode)
- **Max Memory**: 500MB per instance
- **Auto-Restart**: Enabled
- **Log Rotation**: 7 days retention

**Location**: `/backend/ecosystem.config.js`

---

## Deployment Process

### Manual Deployment Steps

1. **Push to Staging Branch**
   ```bash
   git checkout staging
   git merge main
   git push origin staging
   ```

2. **Automatic CI/CD Triggered**
   - Tests run automatically
   - Docker image built
   - Deployed to Render if tests pass

3. **Health Check**
   - Automatic health checks every 30s
   - Rollback on failure
   - Telegram notification sent

### Manual Render Deployment

If you need to deploy manually:

```bash
# Install Render CLI
npm install -g render-cli

# Login
render login

# Deploy
render deploy
```

---

## Environment Configuration

### Required Environment Variables

Create these in **Render Dashboard → Environment**:

| Variable | Description | Example |
|----------|-------------|---------|
| `NODE_ENV` | Environment mode | `production` |
| `DATABASE_URI` | MongoDB connection string | `mongodb+srv://...` |
| `JWT_SECRET` | JWT signing key | Auto-generated |
| `SENTRY_DSN` | Sentry project DSN | From Sentry dashboard |
| `TELEGRAM_BOT_TOKEN` | Bot token | From @BotFather |
| `TELEGRAM_ADMIN_CHAT_ID` | Your Telegram user ID | From @userinfobot |
| `IS_STAGING` | Staging flag | `true` |
| `DISABLE_REAL_PAYOUTS` | Disable real payouts | `true` |
| `ENABLE_COIN_FAUCET` | Enable test faucet | `true` |

### MongoDB Atlas Setup

1. Create cluster with **replica set** enabled
2. Create database: `superapp_staging`
3. Whitelist IP: `0.0.0.0/0` (or Render IPs)
4. Get connection string
5. Add to `DATABASE_URI` in Render

---

## Monitoring & Observability

### 1. Sentry Error Tracking

**Setup**:
1. Create project at [sentry.io](https://sentry.io)
2. Copy DSN
3. Add to `SENTRY_DSN` env var

**Features**:
- Automatic exception capture
- Performance monitoring
- User context tracking
- Filtered sensitive data

**Dashboard**: `https://sentry.io/organizations/your-org/issues/`

### 2. Telemetry API

**Endpoints**:
```
GET /api/telemetry/metrics        - Current metrics
GET /api/telemetry/snapshot       - Full system snapshot
GET /api/telemetry/health         - Health check
GET /api/telemetry/revenue        - Revenue analytics
GET /api/telemetry/fraud          - Fraud metrics
```

**Example**:
```bash
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  https://superapp-backend-staging.onrender.com/api/telemetry/metrics
```

### 3. Winston Logging

**Log Files**:
- `logs/combined.log` - All logs
- `logs/error.log` - Errors only

**API Endpoints**:
```
GET /api/logs/combined            - View combined logs
GET /api/logs/errors              - View error logs
GET /api/logs/download/combined   - Download combined
GET /api/logs/download/errors     - Download errors
GET /api/logs/stream/audit        - SSE audit stream
```

### 4. Telegram Alerts

**Alert Types**:
- 🚀 Server startup/restart
- ❌ Critical errors
- 🚨 Fraud detection
- 💰 High-value transactions
- 💵 Payout requests
- 🔴 Database connection loss
- ⚠️ High memory usage
- 📊 Daily summary (midnight)

**Setup**:
1. Create bot with [@BotFather](https://t.me/BotFather)
2. Get your user ID from [@userinfobot](https://t.me/userinfobot)
3. Add both to environment variables

---

## Security Features

### 1. Staging-Specific Protections
- ✅ Real payouts **disabled**
- ✅ Test-only transactions
- ✅ Fraud detection (log-only, no bans)
- ✅ Rate limiting (relaxed)

### 2. Docker Security
- Non-root user (`nodejs`)
- Minimal Alpine image
- No dev dependencies
- Read-only file system (except logs)

### 3. Network Security
- HTTPS enforced
- CORS configured
- WebSocket secure (wss://)
- JWT authentication

---

## Troubleshooting

### Common Issues

#### 1. Deployment Failed
**Symptom**: CI/CD pipeline fails

**Solutions**:
```bash
# Check logs in GitHub Actions
# View "Deploy to Render" step

# Manual rollback
curl -X POST $RENDER_ROLLBACK_HOOK
```

#### 2. Database Connection Error
**Symptom**: `MongoNetworkError` in logs

**Solutions**:
- Check MongoDB Atlas IP whitelist
- Verify `DATABASE_URI` format
- Ensure replica set is configured

#### 3. Socket.io Not Connecting
**Symptom**: WebSocket connection fails

**Solutions**:
- Check `SOCKET_CORS_ORIGIN` includes frontend URL
- Verify ports are open (5000)
- Test fallback to polling

#### 4. High Memory Usage
**Symptom**: Telegram alert for memory

**Solutions**:
```bash
# View PM2 metrics
pm2 monit

# Restart instances
pm2 restart ecosystem.config.js

# Check for memory leaks
node --inspect server.js
```

### Health Check Command

```bash
curl https://superapp-backend-staging.onrender.com/api/health
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2025-11-25T10:00:00.000Z",
  "uptime": 3600,
  "services": {
    "database": "connected",
    "memory": { "usage": 45 }
  }
}
```

---

## Load Testing

Run load tests to verify performance:

```bash
# Quick smoke test (30s)
npm run load-test:quick

# Full load test suite
cd load-tests
./run-load-tests.sh full

# Stress test (high load)
./run-load-tests.sh stress
```

**Reports**: Generated in `load-tests/reports/`

---

## Next Steps

After staging deployment:
1. ✅ Run integration tests
2. ✅ Perform load testing
3. ✅ Verify monitoring dashboards
4. ✅ Test Telegram alerts
5. ✅ QA testing (see `STAGING_TEST_GUIDE.md`)
6. ⏭️ Production deployment (Phase 7)

---

## Support

**Issues**: Create GitHub issue  
**Docs**: See `docs/` directory  
**Alerts**: Check Telegram bot  
**Logs**: Sentry + Winston logs  

---

**Last Updated**: November 25, 2025  
**Phase**: 6 - Staging Deployment  
**Status**: ✅ Complete
