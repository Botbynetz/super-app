# Phase 4.1 - Wallet Core Installation Guide

## ✅ Phase 4.1 Complete!

Database models, service layer, API routes, and Socket.io integration are implemented.

## 🚀 Quick Start

### 1. Install Dependencies

```bash
cd backend
npm install
```

New dependencies installed:
- `express-validator` - Input validation
- `express-rate-limit` - Rate limiting
- `uuid` - Transaction ID generation
- `winston` - Logging (prepared for future use)

### 2. Configure MongoDB Replica Set

⚠️ **IMPORTANT**: Wallet system requires MongoDB replica set for transaction support.

**Option A: MongoDB Atlas (Recommended for testing)**
1. Create free cluster at https://cloud.mongodb.com
2. Replica set is enabled by default
3. Update `.env` with connection string:
```
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/superapp?retryWrites=true&w=majority
```

**Option B: Local MongoDB Replica Set**
```bash
# Stop MongoDB if running
net stop MongoDB

# Start as replica set
mongod --replSet rs0 --port 27017 --dbpath C:\data\db

# In another terminal, initialize replica set
mongosh
> rs.initiate()
```

### 3. Update .env File

Make sure `.env` has:
```
MONGODB_URI=mongodb://localhost:27017/superapp?replicaSet=rs0
JWT_SECRET=your_secret_key_here
PORT=5000
```

### 4. Start Server

```bash
npm start
```

Or with auto-reload:
```bash
npm run dev
```

## 📡 API Endpoints

### Public Endpoints

#### 1. Get Balance
```
GET /api/wallet/balance
Headers: Authorization: Bearer <token>

Response:
{
  "success": true,
  "data": {
    "balance_cents": 1000000,
    "balance_rupiah": 10000,
    "balance_coins": 100,
    "currency": "IDR",
    "status": "active"
  }
}
```

#### 2. Initialize Deposit
```
POST /api/wallet/deposit/init
Headers: Authorization: Bearer <token>
Body: {
  "amount": 100000,
  "provider": "midtrans"
}

Response:
{
  "success": true,
  "data": {
    "depositId": "tx_...",
    "amount_cents": 100000,
    "status": "pending"
  }
}
```

#### 3. Transfer Coins
```
POST /api/wallet/transfer
Headers: Authorization: Bearer <token>
Body: {
  "toUserId": "user123",
  "amount": 50000,
  "idempotencyKey": "transfer_unique_123",
  "note": "Gift for you"
}

Response:
{
  "success": true,
  "data": {
    "senderTransaction": {...},
    "receiverTransaction": {...}
  }
}
```

#### 4. Initialize Withdrawal
```
POST /api/wallet/withdraw/init
Headers: Authorization: Bearer <token>
Body: {
  "amount": 100000,
  "bankDetails": {
    "bankName": "BCA",
    "accountNumber": "1234567890",
    "accountName": "John Doe"
  }
}

Response:
{
  "success": true,
  "data": {
    "withdrawId": "tx_...",
    "amount_cents": 100000,
    "status": "pending"
  }
}
```

#### 5. Get Transaction History
```
GET /api/wallet/history?page=1&limit=20&type=deposit&status=completed
Headers: Authorization: Bearer <token>

Response:
{
  "success": true,
  "data": {
    "transactions": [...],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 50,
      "pages": 3
    }
  }
}
```

### Admin Endpoints

#### 6. Confirm Deposit (Webhook)
```
POST /api/wallet/deposit/confirm
Body: {
  "depositId": "tx_...",
  "providerTxId": "midtrans_123",
  "status": "success",
  "signature": "..."
}

Response:
{
  "success": true,
  "message": "Deposit confirmed"
}
```

#### 7. Confirm Withdrawal
```
POST /api/wallet/withdraw/confirm
Headers: Authorization: Bearer <admin_token>
Body: {
  "withdrawId": "tx_...",
  "status": "completed",
  "providerTxId": "bank_transfer_123"
}
```

#### 8. Freeze Wallet
```
POST /api/wallet/freeze/:userId
Headers: Authorization: Bearer <admin_token>
Body: {
  "reason": "Suspicious activity detected"
}
```

#### 9. Unfreeze Wallet
```
POST /api/wallet/unfreeze/:userId
Headers: Authorization: Bearer <admin_token>
Body: {
  "reason": "Investigation complete"
}
```

#### 10. Get Audit Trail
```
GET /api/wallet/audit/:txId
Headers: Authorization: Bearer <admin_token>

Response:
{
  "success": true,
  "data": [
    {
      "action": "create",
      "timestamp": "...",
      "actor": {...},
      "before": {...},
      "after": {...}
    }
  ]
}
```

## 🔥 Socket.io Events

### Client → Server

```javascript
// Request balance update
socket.emit('REQUEST_BALANCE');

// Response
socket.on('BALANCE_RESPONSE', (data) => {
  console.log('Balance:', data);
});
```

### Server → Client

```javascript
// Coin update notification
socket.on('COIN_UPDATE', (data) => {
  console.log('Balance changed:', data);
  // data = { balance, change, reason, transactionId }
});

// Transaction status update
socket.on('transaction-update', (data) => {
  console.log('Transaction updated:', data);
  // data = { transactionId, status, type }
});

// Fraud alert
socket.on('fraud-alert', (data) => {
  console.log('Security alert:', data);
  // data = { type, reason, timestamp }
});
```

## ⚡ Rate Limits

- **Transfers**: 10 requests per minute per user
- **Withdrawals**: 3 requests per minute per user
- **Deposits**: 5 requests per minute per user

## 🔒 Security Features

✅ **Atomic Operations**: MongoDB transactions ensure consistency
✅ **Idempotency**: Duplicate requests return same result (no double-charge)
✅ **Balance Validation**: Cannot withdraw more than available
✅ **Optimistic Locking**: Prevents race conditions
✅ **Audit Trail**: Complete transaction history
✅ **Rate Limiting**: Prevents abuse
✅ **Input Validation**: All inputs validated
✅ **Wallet Status**: Can freeze suspicious accounts

## 🧪 Testing

### Test with REST Client (VS Code Extension)

Create `test-wallet.rest`:

```http
### 1. Login
POST http://localhost:5000/api/auth/login
Content-Type: application/json

{
  "email": "test@example.com",
  "password": "password123"
}

### Save the token, then use it below
@token = <paste_token_here>

### 2. Get Balance
GET http://localhost:5000/api/wallet/balance
Authorization: Bearer {{token}}

### 3. Initialize Deposit
POST http://localhost:5000/api/wallet/deposit/init
Authorization: Bearer {{token}}
Content-Type: application/json

{
  "amount": 100000,
  "provider": "midtrans"
}

### 4. Simulate Webhook (Deposit Confirmation)
POST http://localhost:5000/api/wallet/deposit/confirm
Content-Type: application/json

{
  "depositId": "tx_...",
  "providerTxId": "test_123",
  "status": "success"
}

### 5. Transfer to Another User
POST http://localhost:5000/api/wallet/transfer
Authorization: Bearer {{token}}
Content-Type: application/json

{
  "toUserId": "<another_user_id>",
  "amount": 50000,
  "idempotencyKey": "test_transfer_1",
  "note": "Test transfer"
}

### 6. Get History
GET http://localhost:5000/api/wallet/history?page=1&limit=10
Authorization: Bearer {{token}}
```

### Test Idempotency

Run the same transfer request twice with same `idempotencyKey` - second request should return `alreadyProcessed: true` without charging again.

### Test Concurrent Transfers

Use a script to send 10 concurrent transfer requests - balance should remain consistent.

## 📊 Database Models

### Wallet
- Stores current balance state
- Uses `version` field for optimistic locking
- Tracks statistics (totalDeposited, totalWithdrawn, etc.)

### WalletTransaction
- Immutable event log
- Stores `providerTxId` for webhook idempotency
- Stores `idempotencyKey` for API idempotency
- Balance snapshots (before/after)

### AuditLog
- Complete compliance trail
- Actor tracking (who did what)
- Before/after snapshots
- Enables transaction reconstruction

## 🎯 Currency System

```
1 coin = 100 rupiah = 10,000 cents
1 rupiah = 100 cents
```

**Why cents?**
- Avoids floating-point precision issues
- Safe for financial calculations
- Enables sub-rupiah micro-transactions

**Conversions**:
```javascript
// Rupiah to cents
const cents = rupiah * 100;

// Cents to rupiah
const rupiah = cents / 100;

// Cents to coins
const coins = cents / 10000;
```

## 🚨 Common Issues

### 1. "Transaction failed: This MongoDB deployment does not support retryable writes"

**Solution**: Enable replica set (see step 2 above)

### 2. "MongoServerError: Transaction numbers are only allowed on a replica set member"

**Solution**: Your MongoDB is not configured as replica set. Use MongoDB Atlas or configure local replica set.

### 3. Rate limit exceeded

**Solution**: Wait 1 minute or adjust rate limits in `routes/wallet.js`

### 4. "Insufficient balance"

**Solution**: Complete a deposit first via `/api/wallet/deposit/init` and `/api/wallet/deposit/confirm`

## ✨ What's Next?

**Phase 4.2 - Payment Gateway Integration**
- Midtrans SDK integration
- Xendit SDK integration
- Coin packages (100 coins = Rp 10,000, etc.)
- Webhook signature verification
- Auto-credit on successful payment

**Phase 4.3 - Premium Content**
- Unlock content with coins
- Creator revenue split (70/25/5)
- Subscription tiers

**Phase 4.4 - Anti-Fraud System**
- Spending limit checks
- Suspicious activity detection
- Device fingerprinting
- Auto-freeze wallet on critical alerts

---

**Need Help?**
- Check API endpoint examples above
- Review `PHASE4_MONETIZATION_PLAN.md` for architecture
- Test with REST Client before frontend integration
- All transactions are logged in `audit_logs` collection
