#!/bin/bash

echo "============================================================"
echo "Phase 3 Testing - Super App"
echo "============================================================"
echo ""

# Check MongoDB
echo "[1/4] Checking MongoDB connection..."
if ! mongosh --eval "db.version()" --quiet > /dev/null 2>&1; then
    echo "[ERROR] MongoDB is not running!"
    echo "Please start MongoDB first with: mongod"
    exit 1
fi
echo "[OK] MongoDB is running"
echo ""

# Install dependencies
echo "[2/4] Installing backend dependencies..."
cd backend
npm install --silent
if [ $? -ne 0 ]; then
    echo "[ERROR] npm install failed!"
    exit 1
fi
echo "[OK] Dependencies installed"
echo ""

# Start server
echo "[3/4] Starting backend server..."
npm start > server.log 2>&1 &
SERVER_PID=$!
echo "Server PID: $SERVER_PID"
echo "Waiting for server to start (10 seconds)..."
sleep 10
echo "[OK] Server should be running"
echo ""

# Run tests
echo "[4/4] Running automated tests..."
node test-phase3.js
TEST_EXIT_CODE=$?

# Cleanup
echo ""
echo "Stopping server..."
kill $SERVER_PID 2>/dev/null

echo ""
echo "============================================================"
echo "Testing Complete!"
echo "============================================================"
echo ""

if [ $TEST_EXIT_CODE -eq 0 ]; then
    echo "Result: ✅ ALL TESTS PASSED"
else
    echo "Result: ❌ SOME TESTS FAILED"
fi
echo ""
echo "Check server.log for backend logs"
