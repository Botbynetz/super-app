#!/bin/bash

# ===================================
# Artillery Load Test Runner
# Run different load test scenarios
# ===================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Starting Artillery Load Tests${NC}\n"

# Check if Artillery is installed
if ! command -v artillery &> /dev/null; then
    echo -e "${YELLOW}Artillery not found. Installing...${NC}"
    npm install -g artillery
fi

# Set environment
export JWT_SECRET=${JWT_SECRET:-"test_jwt_secret"}

# Create reports directory
mkdir -p ./load-tests/reports

# Function to run test
run_test() {
    local test_name=$1
    local report_file="./load-tests/reports/${test_name}-$(date +%Y%m%d-%H%M%S).json"
    
    echo -e "${YELLOW}Running: ${test_name}${NC}"
    
    artillery run \
        ./load-tests/artillery-config.yml \
        --output "$report_file"
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ ${test_name} completed${NC}\n"
        
        # Generate HTML report
        artillery report "$report_file" --output "${report_file%.json}.html"
        echo -e "${GREEN}📊 Report saved: ${report_file%.json}.html${NC}\n"
    else
        echo -e "${RED}❌ ${test_name} failed${NC}\n"
    fi
}

# Run tests
case "${1:-all}" in
    "quick")
        echo -e "${YELLOW}Running quick smoke test (30 seconds)${NC}"
        artillery quick --duration 30 --rate 10 \
            https://superapp-backend-staging.onrender.com/api/health
        ;;
    
    "full")
        run_test "full-load-test"
        ;;
    
    "stress")
        echo -e "${YELLOW}Running stress test (high load)${NC}"
        artillery run ./load-tests/artillery-config.yml \
            --overrides '{"config":{"phases":[{"duration":300,"arrivalRate":100}]}}'
        ;;
    
    *)
        echo -e "${GREEN}Usage: ./run-load-tests.sh [quick|full|stress]${NC}"
        echo ""
        echo "  quick  - 30 second smoke test"
        echo "  full   - Full load test suite"
        echo "  stress - High-load stress test"
        ;;
esac

echo -e "\n${GREEN}✅ Load tests complete!${NC}"
