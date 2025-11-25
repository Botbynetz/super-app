@echo off
echo ========================================
echo  Phase 4.1 Wallet Core - Quick Setup
echo ========================================
echo.

cd backend

echo [1/3] Installing dependencies...
call npm install
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: npm install failed
    pause
    exit /b 1
)
echo.

echo [2/3] Checking .env file...
if not exist ".env" (
    echo WARNING: .env file not found!
    echo.
    echo Creating .env from template...
    echo MONGODB_URI=mongodb://localhost:27017/superapp?replicaSet=rs0 > .env
    echo JWT_SECRET=your_jwt_secret_here_change_me >> .env
    echo PORT=5000 >> .env
    echo TWILIO_ACCOUNT_SID=your_twilio_sid >> .env
    echo TWILIO_AUTH_TOKEN=your_twilio_token >> .env
    echo TWILIO_PHONE_NUMBER=your_twilio_phone >> .env
    echo.
    echo .env created! Please update with your credentials.
    echo.
)
echo.

echo [3/3] Checking MongoDB...
echo.
echo IMPORTANT: Wallet system requires MongoDB REPLICA SET!
echo.
echo Option 1: MongoDB Atlas (Recommended)
echo   - Free tier: https://cloud.mongodb.com
echo   - Replica set enabled by default
echo   - Update .env with connection string
echo.
echo Option 2: Local Replica Set
echo   1. Stop MongoDB if running: net stop MongoDB
echo   2. Start as replica set: mongod --replSet rs0 --port 27017 --dbpath C:\data\db
echo   3. In another terminal: mongosh
echo   4. Initialize: rs.initiate()
echo.

echo ========================================
echo  Setup Complete!
echo ========================================
echo.
echo Next Steps:
echo   1. Update .env with your credentials (if needed)
echo   2. Configure MongoDB replica set (see above)
echo   3. Run: npm run dev
echo   4. Test with test-wallet.rest (VS Code REST Client)
echo.
echo Documentation:
echo   - PHASE4_WALLET_SETUP.md (complete guide)
echo   - PHASE4.1_COMPLETE.md (feature summary)
echo   - PHASE4.1_ARCHITECTURE.md (architecture diagrams)
echo   - test-wallet.rest (50+ test cases)
echo.
echo Ready to start? Run: npm run dev
echo.
pause
