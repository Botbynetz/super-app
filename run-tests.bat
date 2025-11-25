@echo off
echo ============================================================
echo Phase 3 Testing - Super App (Standalone Logic Tests)
echo ============================================================
echo.

echo [1/3] Checking Node.js installation...
node --version > nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js is not installed!
    echo Please install Node.js from: https://nodejs.org
    pause
    exit /b 1
)
echo [OK] Node.js is installed
echo.

echo [2/3] Navigating to backend folder...
cd backend
echo [OK] In backend directory
echo.

echo [3/3] Running standalone logic tests...
echo (Testing AI algorithms without database)
echo.
node test-logic.js
set TEST_EXIT_CODE=%ERRORLEVEL%

echo.
echo ============================================================
echo Testing Complete!
echo ============================================================
echo.

if %TEST_EXIT_CODE% EQU 0 (
    echo Result: ALL LOGIC TESTS PASSED
    echo.
    echo Phase 3 AI Features are working correctly!
) else (
    echo Result: SOME TESTS FAILED
    echo.
    echo Please check the error messages above
)
echo.
pause
