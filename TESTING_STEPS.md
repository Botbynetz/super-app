# Phase 3 Testing - Manual Steps

## Prerequisites Check
- [ ] MongoDB installed and running
- [ ] Node.js installed
- [ ] Backend dependencies installed

## Step-by-Step Testing Guide

### Step 1: Start MongoDB (if not running)
```bash
# Open a new terminal
mongod

# Or if installed as service (Windows):
net start MongoDB
```

### Step 2: Install Backend Dependencies
```bash
cd backend
npm install
```

**Expected packages:**
- express, mongoose, socket.io, jsonwebtoken, bcryptjs, dotenv, cors, multer, twilio, axios

### Step 3: Start Backend Server
```bash
# In backend folder
npm start

# Should see:
# MongoDB connected
# Server running on port 5000
```

### Step 4: Run Automated Tests
```bash
# Open NEW terminal (keep server running)
cd backend
node test-phase3.js
```

**Expected output:**
```
🧪 Starting Phase 3 Automated Tests
============================================================

📝 Step 1: Authentication
✓ Send OTP
✓ Verify OTP (auto-login)
  → Token: eyJhbG...
  → User ID: 674350...

📦 Step 2: Seed Initial Data
✓ Seed Product Templates
  → 5 templates created
✓ Seed CV Templates
  → 2 templates created
✓ Seed Badges

💰 Step 3: Test Financial Assistant
✓ Create test transaction (add XP)
✓ Generate Financial Report
  → 4 recommendations
✓ Get Financial Report
✓ Set Financial Targets

🛍️ Step 4: Test Product Description Generator
✓ Generate Electronics Product
  → Description: Smart Watch Pro X - Smartwatch...
✓ Generate Fashion Product
✓ Verify synonym variations
✓ Get all product descriptions
  → 2 descriptions found

🤖 Step 5: Test Chatbot Generator
✓ Create chatbot with flows
  → Chatbot ID: 674350...
✓ Test chatbot - Contains match
✓ Test chatbot - Regex match
✓ Test chatbot - StartsWith match
✓ Test chatbot - Default response
✓ Get chatbot stats
  → 4 interactions tracked

📄 Step 6: Test CV Generator & Freelancer Scoring
✓ Award badges for scoring
✓ Generate CV
  → HTML length: 2500 chars
✓ Calculate freelancer score
  → Total score: 135.25
✓ Get freelancer rankings
  → 1 users in rankings

🎯 Step 7: Test Smart Recommendations
✓ Update user preferences
✓ Create test event
✓ Get event recommendations
  → 1 events recommended
  → Top score: 85
✓ Get user recommendations
  → 0 users recommended
✓ Track interaction

============================================================

📊 Test Results Summary

Total Tests: 42
✓ Passed: 42
✗ Failed: 0
Success Rate: 100.0%

============================================================
```

## Alternative: Manual Testing with REST Client

If automated test fails, use `test-phase3.rest` file:

1. Install VSCode extension: **REST Client** by Huachao Mao
2. Open `test-phase3.rest`
3. Start backend: `cd backend && npm start`
4. Update `@token` variable after authentication
5. Click "Send Request" above each test

## Troubleshooting

### Issue: MongoDB not connected
**Solution:** Start MongoDB with `mongod` or `net start MongoDB`

### Issue: Port 5000 already in use
**Solution:** Change PORT in `.env` file or kill process:
```bash
# Windows
netstat -ano | findstr :5000
taskkill /PID <PID> /F

# Linux/Mac
lsof -ti:5000 | xargs kill -9
```

### Issue: Module not found
**Solution:** 
```bash
cd backend
rm -rf node_modules package-lock.json
npm install
```

### Issue: Test timeout
**Solution:** Increase timeout in test-phase3.js (line 25):
```javascript
timeout: 30000  // Change from 10000 to 30000
```

## Next Steps After Testing

1. ✅ All tests pass → Ready for production
2. ❌ Some tests fail → Check error messages and fix issues
3. Document any issues found
4. Test mobile/web UI integration
5. Performance optimization if needed

---

**Date:** November 24, 2025
**Version:** Phase 3.0.0
