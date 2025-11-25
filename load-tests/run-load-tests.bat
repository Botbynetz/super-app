@echo off
REM ===================================
REM Artillery Load Test Runner (Windows)
REM ===================================

echo Starting Artillery Load Tests...

REM Check if Artillery is installed
where artillery >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo Artillery not found. Installing...
    npm install -g artillery
)

REM Set environment
if not defined JWT_SECRET (
    set JWT_SECRET=test_jwt_secret
)

REM Create reports directory
if not exist ".\load-tests\reports" mkdir ".\load-tests\reports"

REM Run test based on argument
if "%1"=="quick" (
    echo Running quick smoke test...
    artillery quick --duration 30 --rate 10 https://superapp-backend-staging.onrender.com/api/health
    goto :end
)

if "%1"=="full" (
    echo Running full load test...
    set REPORT_FILE=.\load-tests\reports\full-load-test-%date:~-4,4%%date:~-10,2%%date:~-7,2%-%time:~0,2%%time:~3,2%%time:~6,2%.json
    artillery run .\load-tests\artillery-config.yml --output %REPORT_FILE%
    artillery report %REPORT_FILE% --output %REPORT_FILE:.json=.html%
    goto :end
)

if "%1"=="stress" (
    echo Running stress test...
    artillery run .\load-tests\artillery-config.yml --overrides "{\"config\":{\"phases\":[{\"duration\":300,\"arrivalRate\":100}]}}"
    goto :end
)

echo Usage: run-load-tests.bat [quick^|full^|stress]
echo.
echo   quick  - 30 second smoke test
echo   full   - Full load test suite
echo   stress - High-load stress test

:end
echo.
echo Load tests complete!
pause
