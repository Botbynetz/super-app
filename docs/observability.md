# Observability Guide - Super-App Backend

**Version:** 1.0  
**Last Updated:** January 2025  
**Phase:** 7 - Production Hardening & Optimization

---

## Table of Contents

1. [Overview](#overview)
2. [Logging Infrastructure](#logging-infrastructure)
3. [Request Tracking](#request-tracking)
4. [Error Monitoring](#error-monitoring)
5. [Performance Monitoring](#performance-monitoring)
6. [Metrics & Analytics](#metrics--analytics)
7. [Alerting & Notifications](#alerting--notifications)
8. [Debugging Workflows](#debugging-workflows)
9. [Log Analysis](#log-analysis)
10. [Dashboard Setup](#dashboard-setup)
11. [Best Practices](#best-practices)

---

## Overview

This guide provides comprehensive observability practices for the Super-App backend, covering advanced logging, request tracking, error monitoring, performance analysis, and debugging workflows. Proper observability is critical for maintaining production systems, diagnosing issues, and optimizing performance.

**Key Observability Features:**
- ✅ Structured JSON logging with Winston
- ✅ Request ID propagation across services
- ✅ Automatic sensitive data masking
- ✅ File rotation and retention (20MB max, 14 days)
- ✅ Integration with Sentry for error tracking
- ✅ Rate limiting and idempotency monitoring
- ✅ Performance metrics tracking

---

## Logging Infrastructure

### Winston Logger Configuration

The application uses **Winston v3** with custom configuration for structured logging.

**Log Levels:**
- `error` (0): Critical errors requiring immediate attention
- `warn` (1): Warning conditions, potential issues
- `info` (2): General informational messages
- `http` (3): HTTP request/response logs
- `debug` (4): Detailed debugging information

**File Transports:**
- **combined.log**: All log levels (max 20MB, 14 days retention, gzip compression)
- **error.log**: Error-level logs only (max 20MB, 14 days retention, gzip compression)
- **Console**: Color-coded output for development

**Configuration Location:** `backend/utils/logger.js`

### Basic Usage

```javascript
const logger = require('./utils/logger');

// Info level logging
logger.info('User logged in', { userId: '12345', email: 'user@example.com' });

// Warning level logging
logger.warn('Rate limit approaching', { userId: '12345', remaining: 5 });

// Error level logging
logger.error('Payment processing failed', { 
  error: error.message, 
  stack: error.stack,
  userId: '12345',
  amount: 10000 
});

// Debug level logging (only in development)
logger.debug('Query execution plan', { query: 'find', collection: 'users', plan: {...} });
```

### Structured Logging Format

All logs are structured as JSON for easy parsing:

```json
{
  "level": "info",
  "message": "User logged in",
  "timestamp": "2025-01-15T10:30:45.123Z",
  "userId": "12345",
  "email": "user@example.com",
  "requestId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**Advantages:**
- Easy to parse programmatically
- Searchable by any field
- Compatible with log aggregation tools (ELK, Datadog, Splunk)

---

## Request Tracking

### Request ID Propagation

Every HTTP request is assigned a unique **UUID v4** request ID for tracking across the entire request lifecycle.

**Implementation:** `backend/utils/logger.js` - `attachRequestId()` middleware

### How Request IDs Work

1. **Incoming Request:** Middleware generates UUID v4 and attaches to `req.id` and `res.locals.requestId`
2. **Response Header:** Request ID returned in `X-Request-Id` response header
3. **Logging:** All logs automatically include request ID for correlation
4. **Propagation:** Child loggers inherit request ID for nested operations

### Usage in Application Code

```javascript
// Middleware automatically attaches request ID
app.use(attachRequestId());

// Access request ID in route handlers
app.get('/api/user/:id', async (req, res) => {
  const requestId = req.id; // UUID v4 string
  
  // Use child logger for context-aware logging
  const childLogger = createChildLogger(requestId);
  
  childLogger.info('Fetching user', { userId: req.params.id });
  
  try {
    const user = await User.findById(req.params.id);
    childLogger.info('User fetched successfully', { userId: user._id });
    res.json(user);
  } catch (error) {
    childLogger.error('Failed to fetch user', { error: error.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});
```

### Tracking Requests Across Services

For distributed systems (future enhancement), propagate request ID via HTTP headers:

```javascript
// Outgoing request to external service
axios.get('https://external-api.com/data', {
  headers: {
    'X-Request-Id': req.id  // Forward request ID
  }
});
```

### Finding Related Logs

Search logs by request ID to see entire request lifecycle:

```bash
# grep for request ID in log files
grep "a1b2c3d4-e5f6-7890-abcd-ef1234567890" backend/logs/combined.log

# Or in log aggregation tool (e.g., Kibana)
requestId: "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
```

**Example log trace:**
```json
{"level":"http","message":"POST /api/wallet/transfer","requestId":"a1b2c3d4...","timestamp":"2025-01-15T10:30:45.100Z"}
{"level":"info","message":"Validating wallet transfer","requestId":"a1b2c3d4...","timestamp":"2025-01-15T10:30:45.150Z"}
{"level":"info","message":"Wallet transfer successful","requestId":"a1b2c3d4...","timestamp":"2025-01-15T10:30:45.300Z"}
{"level":"http","message":"POST /api/wallet/transfer 200 200ms","requestId":"a1b2c3d4...","timestamp":"2025-01-15T10:30:45.305Z"}
```

---

## Error Monitoring

### Sentry Integration

**Sentry** is integrated for real-time error tracking and alerting.

**Configuration:**
```javascript
// backend/server.js
const Sentry = require('@sentry/node');

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV || 'development',
  tracesSampleRate: 1.0,  // Capture 100% of transactions
});

// Request handler (must be first)
app.use(Sentry.Handlers.requestHandler());

// Tracing handler
app.use(Sentry.Handlers.tracingHandler());

// Error handler (must be last)
app.use(Sentry.Handlers.errorHandler());
```

### Manual Error Reporting

```javascript
const Sentry = require('@sentry/node');

// Capture exception with context
try {
  await processPayment(userId, amount);
} catch (error) {
  Sentry.captureException(error, {
    tags: {
      section: 'payment',
      severity: 'critical'
    },
    extra: {
      userId: userId,
      amount: amount,
      paymentProvider: 'stripe'
    },
    user: {
      id: userId,
      email: user.email
    }
  });
  
  logger.error('Payment processing failed', {
    error: error.message,
    userId: userId,
    amount: amount
  });
}
```

### Error Categorization

**Critical Errors (immediate attention):**
- Payment processing failures
- Database connection errors
- Authentication bypass attempts
- Wallet balance inconsistencies

**High Priority Errors (investigate within 1 hour):**
- API endpoint failures (5xx errors)
- Rate limit violations (potential attack)
- Idempotency conflicts (potential double-charge)

**Medium Priority Errors (investigate within 24 hours):**
- Third-party API timeouts
- Slow query warnings
- Socket.io connection drops

**Low Priority Errors (monitor trends):**
- Invalid user input (4xx errors)
- Expected validation failures

### Error Alerting

**Sentry Alerts:**
- **Critical:** > 10 errors in 5 minutes → PagerDuty alert
- **High Priority:** > 50 errors in 15 minutes → Slack alert
- **Spike Detection:** 300% increase over baseline → Email alert

---

## Performance Monitoring

### Response Time Tracking

HTTP request/response logging automatically tracks duration:

```javascript
// backend/utils/logger.js - requestLogger() middleware
app.use(requestLogger());  // Logs request start and completion with duration

// Example log output
{
  "level": "http",
  "message": "POST /api/premium/unlock 200 350ms",
  "method": "POST",
  "url": "/api/premium/unlock",
  "status": 200,
  "duration": 350,
  "requestId": "a1b2c3d4...",
  "timestamp": "2025-01-15T10:30:45.305Z"
}
```

### Slow Query Detection

Log queries exceeding performance thresholds:

```javascript
const queryStartTime = Date.now();

const users = await User.find({ role: 'creator' }).lean();

const queryDuration = Date.now() - queryStartTime;

if (queryDuration > 500) {  // 500ms threshold
  logger.warn('Slow query detected', {
    query: 'User.find',
    filter: { role: 'creator' },
    duration: queryDuration,
    resultCount: users.length
  });
}
```

### Database Performance Monitoring

**MongoDB Atlas Monitoring:**
- Slow query log: Queries > 100ms
- Connection pool usage: Alert if > 80% utilization
- Index usage: Monitor index miss rate

**Custom Metrics:**
```javascript
// Track database operation performance
const dbMetrics = {
  operationType: 'find',
  collection: 'transactions',
  duration: 120,
  resultCount: 50
};

logger.info('Database operation completed', dbMetrics);
```

### API Endpoint Performance

**Key Metrics to Track:**
- p50 (median) response time
- p95 response time (95th percentile)
- p99 response time (99th percentile)
- Error rate (% of requests)
- Throughput (requests/second)

**Performance Targets (Phase 7):**
- p50: < 100ms
- p95: < 500ms
- p99: < 1000ms
- Error rate: < 1%

### Real-Time Performance Monitoring

Use log aggregation tools to create performance dashboards:

**Datadog Example:**
```
avg:request.duration{service:superapp-backend} by {endpoint}
```

**ELK/Kibana Example:**
```
{
  "query": {
    "range": {
      "duration": { "gte": 500 }
    }
  },
  "aggs": {
    "by_endpoint": {
      "terms": { "field": "url.keyword" }
    }
  }
}
```

---

## Metrics & Analytics

### Rate Limiting Metrics

Track rate limit violations to detect abuse or misconfigured limits:

```javascript
// backend/middleware/rateLimiter.js
if (!allowed) {
  logger.warn('Rate limit exceeded', {
    userId: userId,
    tier: tier,
    limit: limit,
    endpoint: req.path,
    ip: req.ip
  });
  
  // Track in metrics system
  metrics.increment('rate_limit.violations', {
    tags: { tier: tier, endpoint: req.path }
  });
}
```

**Key Metrics:**
- Rate limit violations per user (detect abuse)
- Rate limit violations per endpoint (detect misconfiguration)
- Rate limit hit rate (% of requests rate-limited)

### Idempotency Metrics

Track idempotency cache hits to validate effectiveness:

```javascript
// backend/middleware/idempotency.js
if (cached) {
  logger.info('Idempotency cache hit', {
    key: idempotencyKey,
    endpoint: req.path,
    userId: req.user?.id
  });
  
  metrics.increment('idempotency.cache_hits');
}
```

**Key Metrics:**
- Idempotency cache hit rate (should be > 5%)
- 409 Conflict rate (duplicate requests in progress)
- Idempotency TTL expiration rate

### Business Metrics

Track critical business operations:

```javascript
// Premium unlock
logger.info('Premium content unlocked', {
  contentId: content._id,
  userId: user._id,
  amount: amount,
  creatorRevenue: split.creator,
  platformRevenue: split.platform
});

// Subscription
logger.info('Subscription created', {
  subscriberId: subscriber._id,
  creatorId: creator._id,
  tier: tier,
  amount: amount,
  expiresAt: expiresAt
});

// Wallet transfer
logger.info('Wallet transfer completed', {
  fromUserId: fromUser._id,
  toUserId: toUser._id,
  amount: amount,
  txId: txId
});
```

**Key Business Metrics:**
- Daily/weekly/monthly revenue
- Premium unlock rate
- Subscription churn rate
- Average transaction value
- Creator revenue distribution

---

## Alerting & Notifications

### Critical Alerts

**Application Down:**
```javascript
// Health check failure detection
if (healthCheckFailed) {
  Sentry.captureMessage('Application health check failed', {
    level: 'fatal',
    tags: { alert: 'critical' }
  });
  
  // Trigger PagerDuty alert
  pagerduty.trigger({
    incident_key: 'app_down',
    description: 'Super-App backend health check failed'
  });
}
```

**High Error Rate:**
```javascript
// Monitor error rate (> 5% for 5 minutes)
if (errorRate > 0.05) {
  logger.error('High error rate detected', {
    errorRate: errorRate,
    windowMinutes: 5,
    totalRequests: totalRequests,
    failedRequests: failedRequests
  });
  
  // Slack notification
  slack.send({
    channel: '#alerts-production',
    text: `🚨 High error rate: ${(errorRate * 100).toFixed(2)}%`,
    color: 'danger'
  });
}
```

### Warning Alerts

**Performance Degradation:**
```javascript
// p95 response time > 500ms for 10 minutes
if (p95ResponseTime > 500) {
  logger.warn('Performance degradation detected', {
    p95ResponseTime: p95ResponseTime,
    threshold: 500,
    windowMinutes: 10
  });
  
  // Email notification
  email.send({
    to: 'devops@example.com',
    subject: 'Performance degradation detected',
    body: `p95 response time: ${p95ResponseTime}ms`
  });
}
```

**Rate Limit Spike:**
```javascript
// Rate limit violations > 100 in 5 minutes (potential attack)
if (rateLimitViolations > 100) {
  logger.warn('Rate limit spike detected', {
    violations: rateLimitViolations,
    windowMinutes: 5
  });
  
  Sentry.captureMessage('Potential API abuse detected', {
    level: 'warning',
    extra: { violations: rateLimitViolations }
  });
}
```

### Notification Channels

**PagerDuty:** Critical production incidents (24/7 on-call)  
**Slack (#alerts-production):** High/medium priority alerts  
**Email:** Warning-level alerts, daily/weekly reports  
**Sentry Dashboard:** All errors, searchable by tags/context

---

## Debugging Workflows

### Debugging a Failed Request

**Step 1:** Obtain request ID from client (via `X-Request-Id` response header)

**Step 2:** Search logs for request ID:
```bash
grep "a1b2c3d4-e5f6-7890-abcd-ef1234567890" backend/logs/combined.log
```

**Step 3:** Analyze log sequence:
```json
{"level":"http","message":"POST /api/wallet/transfer","requestId":"a1b2c3d4...","timestamp":"2025-01-15T10:30:45.100Z"}
{"level":"info","message":"Validating wallet transfer","requestId":"a1b2c3d4...","sender":"user123","receiver":"user456","amount":5000}
{"level":"error","message":"Insufficient wallet balance","requestId":"a1b2c3d4...","balance":3000,"required":5000}
{"level":"http","message":"POST /api/wallet/transfer 400 50ms","requestId":"a1b2c3d4...","status":400}
```

**Step 4:** Check Sentry for additional context:
- Search by request ID or timestamp
- View full stack trace
- Check user context (ID, email, role)

**Step 5:** Reproduce issue in staging:
```bash
curl -X POST https://staging.example.com/api/wallet/transfer \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: test-123" \
  -d '{"receiverId":"user456","amount":5000}'
```

### Debugging Performance Issues

**Step 1:** Identify slow endpoint via logs:
```bash
grep "duration.*[5-9][0-9][0-9]" backend/logs/combined.log  # Requests > 500ms
```

**Step 2:** Analyze slow query logs (MongoDB Atlas or application logs):
```json
{"level":"warn","message":"Slow query detected","query":"Transaction.find","filter":{"userId":"user123"},"duration":850}
```

**Step 3:** Check if missing index:
```bash
npm run migrate:indexes  # Ensure all Phase 7 indexes applied
```

**Step 4:** Explain query plan:
```javascript
db.transactions.find({ userId: "user123", status: "completed" }).explain("executionStats")
// Verify IXSCAN (index scan), not COLLSCAN (collection scan)
```

**Step 5:** Optimize query:
- Add compound index if needed
- Use `.lean()` for read-only queries (skip Mongoose hydration)
- Add pagination for large result sets

### Debugging Rate Limit Issues

**Step 1:** Verify rate limit configuration:
```javascript
// Check user tier
const user = await User.findById(userId);
console.log(user.role);  // Free, Premium, Creator, Admin
```

**Step 2:** Check rate limit logs:
```bash
grep "Rate limit exceeded" backend/logs/combined.log
```

**Step 3:** Test rate limit manually:
```bash
# Send 11 requests rapidly (Free tier limit: 10/min)
for i in {1..11}; do
  curl -H "Authorization: Bearer $TOKEN" https://api.example.com/api/wallet/balance
done
# 11th request should return 429 Too Many Requests
```

**Step 4:** Check response headers:
```
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1705315200
Retry-After: 60
```

### Debugging Idempotency Issues

**Step 1:** Check if idempotency key provided:
```bash
curl -X POST https://api.example.com/api/wallet/transfer \
  -H "Authorization: Bearer $TOKEN" \
  -H "Idempotency-Key: test-123" \
  -d '{"receiverId":"user456","amount":5000}'
```

**Step 2:** Retry with same key (should return cached response):
```bash
# Second request should return same response instantly
curl -X POST https://api.example.com/api/wallet/transfer \
  -H "Authorization: Bearer $TOKEN" \
  -H "Idempotency-Key: test-123" \
  -d '{"receiverId":"user456","amount":5000}'
```

**Step 3:** Check idempotency logs:
```bash
grep "Idempotency cache hit" backend/logs/combined.log
```

**Step 4:** Verify no duplicate transactions:
```javascript
const transactions = await Transaction.find({ idempotencyKey: "test-123" });
console.log(transactions.length);  // Should be 1, not 2
```

---

## Log Analysis

### Common Log Queries

**Find all errors in last hour:**
```bash
# Assuming combined.log has timestamps
awk -v date="$(date -u -d '1 hour ago' '+%Y-%m-%dT%H')" '$0 ~ date && /\"level\":\"error\"/' backend/logs/combined.log
```

**Count errors by type:**
```bash
grep '"level":"error"' backend/logs/combined.log | jq -r '.message' | sort | uniq -c | sort -nr
```

**Find slowest endpoints:**
```bash
grep '"level":"http"' backend/logs/combined.log | jq -r 'select(.duration > 500) | "\(.duration)ms \(.method) \(.url)"' | sort -nr | head -20
```

**Track user activity:**
```bash
grep '"userId":"user123"' backend/logs/combined.log | jq -r '"\(.timestamp) \(.message)"'
```

**Find rate limit violations:**
```bash
grep "Rate limit exceeded" backend/logs/combined.log | jq -r '.userId' | sort | uniq -c | sort -nr
```

### Log Aggregation with ELK Stack

**Elasticsearch Query (JSON):**
```json
{
  "query": {
    "bool": {
      "must": [
        { "match": { "level": "error" } },
        { "range": { "timestamp": { "gte": "now-1h" } } }
      ]
    }
  },
  "aggs": {
    "error_types": {
      "terms": { "field": "message.keyword", "size": 10 }
    }
  }
}
```

**Kibana Visualization:**
- **Dashboard 1:** Request rate over time (line chart)
- **Dashboard 2:** Error rate by endpoint (bar chart)
- **Dashboard 3:** p95/p99 response time (area chart)
- **Dashboard 4:** Top 10 slowest endpoints (table)

### Log Aggregation with Datadog

**Datadog Query Language:**
```
# Count errors by service
status:error service:superapp-backend | count by message

# Average response time by endpoint
@duration:* service:superapp-backend | avg(@duration) by @http.url

# Rate limit violations over time
@message:"Rate limit exceeded" service:superapp-backend | count
```

---

## Dashboard Setup

### Recommended Dashboards

**Dashboard 1: Application Health**
- Uptime percentage (last 24h/7d/30d)
- Request rate (requests/second)
- Error rate (% of total requests)
- p50/p95/p99 response times
- Active connections

**Dashboard 2: Error Tracking**
- Error count by level (error, warn)
- Top 10 error messages
- Error rate by endpoint
- Errors by user (to detect patterns)
- Sentry issues opened/resolved

**Dashboard 3: Performance**
- Response time distribution (histogram)
- Slowest endpoints (table)
- Database query performance
- Socket.io connection latency
- Memory/CPU usage

**Dashboard 4: Business Metrics**
- Daily/weekly/monthly revenue
- Premium unlocks (count, revenue)
- Subscriptions (new, active, churned)
- Wallet transfers (count, volume)
- Top creators by revenue

**Dashboard 5: Security & Rate Limiting**
- Rate limit violations by tier
- Rate limit violations by endpoint
- Idempotency cache hit rate
- 429 error rate
- Suspicious activity alerts

### Creating Grafana Dashboard (Example)

**1. Add Loki Data Source (for logs):**
```yaml
datasources:
  - name: Loki
    type: loki
    url: http://loki:3100
    access: proxy
```

**2. Create Panel for Error Rate:**
```
Query: rate({job="superapp-backend", level="error"}[5m])
Visualization: Time series
Legend: Error rate
```

**3. Create Panel for p95 Response Time:**
```
Query: histogram_quantile(0.95, rate(request_duration_seconds_bucket[5m]))
Visualization: Time series
Legend: p95 response time
```

---

## Best Practices

### 1. Always Include Context

❌ **Bad:**
```javascript
logger.error('Payment failed');
```

✅ **Good:**
```javascript
logger.error('Payment failed', {
  userId: userId,
  amount: amount,
  provider: 'stripe',
  errorCode: error.code,
  errorMessage: error.message
});
```

### 2. Use Appropriate Log Levels

- **error:** Unrecoverable errors (payment failures, database errors)
- **warn:** Recoverable issues (slow queries, approaching rate limits)
- **info:** Business events (user signup, content unlock, subscription)
- **http:** HTTP requests/responses (automatic via middleware)
- **debug:** Detailed debugging (query plans, variable states)

### 3. Log Structured Data

❌ **Bad:**
```javascript
logger.info(`User ${userId} unlocked content ${contentId} for $${amount / 100}`);
```

✅ **Good:**
```javascript
logger.info('Premium content unlocked', {
  userId: userId,
  contentId: contentId,
  amount: amount,
  currency: 'USD'
});
```

### 4. Don't Log Sensitive Data

❌ **Bad:**
```javascript
logger.info('User login', {
  email: email,
  password: password,  // ❌ Never log passwords
  creditCard: cardNumber  // ❌ Never log credit cards
});
```

✅ **Good:**
```javascript
logger.info('User login', {
  email: email,
  // Password automatically masked by logger
});
```

**Automatic Masking:** Logger automatically redacts fields: `password`, `token`, `secret`, `apiKey`, `authorization`

### 5. Use Child Loggers for Context

✅ **Good:**
```javascript
const childLogger = createChildLogger(req.id);

childLogger.info('Processing payment');
// Automatically includes requestId in all logs
```

### 6. Monitor Log Volume

- Target: < 500MB/day for production
- Set up alerts for log volume spikes (potential issue or attack)
- Use log sampling for high-traffic endpoints if needed

### 7. Correlate Logs with Errors

Always log error details before throwing:

```javascript
try {
  await processPayment(userId, amount);
} catch (error) {
  logger.error('Payment processing failed', {
    userId: userId,
    amount: amount,
    error: error.message,
    stack: error.stack
  });
  
  Sentry.captureException(error);  // Also send to Sentry
  
  throw error;  // Re-throw for higher-level handling
}
```

### 8. Use Request IDs in Client Responses

Return request ID in error responses for easy debugging:

```javascript
res.status(500).json({
  error: 'Internal server error',
  requestId: req.id,  // Client can provide this for support
  message: 'Please contact support with this request ID'
});
```

### 9. Regularly Review Logs

- **Daily:** Check error.log for critical errors
- **Weekly:** Analyze slow query logs, rate limit violations
- **Monthly:** Review performance trends, log volume, error patterns

### 10. Test Observability Features

Include observability in testing:

```javascript
// Unit test for logging
it('should log wallet transfer', async () => {
  const logSpy = jest.spyOn(logger, 'info');
  
  await walletService.transfer(fromUserId, toUserId, amount);
  
  expect(logSpy).toHaveBeenCalledWith('Wallet transfer completed', {
    fromUserId: fromUserId,
    toUserId: toUserId,
    amount: amount,
    txId: expect.any(String)
  });
});
```

---

## Troubleshooting

### Logs Not Appearing

**Issue:** Logs not written to file  
**Solution:**
1. Check log directory permissions: `ls -la backend/logs/`
2. Ensure directory writable by application user
3. Check disk space: `df -h`
4. Verify `LOG_LEVEL` environment variable

### Request IDs Missing

**Issue:** Request IDs not in logs  
**Solution:**
1. Verify `attachRequestId()` middleware applied before routes
2. Check middleware order in `server.js`
3. Ensure `createChildLogger()` used in services

### Sentry Errors Not Appearing

**Issue:** Errors not tracked in Sentry  
**Solution:**
1. Verify `SENTRY_DSN` environment variable set
2. Check Sentry error handler is last middleware: `app.use(Sentry.Handlers.errorHandler())`
3. Test with manual capture: `Sentry.captureMessage('Test error')`
4. Check Sentry quota limits

### High Log Volume

**Issue:** Log files growing too fast  
**Solution:**
1. Reduce `LOG_LEVEL` to `info` or `warn` in production
2. Implement log sampling for high-traffic endpoints
3. Exclude health check logs: `if (req.path !== '/api/health') { logger.http(...) }`
4. Increase rotation frequency (e.g., 10MB instead of 20MB)

---

## Appendix: Environment Variables

| Variable | Description | Default | Example |
|----------|-------------|---------|---------|
| `LOG_LEVEL` | Minimum log level | `info` | `debug`, `info`, `warn`, `error` |
| `SENTRY_DSN` | Sentry project DSN | (none) | `https://xxx@sentry.io/123` |
| `NODE_ENV` | Environment | `development` | `production`, `staging` |
| `REDIS_URL` | Redis connection (optional) | (none) | `redis://localhost:6379` |

---

**Version:** 1.0  
**Maintained By:** DevOps Team  
**Next Review:** Post Phase 7 Deployment
