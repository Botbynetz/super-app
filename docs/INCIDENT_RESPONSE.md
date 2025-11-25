# 🚨 INCIDENT RESPONSE GUIDE

Quick reference for handling production incidents in staging environment.

---

## Incident Severity Levels

| Level | Description | Response Time | Examples |
|-------|-------------|---------------|----------|
| **P0 - Critical** | Complete outage | < 15 minutes | API down, database offline |
| **P1 - High** | Major feature broken | < 1 hour | Payments failing, auth broken |
| **P2 - Medium** | Feature degraded | < 4 hours | Slow responses, minor bugs |
| **P3 - Low** | Minor issue | < 24 hours | UI glitches, logging issues |

---

## Quick Response Actions

### 🔴 P0: API Down

**Symptoms**:
- Health check returns 503
- All requests timeout
- Telegram alert: "Server crashed"

**Immediate Actions**:
```bash
# 1. Check Render status
https://render-status.com

# 2. Check Render logs
Render Dashboard → Logs tab

# 3. Restart service
Render Dashboard → Manual Deploy → Restart

# 4. Check MongoDB
MongoDB Atlas → Metrics
```

**Escalation**: If not resolved in 15 min, rollback deployment

---

### 🔴 P0: Database Offline

**Symptoms**:
- `MongoNetworkError` in logs
- Health check shows `database: disconnected`
- Telegram alert: "Database Connection Lost"

**Immediate Actions**:
```bash
# 1. Check MongoDB Atlas status
https://status.cloud.mongodb.com

# 2. Check IP whitelist
MongoDB Atlas → Network Access

# 3. Verify connection string
Check DATABASE_URI env var

# 4. Check cluster status
MongoDB Atlas → Clusters → View Metrics
```

**Temporary Fix**:
```bash
# Restart backend (may re-establish connection)
pm2 restart all
```

---

### 🟠 P1: Payments Failing

**Symptoms**:
- Premium unlocks failing
- Subscriptions not processing
- Wallet transactions rejected

**Immediate Actions**:
```bash
# 1. Check wallet balances
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  https://staging.superapp.com/api/telemetry/revenue

# 2. Check transaction logs
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  'https://staging.superapp.com/api/logs/errors?lines=100'

# 3. Check fraud system
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  https://staging.superapp.com/api/telemetry/fraud

# 4. Review Sentry errors
https://sentry.io → Filter by "payment"
```

**Common Causes**:
- Insufficient balance (expected)
- Database transaction timeout
- Fraud system blocking legitimate transactions
- Race condition in concurrent unlocks

---

### 🟠 P1: Authentication Broken

**Symptoms**:
- Users can't login
- JWT tokens rejected
- 401 errors spiking

**Immediate Actions**:
```bash
# 1. Check JWT_SECRET
Render Dashboard → Environment → JWT_SECRET

# 2. Test authentication manually
curl -X POST https://staging.superapp.com/api/auth/login \
  -d '{"email":"test@example.com","password":"Test123!@#"}'

# 3. Check error logs
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  https://staging.superapp.com/api/logs/errors

# 4. Check Sentry for auth errors
Filter by: "jwt", "authentication", "401"
```

---

### 🟡 P2: High Memory Usage

**Symptoms**:
- Telegram alert: "High Memory Usage"
- PM2 instances restarting frequently
- Slow response times

**Immediate Actions**:
```bash
# 1. Check telemetry
curl https://staging.superapp.com/api/telemetry/health

# 2. View PM2 metrics (if accessible)
pm2 monit

# 3. Check for memory leaks
# Look for continuously growing heap usage

# 4. Restart instances
pm2 restart ecosystem.config.js
```

**Investigation**:
```bash
# Check process memory
ps aux | grep node

# Review heap snapshot (if needed)
node --inspect server.js
# Connect Chrome DevTools → Memory tab
```

---

### 🟡 P2: Socket.io Disconnections

**Symptoms**:
- WebSocket connections dropping
- Real-time events not received
- Client reconnection loops

**Immediate Actions**:
```bash
# 1. Test Socket.io connection
node -e "
  const io = require('socket.io-client');
  const socket = io('https://staging.superapp.com');
  socket.on('connect', () => console.log('OK'));
  socket.on('connect_error', (e) => console.error(e));
"

# 2. Check CORS configuration
# Verify SOCKET_CORS_ORIGIN includes client URL

# 3. Check load balancer settings
# Ensure WebSocket upgrade headers allowed

# 4. Review Socket.io logs
grep "socket" backend/logs/combined.log
```

---

## Common Error Codes

### 401 Unauthorized
**Cause**: Invalid/expired JWT token  
**Fix**: User needs to re-login  
**Check**: JWT_SECRET not changed

### 403 Forbidden
**Cause**: Insufficient permissions  
**Fix**: Verify user role  
**Check**: Admin routes require admin role

### 429 Too Many Requests
**Cause**: Rate limit exceeded  
**Fix**: Expected behavior, wait for reset  
**Check**: Adjust limits if too aggressive

### 500 Internal Server Error
**Cause**: Uncaught exception  
**Fix**: Check Sentry and error logs  
**Check**: Recent code changes

### 503 Service Unavailable
**Cause**: Database disconnected or server overloaded  
**Fix**: Restart service, check database  
**Check**: MongoDB Atlas status

---

## Rollback Procedures

### Automatic Rollback (CI/CD)

If health checks fail after deployment:
- Automatically triggered by GitHub Actions
- Previous version restored
- Telegram notification sent

### Manual Rollback (Render)

```bash
# Method 1: Render Dashboard
1. Go to Render Dashboard
2. Click "Rollback"
3. Select previous successful deployment
4. Confirm rollback

# Method 2: Webhook
curl -X POST "$RENDER_ROLLBACK_HOOK"
```

### Verify Rollback

```bash
# Check version
curl https://staging.superapp.com/api/health

# Check commit hash
git log --oneline -1

# Verify Telegram notification
```

---

## Investigation Tools

### 1. Render Logs
```
Render Dashboard → Logs tab
Filter by: Error, Warning, Info
Download logs for analysis
```

### 2. Sentry Dashboard
```
https://sentry.io
Filter by:
  - Time range
  - Error type
  - User ID
  - Release version
```

### 3. Winston Logs
```bash
# Combined logs (last 200 lines)
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  'https://staging.superapp.com/api/logs/combined?lines=200'

# Error logs only
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  'https://staging.superapp.com/api/logs/errors?lines=100'

# Download for local analysis
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  -o logs.txt \
  https://staging.superapp.com/api/logs/download/combined
```

### 4. Telemetry Snapshot
```bash
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  https://staging.superapp.com/api/telemetry/snapshot
```

### 5. MongoDB Atlas Metrics
```
MongoDB Atlas → Clusters → Metrics
- Query performance
- Connection count
- Disk usage
- Memory usage
```

---

## Contact Points

### Automated Alerts
- **Telegram**: Critical errors, fraud, high-value transactions
- **Sentry**: All exceptions and performance issues
- **GitHub**: CI/CD pipeline failures

### Manual Checks
- **Render Dashboard**: Logs, metrics, deployment history
- **MongoDB Atlas**: Database health, performance
- **Sentry.io**: Error tracking, user sessions
- **Telegram Bot**: Direct alerts to admin

---

## Post-Incident Actions

### 1. Document Incident

```markdown
## Incident Report - [Date]

**Severity**: P0/P1/P2/P3
**Duration**: [Start time] - [End time]
**Impact**: [What was affected]

**Root Cause**:
[Description]

**Timeline**:
- HH:MM - Incident detected
- HH:MM - Investigation started
- HH:MM - Fix deployed
- HH:MM - Incident resolved

**Actions Taken**:
1. [Action 1]
2. [Action 2]

**Lessons Learned**:
[What we learned]

**Prevention**:
[How to prevent in future]
```

### 2. Update Monitoring

If incident wasn't caught early:
- Add new Sentry alert rule
- Configure Telegram alert threshold
- Add custom telemetry metric
- Update health check

### 3. Code Fixes

- Create GitHub issue
- Link to incident report
- Implement fix
- Add test coverage
- Deploy fix

### 4. Review & Improve

- Team retrospective
- Update runbooks
- Improve alerting
- Add more tests

---

## Escalation Matrix

| Time | Action |
|------|--------|
| T+0 | Incident detected → Telegram alert |
| T+15min | No resolution → Check runbook |
| T+30min | Still unresolved → Rollback deployment |
| T+1hr | Critical incident → Notify team lead |
| T+2hr | Extended outage → Create incident channel |

---

## Emergency Commands

```bash
# Health check
curl https://staging.superapp.com/api/health

# Get recent errors
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  https://staging.superapp.com/api/logs/errors | jq '.data.errors[:10]'

# Check database connection
mongosh "$DATABASE_URI" --eval "db.adminCommand({ping: 1})"

# Restart PM2 (if accessible)
pm2 restart ecosystem.config.js

# Simulate error (testing only)
curl -X POST -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"errorType":"generic"}' \
  https://staging.superapp.com/api/staging/simulate-error

# Check memory usage
curl https://staging.superapp.com/api/telemetry/health | jq '.services.memory'

# View active connections (if PM2 Plus configured)
# Check PM2 Plus dashboard

# Download logs
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  -o emergency-logs.log \
  https://staging.superapp.com/api/logs/download/combined
```

---

## Prevention Checklist

- [ ] All tests passing before deployment
- [ ] Sentry configured and receiving errors
- [ ] Telegram bot sending alerts
- [ ] Health checks enabled (30s interval)
- [ ] Database replica set configured
- [ ] Auto-rollback enabled in CI/CD
- [ ] Rate limiting configured
- [ ] Error handling on all routes
- [ ] Logging comprehensive
- [ ] Monitoring dashboards set up

---

## Recovery Time Objectives (RTO)

| Incident Type | Target RTO | Actual RTO |
|---------------|------------|------------|
| Complete outage | < 15 min | [Track] |
| Database offline | < 15 min | [Track] |
| Payment failure | < 1 hour | [Track] |
| Auth broken | < 1 hour | [Track] |
| Performance degradation | < 4 hours | [Track] |

---

## Useful Links

- **Render Status**: https://render-status.com
- **MongoDB Status**: https://status.cloud.mongodb.com
- **Sentry Dashboard**: https://sentry.io/your-org/superapp-staging
- **GitHub Actions**: https://github.com/Botbynetz/super-app/actions
- **Staging API**: https://superapp-backend-staging.onrender.com

---

**Last Updated**: November 25, 2025  
**Version**: 1.0  
**Review**: Quarterly  
**Owner**: DevOps Team
