# 🧪 STAGING QA TEST GUIDE

Complete QA testing checklist for staging environment validation.

---

## Pre-Testing Setup

### 1. Access Credentials

**API Base URL**: `https://superapp-backend-staging.onrender.com`

**Test Accounts**:
```
Buyer: testbuyer@example.com / Test123!@#
Creator: testcreator@example.com / Test123!@#
Admin: admin@example.com / Admin123!@#
```

### 2. Required Tools

- ✅ Postman or cURL
- ✅ WebSocket test client (Socket.io client)
- ✅ Browser for health checks
- ✅ Telegram app (for alert testing)

---

## Test Categories

### ✅ 1. Health & Infrastructure

**Test**: Server health check
```bash
curl https://superapp-backend-staging.onrender.com/api/health
```
**Expected**: `{"status": "healthy", "services": {"database": "connected"}}`

**Test**: Staging info
```bash
curl https://superapp-backend-staging.onrender.com/api/staging/info
```
**Expected**: `{"features": {"faucet": true, "realPayouts": false}}`

**Test**: PM2 instances running
**Expected**: Telegram notification on server start

---

### ✅ 2. Authentication Flow

**Test 2.1**: User registration
```bash
curl -X POST https://superapp-backend-staging.onrender.com/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "qa_user_1",
    "email": "qa1@example.com",
    "password": "Test123!@#"
  }'
```
**Expected**: `{"success": true, "token": "..."}`

**Test 2.2**: User login
```bash
curl -X POST https://superapp-backend-staging.onrender.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "qa1@example.com",
    "password": "Test123!@#"
  }'
```
**Expected**: JWT token returned

**Test 2.3**: Invalid credentials
**Expected**: `401 Unauthorized`

---

### ✅ 3. Wallet Operations

**Test 3.1**: Get wallet balance
```bash
curl -H "Authorization: Bearer $TOKEN" \
  https://superapp-backend-staging.onrender.com/api/user/wallet
```
**Expected**: `{"balance": 0}`

**Test 3.2**: Faucet claim (staging feature)
```bash
curl -X POST -H "Authorization: Bearer $TOKEN" \
  https://superapp-backend-staging.onrender.com/api/staging/faucet
```
**Expected**: `{"success": true, "data": {"amount": 10000}}`

**Test 3.3**: Faucet cooldown (claim again immediately)
**Expected**: `400 Bad Request` - "Already claimed today"

**Test 3.4**: Check audit log (admin)
```bash
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  https://superapp-backend-staging.onrender.com/api/logs/stream/audit
```
**Expected**: SSE stream with FAUCET_CLAIM event

---

### ✅ 4. Premium Content Unlock

**Test 4.1**: List premium content
```bash
curl -H "Authorization: Bearer $TOKEN" \
  https://superapp-backend-staging.onrender.com/api/content/premium
```
**Expected**: Array of premium content

**Test 4.2**: Unlock content
```bash
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"contentId": "CONTENT_ID"}' \
  https://superapp-backend-staging.onrender.com/api/monetization/unlock
```
**Expected**: `{"success": true}` + wallet deduction

**Test 4.3**: Idempotency (unlock same content twice)
**Expected**: `400 Bad Request` - "Already unlocked"

**Test 4.4**: Insufficient balance
**Expected**: `400 Bad Request` - "Insufficient balance"

**Test 4.5**: Revenue split validation
**Check**: CreatorRevenue updated (70%), platform (25%), subscriber pool (5%)

---

### ✅ 5. Subscription Flow

**Test 5.1**: Subscribe to creator (monthly)
```bash
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"creatorId": "CREATOR_ID", "tier": "monthly"}' \
  https://superapp-backend-staging.onrender.com/api/monetization/subscribe
```
**Expected**: `{"success": true}` + subscription created

**Test 5.2**: Access subscriber-only content
**Expected**: Can access all creator's premium content

**Test 5.3**: Cancel subscription
```bash
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -d '{"subscriptionId": "SUB_ID"}' \
  https://superapp-backend-staging.onrender.com/api/monetization/cancel-subscription
```
**Expected**: Subscription cancelled, access until end of period

**Test 5.4**: Subscription expiry
**Check**: After expiry date, access revoked

---

### ✅ 6. Gift Sending

**Test 6.1**: Get gift types
```bash
curl -H "Authorization: Bearer $TOKEN" \
  https://superapp-backend-staging.onrender.com/api/gift/types
```
**Expected**: List of available gifts (rose, heart, diamond)

**Test 6.2**: Send single gift
```bash
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "recipientId": "CREATOR_ID",
    "giftType": "rose",
    "quantity": 1
  }' \
  https://superapp-backend-staging.onrender.com/api/gift/send
```
**Expected**: Gift sent, balance deducted

**Test 6.3**: Gift combo (send 5+ quickly)
**Expected**: Combo bonus applied, Socket.io events emitted

**Test 6.4**: Gift leaderboard
```bash
curl https://superapp-backend-staging.onrender.com/api/gift/leaderboard
```
**Expected**: Top gift senders/receivers

---

### ✅ 7. Fraud Detection

**Test 7.1**: Velocity limit (unlock 15 items rapidly)
**Expected**: Rate limit triggered after 10 unlocks/hour

**Test 7.2**: High-value transaction
**Expected**: Transaction logged, Telegram alert sent (if > 1000 coins)

**Test 7.3**: Risk score calculation
**Expected**: AuditLog entry with calculated risk score

**Test 7.4**: Concurrent unlocks (same content)
**Expected**: Only one succeeds, others rejected

---

### ✅ 8. Creator Payout

**Test 8.1**: Request payout (creator account)
```bash
curl -X POST -H "Authorization: Bearer $CREATOR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"amount": 5000}' \
  https://superapp-backend-staging.onrender.com/api/monetization/request-payout
```
**Expected**: Payout request created, Telegram alert sent

**Test 8.2**: Admin approve payout
```bash
curl -X POST -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"payoutId": "PAYOUT_ID"}' \
  https://superapp-backend-staging.onrender.com/api/admin/approve-payout
```
**Expected**: Status = APPROVED (but NOT processed due to DISABLE_REAL_PAYOUTS)

**Test 8.3**: Admin reject payout
**Expected**: Funds returned to creator's available balance

---

### ✅ 9. Socket.io Real-Time Events

**Test 9.1**: Connect to WebSocket
```javascript
const io = require('socket.io-client');
const socket = io('https://superapp-backend-staging.onrender.com', {
  auth: { token: 'YOUR_JWT_TOKEN' }
});

socket.on('connect', () => console.log('Connected!'));
socket.on('PREMIUM_UNLOCKED', (data) => console.log(data));
```
**Expected**: Connection established

**Test 9.2**: Receive unlock event
**Trigger**: Unlock premium content from another client
**Expected**: Socket event `PREMIUM_UNLOCKED` received

**Test 9.3**: Receive gift event
**Expected**: `GIFT_SENT` event with animation data

**Test 9.4**: Subscription events
**Expected**: `SUBSCRIPTION_STARTED`, `SUBSCRIPTION_CANCELLED`

---

### ✅ 10. Monitoring & Telemetry

**Test 10.1**: Get telemetry metrics (admin)
```bash
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  https://superapp-backend-staging.onrender.com/api/telemetry/metrics
```
**Expected**: Current metrics snapshot

**Test 10.2**: Revenue analytics (admin)
```bash
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  https://superapp-backend-staging.onrender.com/api/telemetry/revenue
```
**Expected**: Revenue breakdown by type

**Test 10.3**: Fraud metrics (admin)
**Expected**: List of fraud alerts and high-risk users

---

### ✅ 11. Logging

**Test 11.1**: View combined logs (admin)
```bash
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  'https://superapp-backend-staging.onrender.com/api/logs/combined?lines=50'
```
**Expected**: Last 50 log entries

**Test 11.2**: View error logs (admin)
**Expected**: Error logs only

**Test 11.3**: Download logs (admin)
**Expected**: File download initiated

**Test 11.4**: Stream audit logs (admin)
**Expected**: SSE connection with real-time events

---

### ✅ 12. Error Handling & Sentry

**Test 12.1**: Trigger test error (admin)
```bash
curl -X POST -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"errorType": "generic"}' \
  https://superapp-backend-staging.onrender.com/api/staging/simulate-error
```
**Expected**: 
- Error logged
- Sentry captures exception
- Telegram alert sent

**Test 12.2**: Check Sentry dashboard
**Expected**: Error appears in Sentry with stack trace

---

### ✅ 13. Telegram Alerts

**Test 13.1**: Server startup notification
**Trigger**: Restart server or redeploy
**Expected**: 🚀 "Server Started" message

**Test 13.2**: Error alert
**Trigger**: Simulate error (Test 12.1)
**Expected**: ❌ "Critical Error Detected" message

**Test 13.3**: Fraud alert
**Trigger**: Trigger velocity limit
**Expected**: 🚨 "Fraud Alert" message

**Test 13.4**: Payout request
**Trigger**: Creator requests payout
**Expected**: 💵 "Payout Request" message

---

### ✅ 14. Load & Performance

**Test 14.1**: Run quick load test
```bash
npm run load-test:quick
```
**Expected**: 30s test completes, p95 < 500ms

**Test 14.2**: Full load test
```bash
cd load-tests
./run-load-tests.sh full
```
**Expected**: 
- No timeout errors
- Error rate < 1%
- p99 < 1000ms

**Test 14.3**: Check reports
**Location**: `load-tests/reports/*.html`
**Expected**: HTML report generated

---

### ✅ 15. Security

**Test 15.1**: Access protected route without token
```bash
curl https://superapp-backend-staging.onrender.com/api/user/wallet
```
**Expected**: `401 Unauthorized`

**Test 15.2**: Admin endpoint as regular user
**Expected**: `403 Forbidden`

**Test 15.3**: SQL injection attempt
```bash
curl -X POST https://superapp-backend-staging.onrender.com/api/auth/login \
  -d 'email=admin" OR 1=1--&password=anything'
```
**Expected**: Rejected, no error leak

**Test 15.4**: Rate limiting
**Trigger**: Make 100+ requests rapidly
**Expected**: `429 Too Many Requests`

---

## Test Execution Checklist

### Pre-Deployment
- [ ] All unit tests pass locally
- [ ] All integration tests pass locally
- [ ] Docker build succeeds
- [ ] Environment variables configured

### Post-Deployment
- [ ] Health check returns 200
- [ ] Database connection active
- [ ] Sentry receiving errors
- [ ] Telegram bot sends startup notification
- [ ] All 15 test categories pass

### Performance
- [ ] Response time p95 < 500ms
- [ ] Response time p99 < 1000ms
- [ ] Error rate < 1%
- [ ] Memory usage < 80%

### Monitoring
- [ ] Sentry dashboard showing data
- [ ] Winston logs being created
- [ ] Telemetry API returning metrics
- [ ] Telegram alerts working
- [ ] Audit log streaming functional

---

## Test Reporting Template

```markdown
## QA Test Report - [Date]

**Tester**: [Your Name]
**Environment**: Staging
**Build**: [Commit SHA]

### Test Results

| Category | Tests | Passed | Failed | Notes |
|----------|-------|--------|--------|-------|
| Health | 3 | 3 | 0 | ✅ |
| Auth | 3 | 3 | 0 | ✅ |
| Wallet | 4 | 4 | 0 | ✅ |
| Unlock | 5 | 5 | 0 | ✅ |
| Subscription | 4 | 4 | 0 | ✅ |
| Gifts | 4 | 4 | 0 | ✅ |
| Fraud | 4 | 4 | 0 | ✅ |
| Payout | 3 | 3 | 0 | ✅ |
| Socket.io | 4 | 4 | 0 | ✅ |
| Telemetry | 3 | 3 | 0 | ✅ |
| Logging | 4 | 4 | 0 | ✅ |
| Errors | 2 | 2 | 0 | ✅ |
| Telegram | 4 | 4 | 0 | ✅ |
| Load Test | 3 | 3 | 0 | ✅ |
| Security | 4 | 4 | 0 | ✅ |

**Total**: 54/54 passed ✅

### Issues Found
[None / List issues]

### Recommendations
[Any recommendations for production]
```

---

## Automated Testing

Run full test suite:
```bash
# Integration tests
npm run test:integration

# Load tests
npm run load-test

# Smoke tests
npm run test:smoke
```

---

## Next Steps

After QA approval:
1. ✅ Document any issues found
2. ✅ Fix critical/high priority bugs
3. ✅ Re-test after fixes
4. ✅ Sign off for production deployment
5. ✅ Create production deployment plan

---

**Last Updated**: November 25, 2025  
**Version**: 1.0  
**Status**: ✅ Ready for QA
