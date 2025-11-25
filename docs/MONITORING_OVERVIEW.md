# 📊 MONITORING & OBSERVABILITY OVERVIEW

Complete guide to monitoring, logging, and observability systems in Phase 6.

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Application Layer                        │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐           │
│  │  Express   │  │ Socket.io  │  │   Routes   │           │
│  └──────┬─────┘  └──────┬─────┘  └──────┬─────┘           │
│         │                │                │                 │
│         └────────────────┴────────────────┘                 │
│                          │                                  │
└──────────────────────────┼──────────────────────────────────┘
                           │
      ┌────────────────────┼────────────────────┐
      │                    │                    │
      ▼                    ▼                    ▼
┌──────────┐        ┌──────────┐        ┌──────────┐
│  Sentry  │        │ Winston  │        │Telemetry │
│  Error   │        │ Logging  │        │   API    │
│ Tracking │        │          │        │          │
└──────────┘        └──────────┘        └──────────┘
      │                    │                    │
      └────────────────────┴────────────────────┘
                           │
                           ▼
                    ┌──────────────┐
                    │   Telegram   │
                    │     Bot      │
                    └──────────────┘
```

---

## 1. Sentry Error Tracking

### Overview
Real-time error monitoring with performance profiling.

### Features
- 🔴 Exception capture
- 📊 Performance monitoring
- 👤 User context tracking
- 📈 Release tracking
- 🔒 Sensitive data filtering

### Configuration

```javascript
// backend/monitoring.js
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: 'staging',
  tracesSampleRate: 0.1,
  profilesSampleRate: 0.1,
});
```

### Dashboard Access

**URL**: `https://sentry.io/organizations/your-org/issues/`

**Metrics Tracked**:
- Error rate
- Response time (p50, p75, p95, p99)
- Transaction volumes
- User sessions
- Release health

### Alert Rules

Configure in Sentry dashboard:
- Error frequency > 10/minute
- New error first seen
- Regression (previously resolved error returns)
- Performance degradation

---

## 2. Winston Logging System

### Log Levels

```
error   → Critical failures
warn    → Warnings and potential issues
info    → General information
http    → HTTP request logs
debug   → Detailed debugging info
```

### Log Files

| File | Content | Rotation |
|------|---------|----------|
| `logs/combined.log` | All logs | 10MB, 7 days |
| `logs/error.log` | Errors only | 10MB, 7 days |

### API Endpoints

```bash
# View combined logs (last 100 lines)
GET /api/logs/combined?lines=100

# View error logs
GET /api/logs/errors?lines=50

# Download logs
GET /api/logs/download/combined
GET /api/logs/download/errors

# Real-time audit stream (SSE)
GET /api/logs/stream/audit

# Log statistics
GET /api/logs/stats
```

### Usage Example

```bash
# View recent logs
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  "https://staging.superapp.com/api/logs/combined?lines=50"

# Download error logs
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  -o errors.log \
  "https://staging.superapp.com/api/logs/download/errors"

# Stream audit logs
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  -N "https://staging.superapp.com/api/logs/stream/audit"
```

---

## 3. Telemetry API

### Metrics Tracked

**Business Metrics**:
- Total revenue (coins)
- Transaction count
- Active users
- Premium unlocks
- Subscription purchases
- Gifts sent
- Fraud alerts

**System Metrics**:
- Request count
- Average response time
- Error count
- Memory usage
- CPU usage
- Uptime

### API Endpoints

```bash
# Current metrics snapshot
GET /api/telemetry/metrics

# Full system snapshot
GET /api/telemetry/snapshot

# Health check with system info
GET /api/telemetry/health

# Revenue analytics
GET /api/telemetry/revenue

# Fraud metrics
GET /api/telemetry/fraud

# Reset daily metrics (admin)
POST /api/telemetry/reset
```

### Response Examples

**Metrics Endpoint**:
```json
{
  "success": true,
  "data": {
    "totalRevenue": 150000,
    "totalTransactions": 542,
    "activeUsers": 127,
    "premiumUnlocks": 89,
    "subscriptionPurchases": 34,
    "giftsSent": 156,
    "fraudAlerts": 3,
    "errors": 2,
    "requestCount": 12453,
    "averageResponseTime": 145
  }
}
```

**Health Check**:
```json
{
  "status": "healthy",
  "timestamp": "2025-11-25T10:00:00.000Z",
  "uptime": 3600,
  "environment": "production",
  "services": {
    "database": "connected",
    "memory": {
      "usage": 45,
      "heapUsed": "180MB",
      "heapTotal": "400MB"
    }
  }
}
```

---

## 4. Telegram Operations Bot

### Alert Types

| Icon | Type | Trigger |
|------|------|---------|
| 🚀 | Server Start | Process startup |
| ❌ | Critical Error | Exception thrown |
| 🚨 | Fraud Alert | Risk score > 80 |
| 💰 | High Value Transaction | Amount > 1000 coins |
| 💵 | Payout Request | Creator requests payout |
| 🔴 | Database Error | MongoDB disconnected |
| ⚠️ | Memory Warning | Usage > 90% |
| 📊 | Daily Summary | Midnight (daily) |

### Setup

1. **Create Bot**: [@BotFather](https://t.me/BotFather)
2. **Get Chat ID**: [@userinfobot](https://t.me/userinfobot)
3. **Configure Env Vars**:
   ```bash
   TELEGRAM_BOT_TOKEN=your_token_here
   TELEGRAM_ADMIN_CHAT_ID=your_chat_id
   TELEGRAM_ALERTS_ENABLED=true
   ```

### Manual Alerts

```javascript
// backend code
const telegramBot = require('./telegramBot');

// Send custom alert
telegramBot.sendCustomAlert(
  'Custom Alert Title',
  'Alert details here',
  'high' // priority: low, medium, high
);

// Send error alert
telegramBot.sendErrorAlert(error, { context: 'value' });

// Send fraud alert
telegramBot.sendFraudAlert(userId, reason, riskScore);
```

### Example Alerts

**Startup Notification**:
```
🚀 Server Started

Environment: production
Time: 2025-11-25T10:00:00Z
PID: 1234
Node Version: v18.17.0

Status: ✅ All systems operational
```

**Error Alert**:
```
❌ Critical Error Detected

Error: MongoNetworkError
Type: DatabaseError
Time: 2025-11-25T10:30:00Z

Context:
  operation: findOne
  collection: users

Stack:
  at MongoClient.connect
  at Database.connection
  ...
```

**Daily Summary**:
```
📊 Daily Summary

Users Active: 450
Transactions: 1,234
Revenue: 45,678 coins
Premium Unlocks: 234
Subscriptions: 89
Gifts Sent: 567
Fraud Alerts: 5
Errors: 12

Date: November 25, 2025
```

---

## 5. PM2 Monitoring (Optional)

### PM2 Plus Setup

1. Create account at [pm2.io](https://pm2.io)
2. Get keys from dashboard
3. Add to environment:
   ```bash
   PM2_PUBLIC_KEY=your_public_key
   PM2_SECRET_KEY=your_secret_key
   ```

### Metrics Tracked

- Active connections
- Wallet transactions
- Premium unlocks
- Active subscriptions
- Memory usage per instance
- CPU usage per instance
- Event loop lag

### Dashboard Access

**URL**: `https://app.pm2.io/`

**Features**:
- Real-time metrics
- Instance management
- Log aggregation
- Alert configuration

---

## 6. Load Testing Metrics

### Artillery Reports

After running load tests:

```bash
npm run load-test

# Reports generated in:
# load-tests/reports/*.html
```

**Metrics**:
- Request rate (req/s)
- Response time (p50, p95, p99)
- Error rate (%)
- Concurrent users
- Throughput

**Performance Targets**:
- p95 < 500ms
- p99 < 1000ms
- Error rate < 1%

---

## Monitoring Dashboard URLs

| Service | URL | Access |
|---------|-----|--------|
| **Sentry** | `https://sentry.io/...` | Web dashboard |
| **Telemetry API** | `/api/telemetry/metrics` | API endpoint |
| **Health Check** | `/api/health` | Public |
| **Logs API** | `/api/logs/combined` | Admin only |
| **Telegram Alerts** | Telegram app | Direct messages |
| **PM2 Plus** | `https://app.pm2.io` | Web dashboard |
| **Render Logs** | Render Dashboard | Web interface |

---

## Alert Thresholds

### Critical (Immediate Action)

- ❌ Error rate > 5%
- 🔴 Database disconnected
- ⚠️ Memory usage > 90%
- 🚨 Fraud score > 80

### Warning (Monitor)

- Error rate 1-5%
- Memory usage 80-90%
- Response time p99 > 2s
- Fraud score 60-80

### Info (Logging Only)

- Error rate < 1%
- Memory usage < 80%
- Response time p99 < 1s
- Fraud score < 60

---

## Best Practices

✅ **Check Sentry daily** for new errors  
✅ **Monitor Telegram** for critical alerts  
✅ **Review logs weekly** for patterns  
✅ **Run load tests** before major releases  
✅ **Set up custom alerts** for business metrics  
✅ **Archive old logs** to reduce storage  

---

## Troubleshooting

### Sentry Not Capturing Errors

**Check**:
1. `SENTRY_DSN` is set correctly
2. Error is not in `ignoreErrors` list
3. Sentry SDK initialized in `server.js`

```bash
# Test Sentry
curl -X POST /api/staging/simulate-error \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"errorType": "generic"}'
```

### Telegram Not Sending

**Check**:
1. Bot token is correct
2. You've started the bot (`/start`)
3. Chat ID matches your user ID
4. `TELEGRAM_ALERTS_ENABLED=true`

```javascript
// Test Telegram
telegramBot.sendCustomAlert('Test', 'Testing alerts', 'high');
```

### Logs Not Rotating

**Check**:
1. `logs/` directory exists
2. Write permissions
3. Winston configuration in `logger.js`

```bash
# Check log files
ls -lh backend/logs/

# Check disk space
df -h
```

---

## Next Steps

1. ✅ Configure Sentry project
2. ✅ Setup Telegram bot
3. ✅ Test all monitoring endpoints
4. ✅ Create custom dashboards
5. ✅ Setup alert rules

---

**Last Updated**: November 25, 2025  
**Version**: 1.0  
**Status**: ✅ Complete
