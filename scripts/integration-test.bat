@echo off
REM Integration Test Runner for Windows
REM Phase 5 Monetization System

echo =========================================
echo  Phase 5 Integration Test Runner
echo =========================================
echo.

REM Set environment variables
set NODE_ENV=test
if "%MONGODB_URI_TEST%"=="" set MONGODB_URI_TEST=mongodb://localhost:27017/super-app-test
if "%JWT_SECRET%"=="" set JWT_SECRET=test-secret-key-123
if "%TEST_PORT%"=="" set TEST_PORT=5001

echo Configuration:
echo   NODE_ENV: %NODE_ENV%
echo   MONGODB_URI_TEST: %MONGODB_URI_TEST%
echo   TEST_PORT: %TEST_PORT%
echo.

REM Check MongoDB connection
echo Checking MongoDB connection...
mongosh "%MONGODB_URI_TEST%" --eval "db.adminCommand('ping')" >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] MongoDB is not accessible at %MONGODB_URI_TEST%
    echo Please start MongoDB or update MONGODB_URI_TEST environment variable
    exit /b 1
)
echo [OK] MongoDB is running
echo.

REM Install dependencies if needed
if not exist "node_modules" (
    echo Installing dependencies...
    call npm install
    echo.
)

REM Clean test database
echo Cleaning test database...
mongosh "%MONGODB_URI_TEST%" --eval "db.dropDatabase()" >nul 2>&1
echo [OK] Test database cleaned
echo.

REM Run tests based on argument
set TEST_SUITE=%1
if "%TEST_SUITE%"=="" set TEST_SUITE=all

if "%TEST_SUITE%"=="unlock" (
    echo Running Unlock Flow Tests...
    call npm test -- tests/integration/unlock_flow.test.js
    goto :end
)

if "%TEST_SUITE%"=="subscription" (
    echo Running Subscription Flow Tests...
    call npm test -- tests/integration/subscription_flow.test.js
    goto :end
)

if "%TEST_SUITE%"=="fraud" (
    echo Running Fraud Detection Tests...
    call npm test -- tests/integration/fraud_flow.test.js
    goto :end
)

if "%TEST_SUITE%"=="socket" (
    echo Running Socket.IO Event Tests...
    call npm test -- tests/integration/socket_events.test.js
    goto :end
)

if "%TEST_SUITE%"=="revenue" (
    echo Running Revenue ^& Payout Tests...
    call npm test -- tests/integration/revenue_settlement.test.js tests/integration/payout_flow.test.js
    goto :end
)

if "%TEST_SUITE%"=="all" (
    echo Running ALL Integration Tests...
    call npm test -- tests/integration/
    goto :end
)

echo [ERROR] Unknown test suite: %TEST_SUITE%
echo.
echo Usage: integration-test.bat [unlock^|subscription^|fraud^|socket^|revenue^|all]
echo.
echo Examples:
echo   integration-test.bat unlock      - Run unlock flow tests only
echo   integration-test.bat all         - Run all tests (default)
exit /b 1

:end
set TEST_EXIT_CODE=%errorlevel%

echo.
if %TEST_EXIT_CODE% equ 0 (
    echo =========================================
    echo   ALL TESTS PASSED!
    echo =========================================
) else (
    echo =========================================
    echo   TESTS FAILED
    echo =========================================
    exit /b 1
)

REM Generate coverage report if requested
if "%COVERAGE%"=="true" (
    echo.
    echo Generating coverage report...
    call npm run test:coverage
)

echo.
echo Integration tests completed successfully!
