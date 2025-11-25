# 🧪 Integration Testing Suite - Phase 5 Monetization

Complete end-to-end integration testing infrastructure for Phase 5 monetization system.

## 📋 Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Test Files](#test-files)
- [Quick Start](#quick-start)
- [Running Tests](#running-tests)
- [Test Coverage](#test-coverage)
- [CI/CD Integration](#cicd-integration)
- [Troubleshooting](#troubleshooting)

---

## 🎯 Overview

This integration testing suite validates **all Phase 5 monetization flows end-to-end**:

✅ **Premium Content Unlock** - Idempotent transactions, revenue splits, access control  
✅ **Subscriptions** - Subscribe, renew, expire, cancel with automated batch jobs  
✅ **Revenue Settlement** - Pending to available balance movement with holding periods  
✅ **Creator Payouts** - Request, approve, reject with fund locking  
✅ **Live Gifts** - Gift sending, combos, leaderboards with real-time notifications  
✅ **Fraud Detection** - Velocity limits, risk scoring, auto-freeze  
✅ **Socket.io Events** - Real-time notifications for all monetization actions  

---

## 🏗️ Architecture

```
backend/
├── tests/
│   ├── integration/
│   │   ├── unlock_flow.test.js        # Premium unlock with idempotency
│   │   ├── subscription_flow.test.js  # Subscribe, renew, expire, cancel
│   │   ├── revenue_settlement.test.js # Pending → available settlement
│   │   ├── payout_flow.test.js        # Payout request, approve, reject
│   │   ├── gift_flow.test.js          # Gift sending, combos, leaderboard
│   │   ├── fraud_flow.test.js         # Velocity limits, risk scoring
│   │   └── socket_events.test.js      # Real-time event validation
│   │
│   ├── fixtures/
│   │   ├── seedUsers.js               # Test user data generator
│   │   ├── seedContent.js             # Premium content fixtures
│   │   └── seedCreatorRevenue.js      # Revenue data fixtures
│   │
│   ├── utils/
│   │   ├── testServer.js              # Test server lifecycle management
│   │   ├── apiClient.js               # Authenticated API client wrapper
│   │   ├── socketClient.js            # Socket.io test client
│   │   └── cleanupDB.js               # Database cleanup utilities
│   │
│   ├── setup.js                       # Jest setup (custom matchers)
│   ├── globalSetup.js                 # Global test setup
│   └── globalTeardown.js              # Global test teardown
│
├── scripts/
│   ├── integration-test.sh            # Linux/Mac test runner
│   └── integration-test.bat           # Windows test runner
│
├── jest.config.js                     # Jest configuration
└── package.json                       # Test scripts
```

---

## 📦 Test Files

### Integration Tests (7 files)

#### 1. `unlock_flow.test.js` (280+ lines)
Tests premium content unlock flow with atomic transactions.

**Test Cases:**
- ✅ Successful unlock with 70/25/5 revenue split
- ✅ Idempotent unlock (duplicate idempotencyKey rejected)
- ✅ Concurrent unlock attempts (10 parallel requests)
- ✅ Insufficient balance error handling
- ✅ Access control (creator/subscriber bypass)
- ✅ Transaction and AuditLog creation
- ✅ Socket.io PREMIUM_UNLOCKED event emission

#### 2. `subscription_flow.test.js` (260+ lines)
Tests subscription lifecycle from subscribe to expiry.

**Test Cases:**
- ✅ Subscribe success (monthly/quarterly/yearly)
- ✅ Access granted to all creator content
- ✅ Auto-renewal with balance check
- ✅ Expiry removes access (batch job)
- ✅ Cancel subscription flow
- ✅ Prevent duplicate subscriptions
- ✅ Socket.io SUBSCRIPTION_* events

#### 3. `revenue_settlement.test.js` (320+ lines)
Tests creator revenue settlement from pending to available.

**Test Cases:**
- ✅ Move pending → available after holding period
- ✅ Batch settlement job for all eligible creators
- ✅ Holding period constraint (7-day default)
- ✅ Dry-run mode without persisting changes
- ✅ Optimistic locking prevents double settlement
- ✅ Revenue analytics updates
- ✅ Socket.io REVENUE_UPDATED event

#### 4. `payout_flow.test.js` (380+ lines)
Tests creator payout request and admin approval/rejection.

**Test Cases:**
- ✅ Request payout with fund locking
- ✅ KYC verification requirement
- ✅ Minimum withdrawal enforcement
- ✅ Prevent multiple pending payouts
- ✅ Admin approve → funds withdrawn
- ✅ Admin reject → funds returned
- ✅ Payout history and filtering
- ✅ Admin dashboard statistics
- ✅ Socket.io PAYOUT_* events

#### 5. `gift_flow.test.js` (340+ lines)
Tests live gift sending with real-time notifications.

**Test Cases:**
- ✅ Send gift with balance deduction
- ✅ Multiple gift types with correct pricing
- ✅ Gift combo detection (multiple gifts in short time)
- ✅ Combo bonus coins
- ✅ Gift leaderboard (top senders)
- ✅ Gift history (sent/received)
- ✅ 70/25/5 revenue split
- ✅ Socket.io GIFT_SENT event with animation data

#### 6. `fraud_flow.test.js` (240+ lines)
Tests fraud detection and prevention systems.

**Test Cases:**
- ✅ Velocity limit (10 unlocks/hour)
- ✅ Risk score calculation (0-100)
- ✅ Auto-freeze on high risk (score > 80)
- ✅ High value transaction flagging (>1000 coins)
- ✅ Subscription abuse detection (rapid subscribe/cancel)
- ✅ Double-spend prevention
- ✅ Audit log creation

#### 7. `socket_events.test.js` (180+ lines)
Tests real-time Socket.io event emissions.

**Test Cases:**
- ✅ PREMIUM_UNLOCKED event payload
- ✅ SUBSCRIPTION_STARTED event
- ✅ REVENUE_UPDATED event
- ✅ PAYOUT_APPROVED event
- ✅ GIFT_SENT event
- ✅ Event delivery to correct rooms (user:${userId})
- ✅ Event data structure validation

---

## 🚀 Quick Start

### Prerequisites

```bash
# 1. Install Node.js 18+ and MongoDB 7+
node --version  # Should be >= 18.x
mongod --version  # Should be >= 7.0

# 2. Start MongoDB
# Linux/Mac:
sudo systemctl start mongod

# Windows:
net start MongoDB

# Or using Docker:
docker run -d -p 27017:27017 --name mongodb mongo:7.0
```

### Installation

```bash
# Install dependencies
cd backend
npm install

# Install additional test dependencies (if not already installed)
npm install --save-dev jest supertest socket.io-client mongodb-memory-server
```

---

## 🧪 Running Tests

### Option 1: Using npm scripts (Recommended)

```bash
# Run ALL integration tests
npm run test:integration

# Run specific test suites
npm run test:unlock          # Unlock flow only
npm run test:subscription    # Subscription flow only
npm run test:fraud           # Fraud detection only
npm run test:revenue         # Revenue settlement + payout
npm run test:gift            # Gift flow only
npm run test:socket          # Socket.io events only

# Run with coverage report
npm run test:integration:coverage

# Watch mode (re-run on file changes)
npm run test:integration:watch

# Run all tests (unit + integration)
npm run test:all
```

### Option 2: Using shell scripts

**Linux/Mac:**
```bash
chmod +x scripts/integration-test.sh
./scripts/integration-test.sh

# Run specific test
./scripts/integration-test.sh unlock_flow.test.js
```

**Windows:**
```cmd
scripts\integration-test.bat

REM Run specific test
scripts\integration-test.bat unlock_flow.test.js
```

### Option 3: Using Jest directly

```bash
# Run all integration tests
npx jest tests/integration/ --runInBand --detectOpenHandles --forceExit

# Run specific test file
npx jest tests/integration/unlock_flow.test.js --runInBand

# Run tests matching pattern
npx jest --testNamePattern="should unlock content successfully"

# Run with verbose output
npx jest tests/integration/ --verbose --runInBand
```

---

## 📊 Test Coverage

### Coverage Reports

After running tests with coverage:

```bash
npm run test:integration:coverage
```

Coverage reports are generated in:
- **HTML**: `backend/coverage/lcov-report/index.html` (open in browser)
- **LCOV**: `backend/coverage/lcov.info` (for CI tools)
- **Text Summary**: Printed to console

### Coverage Thresholds

Configured in `jest.config.js`:

```javascript
coverageThresholds: {
  global: {
    branches: 70,    // Branch coverage
    functions: 75,   // Function coverage
    lines: 75,       // Line coverage
    statements: 75   // Statement coverage
  }
}
```

### Expected Coverage (Phase 5)

| Module                 | Lines | Functions | Branches | Statements |
|------------------------|-------|-----------|----------|------------|
| PremiumContentService  | 92%   | 95%       | 88%      | 92%        |
| SubscriptionService    | 89%   | 91%       | 85%      | 89%        |
| RevenueAnalyticsService| 87%   | 89%       | 82%      | 87%        |
| FraudGuard             | 91%   | 93%       | 89%      | 91%        |
| Routes (premium)       | 85%   | 88%       | 80%      | 85%        |
| Routes (subscription)  | 86%   | 89%       | 81%      | 86%        |

---

## 🔄 CI/CD Integration

### GitHub Actions

Integration tests run automatically on:
- ✅ Push to `main` or `develop` branches
- ✅ Pull requests to `main` or `develop`
- ✅ Manual workflow dispatch

**Workflow file**: `.github/workflows/integration-tests.yml`

**What it does:**
1. Spins up MongoDB container
2. Installs dependencies
3. Runs all integration tests
4. Generates coverage report
5. Uploads coverage to Codecov
6. Comments PR with test results
7. Runs security scan (npm audit + Trivy)

### Running CI Locally

```bash
# Simulate CI environment
docker run -d -p 27017:27017 mongo:7.0
export NODE_ENV=test
export MONGODB_URI=mongodb://localhost:27017/super-app-test
npm run test:integration
```

---

## 🛠️ Troubleshooting

### Common Issues

#### 1. MongoDB Connection Error

**Error:** `MongooseServerSelectionError: connect ECONNREFUSED`

**Solution:**
```bash
# Check if MongoDB is running
mongosh --eval "db.runCommand({ ping: 1 })"

# Start MongoDB
sudo systemctl start mongod  # Linux
net start MongoDB            # Windows
```

#### 2. Port Already in Use

**Error:** `EADDRINUSE: address already in use :::4001`

**Solution:**
```bash
# Kill process using port 4001
lsof -ti:4001 | xargs kill -9  # Linux/Mac
netstat -ano | findstr :4001   # Windows (then taskkill /PID <PID> /F)

# Or change TEST_PORT in environment
export TEST_PORT=4002
```

#### 3. Tests Hanging / Not Exiting

**Error:** Tests complete but process doesn't exit

**Solution:**
- Tests already configured with `--detectOpenHandles --forceExit`
- If still hanging, check for unclosed MongoDB connections in your code
- Ensure `afterEach` hooks call `await mongoose.connection.dropDatabase()`
- Ensure `afterAll` hooks call `await stopTestServer(server)`

#### 4. Idempotency Test Failures

**Error:** Duplicate unlock not rejected

**Solution:**
- Ensure `PremiumUnlock` model has unique sparse index on `idempotencyKey`
- Run: `db.premiumunlocks.createIndex({ idempotencyKey: 1 }, { unique: true, sparse: true })`
- Check `PremiumContent.hasAccess()` logic

#### 5. Socket.io Event Not Emitted

**Error:** Socket event assertion fails

**Solution:**
- Ensure Socket.io instance attached to `app.io` in `testServer.js`
- Check service layer emits events via `req.app.io.to('user:${userId}').emit(...)`
- Verify socket rooms joined correctly in authentication middleware

#### 6. Test Database Not Cleaned

**Error:** Tests fail due to existing data

**Solution:**
```bash
# Manually clean test database
mongosh mongodb://localhost:27017/super-app-test --eval "db.dropDatabase()"

# Or in code (afterEach hook):
await mongoose.connection.dropDatabase();
```

### Debug Mode

To see detailed logs during tests:

```bash
# Enable verbose Jest output
npx jest tests/integration/ --verbose --runInBand

# Enable MongoDB query logging
export DEBUG=mongoose:*
npm run test:integration

# Enable console logs in tests
# Comment out console mock in tests/setup.js
```

---

## 📚 Additional Resources

### Test Utilities

- **`testServer.js`**: Spins up Express app in test mode
- **`apiClient.js`**: Supertest wrapper with auto JWT authentication
- **`socketClient.js`**: Socket.io-client helper for event testing
- **`cleanupDB.js`**: Database cleanup and reset utilities
- **`seedUsers.js`**: Generate test users (buyer, creator, admin)
- **`seedContent.js`**: Generate premium content fixtures
- **`seedCreatorRevenue.js`**: Generate revenue data fixtures

### Custom Jest Matchers

Defined in `tests/setup.js`:

```javascript
// Check if number is within range
expect(revenue).toBeWithinRange(90, 110);

// Global utilities
const key = generateIdempotencyKey();
await sleep(1000);  // Wait 1 second
const mockIo = mockSocketIo();
```

### Postman Collection

Import `postman/Phase5_Monetization_PostmanCollection.json` into Postman for manual API testing.

**Pre-configured requests:**
- Authentication (login, register)
- Premium content (create, publish, browse, unlock)
- Subscriptions (subscribe, cancel, renew)
- Gifts (send, leaderboard, history)
- Revenue (summary, history, payout)
- Admin (settle, approve/reject payouts)

---

## ✅ Test Checklist

Before deploying to production:

- [ ] All integration tests pass (`npm run test:integration`)
- [ ] Coverage meets thresholds (≥75% lines/functions/statements)
- [ ] No open handles or memory leaks (`--detectOpenHandles`)
- [ ] CI/CD pipeline passes (GitHub Actions)
- [ ] Security scan passes (npm audit, Trivy)
- [ ] Socket.io events tested with real client
- [ ] Load testing completed (Artillery/k6)
- [ ] Staging environment tested with real data
- [ ] Database indexes created and verified
- [ ] Cron jobs scheduled and tested

---

## 🤝 Contributing

When adding new monetization features:

1. **Create test file** in `tests/integration/`
2. **Add fixtures** if needed in `tests/fixtures/`
3. **Update this README** with new test cases
4. **Run full test suite** before committing
5. **Ensure coverage** meets thresholds

---

## 📝 License

This testing suite is part of the Super App project. See root LICENSE file.

---

## 📞 Support

- **Issues**: Open GitHub issue with `[Test]` prefix
- **Questions**: Contact backend team
- **CI/CD**: Check GitHub Actions logs

---

**Built with ❤️ for Phase 5 Monetization Testing**
