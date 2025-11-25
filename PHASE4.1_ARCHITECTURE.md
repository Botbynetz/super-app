# Phase 4.1 Wallet Core Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                          CLIENT APPLICATIONS                         │
├──────────────────────┬──────────────────────┬──────────────────────┤
│    Web Frontend      │   Mobile App (RN)    │   Admin Dashboard    │
│   (React + Axios)    │  (React Native)      │     (React)          │
└──────────┬───────────┴──────────┬───────────┴──────────┬───────────┘
           │                      │                      │
           │  REST API + JWT      │  Socket.io Events   │
           ▼                      ▼                      ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         EXPRESS.JS SERVER                            │
├─────────────────────────────────────────────────────────────────────┤
│  Middleware:                                                          │
│  • CORS                                                              │
│  • express-validator (input validation)                             │
│  • express-rate-limit (10/min transfers, 3/min withdrawals)         │
│  • authenticateToken (JWT verification)                              │
└─────────┬──────────────────────────────────────────┬────────────────┘
          │                                          │
          ▼                                          ▼
┌─────────────────────────────┐        ┌──────────────────────────────┐
│     /api/wallet Routes      │        │   Socket.io Event Handlers   │
├─────────────────────────────┤        ├──────────────────────────────┤
│ GET    /balance             │        │ REQUEST_BALANCE              │
│ GET    /balance/:userId     │        │   → BALANCE_RESPONSE         │
│ POST   /deposit/init        │        │                              │
│ POST   /deposit/confirm     │        │ Server Emits:                │
│ POST   /transfer            │        │ • COIN_UPDATE                │
│ POST   /withdraw/init       │        │ • transaction-update         │
│ POST   /withdraw/confirm    │        │ • fraud-alert                │
│ GET    /history             │        │                              │
│ GET    /history/:userId     │        └──────────────────────────────┘
│ GET    /audit/:txId         │
│ POST   /freeze/:userId      │
│ POST   /unfreeze/:userId    │
└─────────┬───────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       WALLET SERVICE LAYER                           │
├─────────────────────────────────────────────────────────────────────┤
│  Business Logic:                                                     │
│  • getOrCreateWallet(userId)                                         │
│  • getBalance(userId)                                                │
│  • initDeposit(userId, amount, meta)                                 │
│  • confirmDeposit(depositId, providerTxId, status) [IDEMPOTENT]     │
│  • transfer(fromUserId, toUserId, amount, key) [ATOMIC + IDEMPOTENT]│
│  • initWithdraw(userId, amount, bankDetails)                         │
│  • confirmWithdraw(withdrawId, providerTxId, status)                 │
│  • getHistory(userId, options)                                       │
│  • getAuditTrail(txId)                                               │
│  • freezeWallet(userId, reason, adminId)                             │
│  • unfreezeWallet(userId, reason, adminId)                           │
└─────────┬───────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       MONGODB MODELS                                 │
├──────────────────┬──────────────────────┬───────────────────────────┤
│  Wallet Model    │  Transaction Model   │   AuditLog Model          │
├──────────────────┼──────────────────────┼───────────────────────────┤
│ • userId (unique)│ • txId (UUID)        │ • txId                    │
│ • balance_cents  │ • userId             │ • action                  │
│ • currency       │ • type (8 types)     │ • entity                  │
│ • status         │ • amount_cents       │ • entityId                │
│ • version        │ • status (6 states)  │ • actor (id, role, ip)    │
│ • statistics     │ • balanceBefore_cents│ • before/after snapshots  │
│                  │ • balanceAfter_cents │ • reason                  │
│ • Methods:       │ • providerTxId       │ • timestamp               │
│   - canDeduct()  │ • idempotencyKey     │                           │
│   - freeze()     │ • relatedUserId      │ • Methods:                │
│   - unfreeze()   │ • relatedTxId        │   - createLog()           │
│   - updateAtomic │ • bankDetails        │   - getTransactionTrail() │
│                  │ • meta               │   - getEntityHistory()    │
│ Indexes:         │                      │   - getUserActivity()     │
│ • userId (unique)│ • Methods:           │                           │
│ • status         │   - markCompleted()  │ Indexes:                  │
│ • updatedAt      │   - markFailed()     │ • txId + timestamp        │
│                  │   - getUserHistory() │ • entityId + timestamp    │
│                  │                      │ • actor.id + timestamp    │
│                  │ Indexes:             │ • action + timestamp      │
│                  │ • userId + createdAt │                           │
│                  │ • userId + type      │                           │
│                  │ • providerTxId       │                           │
│                  │ • idempotencyKey     │                           │
└──────────────────┴──────────────────────┴───────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────────┐
│              MONGODB DATABASE (WITH REPLICA SET)                     │
├─────────────────────────────────────────────────────────────────────┤
│  Collections:                                                        │
│  • wallets          (current balance state)                          │
│  • wallet_transactions (immutable event log)                         │
│  • audit_logs       (compliance trail)                               │
│                                                                      │
│  Features:                                                           │
│  • Transaction Sessions (atomic multi-document updates)              │
│  • Optimistic Locking (version field)                                │
│  • Unique Sparse Indexes (idempotency enforcement)                   │
└─────────────────────────────────────────────────────────────────────┘
```

## Transaction Flows

### 1. Deposit Flow

```
User → POST /deposit/init
  ↓
[Validate amount]
  ↓
Create pending WalletTransaction
  ↓
Create AuditLog (action: create)
  ↓
Return depositId
  ↓
Payment Provider → POST /deposit/confirm (webhook)
  ↓
[Check idempotency: providerTxId exists?]
  ├─ YES → Return existing result (already processed)
  └─ NO  → Continue
      ↓
    [Start MongoDB Session]
      ↓
    Update Wallet balance (atomic: findOneAndUpdate + $inc)
      ↓
    Update Transaction status = completed
      ↓
    Update Wallet statistics (totalDeposited)
      ↓
    Create AuditLog (action: commit)
      ↓
    [Commit Session]
      ↓
    Emit Socket.io COIN_UPDATE event
      ↓
    Return success
```

### 2. Transfer Flow (Most Complex - Atomic)

```
User → POST /transfer { toUserId, amount, idempotencyKey }
  ↓
[Validate: not self, amount > 0, integer]
  ↓
[Check idempotency: idempotencyKey exists?]
  ├─ YES → Return existing result (already processed)
  └─ NO  → Continue
      ↓
    Get both wallets (sender + receiver)
      ↓
    Check sender balance (canDeduct)
      ↓
    [Start MongoDB Session] ←─────────────────┐
      ↓                                       │
    Deduct from sender (atomic: $inc -amount) │  All or Nothing
      ↓                                       │  (ACID Transaction)
    Add to receiver (atomic: $inc +amount)    │
      ↓                                       │
    Create transfer_out transaction           │
      ↓                                       │
    Create transfer_in transaction            │
      ↓                                       │
    Link transactions (relatedTxId)           │
      ↓                                       │
    Update statistics (both wallets)          │
      ↓                                       │
    Create AuditLogs (2x - sender + receiver) │
      ↓                                       │
    [Commit Session] ←────────────────────────┘
      ↓
    Emit Socket.io COIN_UPDATE (both users)
      ↓
    Return success (both transactions)
```

### 3. Withdrawal Flow

```
User → POST /withdraw/init { amount, bankDetails }
  ↓
[Validate: amount >= minimum, bankDetails complete]
  ↓
Check balance (canDeduct)
  ↓
Check wallet status (active?)
  ↓
Create pending withdrawal transaction
  ↓
Create AuditLog (action: create)
  ↓
Return withdrawId
  ↓
Admin → POST /withdraw/confirm (manual approval)
  ↓
[Check idempotency: providerTxId exists?]
  ├─ YES → Return existing result
  └─ NO  → Continue
      ↓
    [Start MongoDB Session]
      ↓
    IF status = success:
      ├─ Deduct wallet balance (atomic)
      ├─ Update transaction status = completed
      ├─ Update statistics (totalWithdrawn)
      └─ Create AuditLog (action: commit)
    ELSE:
      ├─ Update transaction status = failed
      └─ Create AuditLog (action: rollback)
      ↓
    [Commit Session]
      ↓
    Emit Socket.io transaction-update
      ↓
    Return result
```

## Security Mechanisms

### 1. Atomicity (ACID Transactions)

```
MongoDB Session Transaction:
┌─────────────────────────────┐
│  BEGIN TRANSACTION          │
├─────────────────────────────┤
│  1. Update Wallet A         │  ←┐
│  2. Update Wallet B         │   │ All succeed or all fail
│  3. Create Transaction 1    │   │ No partial updates
│  4. Create Transaction 2    │   │
│  5. Create Audit Logs       │  ←┘
├─────────────────────────────┤
│  COMMIT (if all success)    │
│  or                         │
│  ROLLBACK (if any fails)    │
└─────────────────────────────┘
```

### 2. Idempotency (Duplicate Request Prevention)

```
Webhook Idempotency (providerTxId):
  Payment Provider sends webhook
    ↓
  Check: WalletTransaction.findByProviderTxId(providerTxId)
    ├─ Found? → Return existing result (HTTP 200)
    └─ Not found? → Process payment

API Idempotency (idempotencyKey):
  User sends transfer request with idempotencyKey
    ↓
  Check: WalletTransaction.findByIdempotencyKey(key)
    ├─ Found? → Return existing result (HTTP 200)
    └─ Not found? → Process transfer

Both use UNIQUE SPARSE indexes in MongoDB
```

### 3. Optimistic Locking (Race Condition Prevention)

```
Concurrent Transfer Scenario:
  Request A                     Request B
     ↓                             ↓
  Read wallet (version: 5)      Read wallet (version: 5)
     ↓                             ↓
  Calculate new balance         Calculate new balance
     ↓                             ↓
  Update with version: 6        Update with version: 6
     ↓                             ↓
  SUCCESS ✓                     FAIL ✗ (version mismatch)
                                   ↓
                                Retry with version: 6

Query: { userId, version: 5 }
Update: { $inc: { balance_cents: -amount, version: 1 } }
```

### 4. Balance Validation (No Negative Balance)

```
updateBalanceAtomic():
  Query:
    {
      userId: userId,
      status: 'active',
      balance_cents: { $gte: amount }  ← Ensures balance sufficient
    }
  Update:
    {
      $inc: { balance_cents: amount, version: 1 },
      $set: { lastTransactionAt: now }
    }

If balance insufficient → Query finds no document → Update fails
```

## Data Flow Diagram

```
┌─────────────┐
│   Client    │
│ (Web/Mobile)│
└─────┬───────┘
      │ HTTP POST /transfer
      ▼
┌─────────────┐
│ Rate Limiter│ ← 10 req/min
└─────┬───────┘
      │
      ▼
┌─────────────┐
│ Auth Guard  │ ← JWT verification
└─────┬───────┘
      │
      ▼
┌─────────────┐
│  Validator  │ ← express-validator
└─────┬───────┘
      │
      ▼
┌──────────────────────┐
│   Wallet Service     │
│  .transfer()         │
└─────┬────────────────┘
      │
      ├──────────────────────────────┐
      │                              │
      ▼                              ▼
┌──────────────┐            ┌──────────────┐
│ Idempotency  │            │   Balance    │
│    Check     │            │    Check     │
└─────┬────────┘            └─────┬────────┘
      │                           │
      │ Not found                 │ Sufficient
      ▼                           ▼
┌─────────────────────────────────────┐
│     MongoDB Session Transaction     │
│  ┌───────────────────────────────┐  │
│  │ 1. Deduct from Sender         │  │
│  │ 2. Credit to Receiver         │  │
│  │ 3. Create Transactions        │  │
│  │ 4. Update Statistics          │  │
│  │ 5. Create Audit Logs          │  │
│  └───────────────────────────────┘  │
│         All or Nothing              │
└─────┬───────────────────────────────┘
      │
      ├──────────────────────────────┐
      │                              │
      ▼                              ▼
┌──────────────┐            ┌──────────────┐
│   Socket.io  │            │   Database   │
│ COIN_UPDATE  │            │   Persisted  │
└──────────────┘            └──────────────┘
      │
      ▼
┌──────────────┐
│   Client     │
│  UI Updates  │
└──────────────┘
```

## Currency Conversion Logic

```
Database Storage (cents - Integer):
  10,000 cents

Virtual Fields (computed on read):
  ├─ balance_rupiah = balance_cents / 100 = 100 Rp
  └─ balance_coins = balance_cents / 10,000 = 1 coin

Conversion Table:
  ┌─────────┬──────────┬─────────┐
  │  Cents  │  Rupiah  │  Coins  │
  ├─────────┼──────────┼─────────┤
  │     100 │  1 Rp    │  0.01   │
  │  10,000 │  100 Rp  │  1      │
  │ 100,000 │  1,000   │  10     │
  │ 1,000,000│ 10,000  │  100    │
  └─────────┴──────────┴─────────┘

Why Cents?
  • Integer arithmetic (no floating-point errors)
  • Precise financial calculations
  • Sub-rupiah micro-transactions possible
  • Industry standard (Stripe, PayPal use cents)
```

## Error Handling Flow

```
API Request
    ↓
┌───────────────────┐
│ Input Validation  │
└────┬──────────────┘
     │ Invalid?
     ├─ YES → 400 Bad Request (validation errors array)
     └─ NO → Continue
         ↓
    ┌───────────────────┐
    │ Authentication    │
    └────┬──────────────┘
         │ Invalid token?
         ├─ YES → 401 Unauthorized
         └─ NO → Continue
             ↓
        ┌───────────────────┐
        │ Authorization     │
        └────┬──────────────┘
             │ Forbidden?
             ├─ YES → 403 Forbidden
             └─ NO → Continue
                 ↓
            ┌───────────────────┐
            │ Business Logic    │
            └────┬──────────────┘
                 │ Error?
                 ├─ Insufficient balance → 400 Bad Request
                 ├─ Wallet frozen → 400 Bad Request
                 ├─ User not found → 404 Not Found
                 └─ Database error → 500 Internal Server Error
                     ↓
                 ┌───────────────────┐
                 │ Transaction       │
                 │ Rollback          │
                 └───────────────────┘
                     ↓
                 ┌───────────────────┐
                 │ Audit Log         │
                 │ (action: rollback)│
                 └───────────────────┘
                     ↓
                 Return error response
```

## Performance Optimizations

### 1. Database Indexes

```
wallets collection:
  • { userId: 1 } - unique, for balance lookups
  • { status: 1 } - for filtering active wallets
  • { updatedAt: 1 } - for recent activity queries

wallet_transactions collection:
  • { userId: 1, createdAt: -1 } - for user history (DESC)
  • { userId: 1, type: 1, status: 1 } - for filtered history
  • { providerTxId: 1 } - unique sparse, webhook idempotency
  • { idempotencyKey: 1 } - unique sparse, API idempotency

audit_logs collection:
  • { txId: 1, timestamp: 1 } - for transaction trail
  • { entityId: 1, timestamp: -1 } - for entity history
  • { "actor.id": 1, timestamp: -1 } - for user activity
  • { action: 1, timestamp: -1 } - for action type queries
```

### 2. Connection Pooling

```
mongoose.connect(uri, {
  maxPoolSize: 10,  // Max 10 connections
  minPoolSize: 2,   // Min 2 connections always ready
  serverSelectionTimeoutMS: 5000
});
```

### 3. Pagination

```
GET /api/wallet/history?page=1&limit=20

Result:
{
  transactions: [...],
  pagination: {
    page: 1,
    limit: 20,
    total: 150,
    pages: 8
  }
}

Skip: (page - 1) * limit
Limit: limit
```

---

**Phase 4.1 Architecture Complete!**
Ready for Phase 4.2: Payment Gateway Integration
