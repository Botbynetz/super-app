#!/bin/bash

# Integration Test Runner Script
# Runs all integration tests for Phase 5 Monetization System

set -e # Exit on error

echo "========================================="
echo " Phase 5 Integration Test Runner"
echo "========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
export NODE_ENV=test
export MONGODB_URI_TEST=${MONGODB_URI_TEST:-"mongodb://localhost:27017/super-app-test"}
export JWT_SECRET=${JWT_SECRET:-"test-secret-key-123"}
export TEST_PORT=${TEST_PORT:-5001}

echo "📝 Configuration:"
echo "  NODE_ENV: $NODE_ENV"
echo "  MONGODB_URI_TEST: $MONGODB_URI_TEST"
echo "  TEST_PORT: $TEST_PORT"
echo ""

# Check if MongoDB is running
echo "🔍 Checking MongoDB connection..."
if mongosh "$MONGODB_URI_TEST" --eval "db.adminCommand('ping')" > /dev/null 2>&1; then
    echo -e "${GREEN}✅ MongoDB is running${NC}"
else
    echo -e "${RED}❌ MongoDB is not accessible at $MONGODB_URI_TEST${NC}"
    echo "   Please start MongoDB or update MONGODB_URI_TEST environment variable"
    exit 1
fi
echo ""

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
    echo ""
fi

# Clean test database
echo "🧹 Cleaning test database..."
mongosh "$MONGODB_URI_TEST" --eval "db.dropDatabase()" > /dev/null 2>&1
echo -e "${GREEN}✅ Test database cleaned${NC}"
echo ""

# Run tests based on argument
TEST_SUITE=${1:-all}

case $TEST_SUITE in
  unlock)
    echo "🧪 Running Unlock Flow Tests..."
    npm test -- tests/integration/unlock_flow.test.js
    ;;
  
  subscription)
    echo "🧪 Running Subscription Flow Tests..."
    npm test -- tests/integration/subscription_flow.test.js
    ;;
  
  fraud)
    echo "🧪 Running Fraud Detection Tests..."
    npm test -- tests/integration/fraud_flow.test.js
    ;;
  
  socket)
    echo "🧪 Running Socket.IO Event Tests..."
    npm test -- tests/integration/socket_events.test.js
    ;;
  
  revenue)
    echo "🧪 Running Revenue & Payout Tests..."
    npm test -- tests/integration/revenue_settlement.test.js tests/integration/payout_flow.test.js
    ;;
  
  all)
    echo "🧪 Running ALL Integration Tests..."
    npm test -- tests/integration/
    ;;
  
  *)
    echo -e "${RED}❌ Unknown test suite: $TEST_SUITE${NC}"
    echo ""
    echo "Usage: ./integration-test.sh [unlock|subscription|fraud|socket|revenue|all]"
    echo ""
    echo "Examples:"
    echo "  ./integration-test.sh unlock      # Run unlock flow tests only"
    echo "  ./integration-test.sh all         # Run all tests (default)"
    exit 1
    ;;
esac

# Capture exit code
TEST_EXIT_CODE=$?

echo ""
if [ $TEST_EXIT_CODE -eq 0 ]; then
    echo -e "${GREEN}=========================================${NC}"
    echo -e "${GREEN}✅  ALL TESTS PASSED!${NC}"
    echo -e "${GREEN}=========================================${NC}"
else
    echo -e "${RED}=========================================${NC}"
    echo -e "${RED}❌  TESTS FAILED${NC}"
    echo -e "${RED}=========================================${NC}"
    exit 1
fi

# Generate coverage report if requested
if [ "$COVERAGE" = "true" ]; then
    echo ""
    echo "📊 Generating coverage report..."
    npm run test:coverage
fi

echo ""
echo "✨ Integration tests completed successfully!"
