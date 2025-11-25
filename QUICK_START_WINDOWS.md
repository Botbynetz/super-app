# 🚀 Quick Start Guide - Integration Testing (Windows)

## Prerequisites Checklist

- ✅ Node.js 18.x or 20.x installed
- ✅ MongoDB 6.0+ installed and running
- ✅ Git Bash or PowerShell (for script execution)

## 1️⃣ Setup MongoDB Replica Set (Required!)

MongoDB transactions require a replica set. Choose one option:

### Option A: Docker (Recommended)

```powershell
# Start MongoDB with replica set
docker run -d --name mongodb-test -p 27017:27017 mongo:7.0 --replSet rs0

# Initialize replica set
docker exec mongodb-test mongosh --eval "rs.initiate()"

# Verify
docker exec mongodb-test mongosh --eval "rs.status()"
```

### Option B: Local MongoDB Installation

```powershell
# Start MongoDB with replica set (run as Administrator)
mongod --replSet rs0 --bind_ip localhost --port 27017 --dbpath C:\data\db

# In another terminal, initialize
mongosh --eval "rs.initiate()"
```

## 2️⃣ Install Dependencies

```powershell
cd backend
npm install
```

Expected output:
```
✅ Added 150+ packages
✅ jest, supertest, socket.io-client installed
```

## 3️⃣ Run Tests

### Option A: Using Batch Script (Easy!)

```cmd
# Run all tests
scripts\integration-test.bat all

# Run specific suite
scripts\integration-test.bat unlock
scripts\integration-test.bat subscription
scripts\integration-test.bat fraud
scripts\integration-test.bat socket
scripts\integration-test.bat revenue
```

### Option B: Using npm Scripts

```powershell
# Run all integration tests
npm run test:integration

# Run specific test file
npm run test:unlock
npm run test:subscription
npm run test:fraud
npm run test:socket
npm run test:revenue

# Watch mode (auto-rerun on file changes)
npm run test:integration:watch

# With coverage report
npm run test:integration:coverage
```

### Option C: Using Jest Directly

```powershell
# Run all tests
npx jest tests/integration/

# Run specific file
npx jest tests/integration/unlock_flow.test.js

# Verbose mode
npx jest tests/integration/ --verbose

# Debug mode
node --inspect-brk node_modules/.bin/jest tests/integration/unlock_flow.test.js
```

## 4️⃣ Expected Output

```
✅ Unlock Flow Tests (18 passed)
✅ Subscription Flow Tests (16 passed)
✅ Fraud Detection Tests (14 passed)
✅ Socket.IO Events Tests (12 passed)
✅ Revenue & Payout Tests (12 passed)

Total: 72 passed, 0 failed
Duration: 2m 45s
Coverage: 87.3%
```

## 🐛 Troubleshooting

### Issue 1: MongoDB Connection Failed

**Error**: `MongoServerError: Connection refused`

**Solution**:
```powershell
# Check if MongoDB is running
tasklist /FI "IMAGENAME eq mongod.exe"

# Start MongoDB
net start MongoDB

# Or start Docker container
docker start mongodb-test
```

### Issue 2: Replica Set Not Initialized

**Error**: `Transaction numbers are only allowed on a replica set member`

**Solution**:
```powershell
# Initialize replica set
mongosh --eval "rs.initiate()"

# Verify status
mongosh --eval "rs.status()"
```

### Issue 3: Port Already in Use

**Error**: `EADDRINUSE: address already in use :::5001`

**Solution**:
```powershell
# Find process using port 5001
netstat -ano | findstr :5001

# Kill process (replace PID)
taskkill /PID <PID> /F

# Or change TEST_PORT
set TEST_PORT=5002
npm run test:integration
```

### Issue 4: Jest Not Found

**Error**: `'jest' is not recognized as an internal or external command`

**Solution**:
```powershell
# Install Jest globally
npm install -g jest

# Or use npx
npx jest tests/integration/
```

### Issue 5: Tests Timeout

**Error**: `Timeout - Async callback was not invoked within the 5000 ms timeout`

**Solution**:
```powershell
# Increase timeout in jest.config.js
# Already set to 10000ms (10 seconds)

# Or set environment variable
set JEST_TIMEOUT=30000
npm run test:integration
```

## 📊 View Coverage Report

```powershell
# Generate coverage
npm run test:integration:coverage

# Open HTML report in browser
start coverage/lcov-report/index.html
```

## 🧹 Clean Test Database

```powershell
# Drop test database
mongosh mongodb://localhost:27017/super-app-test --eval "db.dropDatabase()"
```

## 🔄 Reset Everything

```powershell
# Stop MongoDB
docker stop mongodb-test
docker rm mongodb-test

# Clean dependencies
rmdir /s /q node_modules
del package-lock.json

# Fresh install
npm install

# Restart MongoDB
docker run -d --name mongodb-test -p 27017:27017 mongo:7.0 --replSet rs0
docker exec mongodb-test mongosh --eval "rs.initiate()"

# Run tests
npm run test:integration
```

## 📝 Environment Variables

Create `.env.test` file in `backend/`:

```env
NODE_ENV=test
MONGODB_URI_TEST=mongodb://localhost:27017/super-app-test
JWT_SECRET=test-secret-key-123
TEST_PORT=5001
SOCKET_URL=http://localhost:5001
```

## 🎯 Next Steps

1. ✅ All tests passing? → Commit your code
2. ✅ Push to GitHub → CI/CD will run automatically
3. ✅ Review coverage report → Aim for 85%+
4. ✅ Import Postman collection → Manual API testing

## 🆘 Need Help?

- 📖 Read: `backend/tests/INTEGRATION_TESTING_README.md`
- 🐛 Report: Create GitHub issue
- 💬 Chat: #super-app-dev channel

---

**Ready to test?** Run: `npm run test:integration` 🚀
