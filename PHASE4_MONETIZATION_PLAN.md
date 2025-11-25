# Phase 4: Monetization Enhancement - Implementation Plan

**Date:** November 24, 2025  
**Goal:** Full monetization system with wallet, payments, premium content, and anti-fraud

---

## 🎯 Architecture Overview

### Core Components:
1. **Wallet System** (ShopeePay-like) - Internal coin management
2. **Payment Gateway** (Midtrans/Xendit) - Fiat → Coins conversion
3. **Premium Content** - Pay-per-view with creator revenue share
4. **Live Stream Revenue** - Gifts, boosts, commissions
5. **Marketplace Monetization** - Sales commissions, affiliate system
6. **Anti-Fraud System** - Security and fraud prevention

---

## 📊 System Design

### 1. Wallet System Architecture

```
┌─────────────────────────────────────────────────────┐
│                  Wallet Service                     │
├─────────────────────────────────────────────────────┤
│ • Deposit (Payment Gateway → Coins)                 │
│ • Withdraw (Coins → Bank Transfer) [KYC Required]   │
│ • Transfer (User → User)                            │
│ • Balance Check (Real-time)                         │
│ • Transaction History (Paginated)                   │
│ • Audit Trail (All changes logged)                  │
└─────────────────────────────────────────────────────┘
         ↓                    ↓                   ↓
    [MongoDB           [Payment Gateway]    [Socket.io
   Transactions]        Midtrans/Xendit]     Real-time]
```

**KYC Verification Workflow:**
1. User submits ID photo + selfie
2. Admin/AI verifies identity
3. Status: pending → verified → rejected
4. Only verified users can withdraw

**Security Measures:**
- Atomic MongoDB transactions (prevent double-spend)
- Balance checks before every deduction
- Transaction locks during processing
- Audit logs for compliance

---

### 2. Payment Gateway Integration

**Supported Gateways:**
- **Midtrans** (Indonesia) - Credit card, bank transfer, e-wallet
- **Xendit** (SEA region) - Virtual accounts, QRIS, e-wallet

**Coin Packages (Dynamic Pricing):**
```javascript
packages = [
  { coins: 100, price: 10000, bonus: 0 },      // Rp 10k
  { coins: 500, price: 45000, bonus: 50 },     // Rp 45k + 10% bonus
  { coins: 1000, price: 85000, bonus: 150 },   // Rp 85k + 15% bonus
  { coins: 5000, price: 400000, bonus: 1000 }  // Rp 400k + 20% bonus
]
```

**Payment Flow:**
```
User → Select Package → Payment Gateway → Webhook → 
Verify Payment → Add Coins (Atomic) → Notify User (Socket.io)
```

**Webhook Security:**
- Signature verification (HMAC SHA256)
- IP whitelist
- Idempotency keys (prevent duplicate processing)

---

### 3. Premium Content System

**Content Types:**
- Articles/Posts (one-time payment)
- Videos (pay-per-view)
- Photos/Albums (gallery unlock)
- Exclusive streams (subscriber-only)

**Revenue Share Model:**
```
Sale Price: Rp 10,000
├─ Creator: Rp 7,000 (70%)
├─ Platform: Rp 2,500 (25%)
└─ Payment Fee: Rp 500 (5%)
```

**Purchase Flow:**
1. User clicks "Unlock Content"
2. Deduct coins from buyer (atomic)
3. Add coins to creator (70%)
4. Add coins to platform wallet (25%)
5. Log transaction with revenue split
6. Grant access to content

**Refund Policy:**
- Content deleted by creator → Full refund to buyers
- Content removed by admin → Partial refund (no creator commission)
- No refund after 24 hours if content still available

---

### 4. Live Stream Revenue Enhancement

**Revenue Streams:**

**A) Paid Gifts:**
```javascript
gifts = [
  { name: 'Heart', coins: 10, animation: 'heart.json' },
  { name: 'Rose', coins: 50, animation: 'rose.json' },
  { name: 'Diamond', coins: 500, animation: 'diamond.json' },
  { name: 'Rocket', coins: 5000, animation: 'rocket.json' }
]
```

**B) Boost Visibility:**
- Basic Boost: 100 coins → 1 hour featured
- Premium Boost: 500 coins → 24 hours + homepage
- Dynamic pricing based on demand

**C) Commission Structure:**
```
Gift Revenue:
├─ Streamer: 70%
├─ Platform: 25%
└─ Payment Processing: 5%

Boost Revenue:
├─ Platform: 100% (no streamer cut)
```

**Badge Unlock (Gamification):**
- "Rising Star" - 100 gifts received
- "Top Earner" - Earn 10,000 coins
- "Super Booster" - Boost 10 times

---

### 5. Marketplace Monetization

**Commission on Sales:**
```
Product Sale: Rp 100,000
├─ Seller: Rp 85,000 (85%)
├─ Platform Commission: Rp 12,000 (12%)
└─ Payment Processing: Rp 3,000 (3%)
```

**Affiliate System:**
- User shares product link
- Buyer purchases via link
- Affiliate earns 5% commission
- Tracked via unique referral codes

**Business Verification:**
- Basic Seller: 0-100 sales/month, 12% commission
- Verified Business: 100+ sales, 8% commission
- Premium Partner: 1000+ sales, 5% commission
- Verification requires: Business license, tax ID

---

### 6. Anti-Fraud System

**Rule-Based Detection:**

**A) Spending Limits:**
```javascript
limits = {
  unverified: {
    dailySpend: 100000,    // Rp 100k/day
    transactionMax: 50000   // Rp 50k/transaction
  },
  verified: {
    dailySpend: 1000000,   // Rp 1M/day
    transactionMax: 500000  // Rp 500k/transaction
  }
}
```

**B) Device Fingerprinting:**
- Track: User-Agent, IP, Screen resolution, Timezone
- Flag if same device used by multiple accounts
- Block suspicious device patterns

**C) Suspicious Activity Detection:**
```javascript
rules = [
  { pattern: 'rapid_transactions', threshold: 10, window: '1m' },
  { pattern: 'large_gift_to_new_account', minGift: 1000, accountAge: '7d' },
  { pattern: 'multiple_failed_payments', threshold: 5, window: '1h' },
  { pattern: 'unusual_withdraw_pattern', factor: 10 } // 10x normal amount
]
```

**Actions:**
- Level 1: Log + notify admin
- Level 2: Temporarily freeze account
- Level 3: Require additional verification
- Level 4: Permanent ban

---

## 🗄️ Database Schema

### Wallet Model:
```javascript
{
  userId: ObjectId,
  balance: Number,            // Current coin balance
  lockedBalance: Number,      // Coins in pending transactions
  totalDeposited: Number,     // Lifetime deposits
  totalWithdrawn: Number,     // Lifetime withdrawals
  kycStatus: String,          // pending, verified, rejected
  kycData: {
    idType: String,
    idNumber: String,
    idPhoto: String,
    selfiePhoto: String,
    verifiedAt: Date,
    verifiedBy: ObjectId
  },
  withdrawMethod: {
    bankName: String,
    accountNumber: String,
    accountName: String
  }
}
```

### WalletTransaction Model:
```javascript
{
  userId: ObjectId,
  type: String,               // deposit, withdraw, transfer, purchase, gift, commission
  amount: Number,
  balanceBefore: Number,
  balanceAfter: Number,
  status: String,             // pending, completed, failed, cancelled
  metadata: {
    orderId: String,          // Payment gateway order ID
    paymentMethod: String,
    recipientId: ObjectId,    // For transfers
    contentId: ObjectId,      // For purchases
    streamId: ObjectId,       // For gifts
    notes: String
  },
  deviceFingerprint: {
    userAgent: String,
    ip: String,
    screenResolution: String,
    timezone: String
  },
  createdAt: Date,
  completedAt: Date
}
```

### CoinPackage Model (Admin configurable):
```javascript
{
  coins: Number,
  price: Number,              // In rupiah
  bonusCoins: Number,
  currency: String,           // IDR, USD, etc.
  isActive: Boolean,
  displayOrder: Number,
  badge: String,              // "Most Popular", "Best Value"
}
```

### PremiumContent Model:
```javascript
{
  contentId: ObjectId,
  creatorId: ObjectId,
  price: Number,              // In coins
  purchaseCount: Number,
  revenue: {
    total: Number,
    creator: Number,
    platform: Number
  },
  buyers: [{
    userId: ObjectId,
    paidAmount: Number,
    purchasedAt: Date,
    refunded: Boolean
  }]
}
```

### FraudAlert Model:
```javascript
{
  userId: ObjectId,
  alertType: String,          // rapid_transactions, suspicious_device, etc.
  severity: String,           // low, medium, high, critical
  details: Object,
  deviceFingerprint: Object,
  status: String,             // open, investigating, resolved, false_positive
  actionTaken: String,        // warned, frozen, banned, cleared
  reviewedBy: ObjectId,
  reviewedAt: Date
}
```

---

## 🔌 API Endpoints

### Wallet Endpoints:
```
POST   /api/wallet/deposit              - Initiate deposit (create payment)
POST   /api/wallet/withdraw             - Request withdrawal (KYC required)
POST   /api/wallet/transfer             - Transfer coins to another user
GET    /api/wallet/balance              - Get current balance
GET    /api/wallet/transactions         - Get transaction history (paginated)
POST   /api/wallet/kyc/submit           - Submit KYC documents
GET    /api/wallet/kyc/status           - Check KYC verification status
```

### Payment Endpoints:
```
GET    /api/payment/packages            - List coin packages
POST   /api/payment/midtrans/create     - Create Midtrans payment
POST   /api/payment/midtrans/webhook    - Midtrans webhook (signature verified)
POST   /api/payment/xendit/create       - Create Xendit payment
POST   /api/payment/xendit/webhook      - Xendit webhook (signature verified)
```

### Premium Content Endpoints:
```
POST   /api/content/:id/unlock          - Purchase premium content
GET    /api/content/:id/revenue         - Get content revenue stats (creator only)
POST   /api/content/:id/refund          - Process refund (admin only)
GET    /api/creator/earnings            - Get creator earnings summary
```

### Anti-Fraud Endpoints:
```
GET    /api/fraud/alerts                - Get fraud alerts (admin)
POST   /api/fraud/review                - Review and resolve alert (admin)
GET    /api/fraud/stats                 - Fraud detection statistics
POST   /api/fraud/whitelist             - Whitelist user/device (admin)
```

---

## 🔐 Security Considerations

### 1. Transaction Security:
- **Atomic operations** - Use MongoDB transactions
- **Optimistic locking** - Version field to prevent race conditions
- **Balance validation** - Always check balance >= amount before deduction
- **Idempotency** - Use unique transaction IDs to prevent duplicates

### 2. Payment Gateway Security:
- **Webhook signature verification** - Validate HMAC
- **IP whitelist** - Only accept webhooks from known IPs
- **SSL/TLS** - All payment communications encrypted
- **PCI compliance** - Never store card details

### 3. KYC Security:
- **Photo encryption** - Encrypt ID photos at rest
- **Access control** - Only verified admins can view KYC data
- **Audit trail** - Log all KYC status changes
- **Data retention** - Auto-delete rejected KYC after 30 days

### 4. Fraud Prevention:
- **Rate limiting** - Max 10 requests/minute per user
- **CAPTCHA** - For high-value transactions
- **2FA** - Optional for withdrawals
- **Device binding** - Flag if login from new device

---

## 📱 Real-Time Features (Socket.io)

### Events to Emit:
```javascript
// Coin balance update
io.to(`user:${userId}`).emit('coin-balance-update', {
  balance: 1500,
  change: +100,
  reason: 'Gift received'
});

// Transaction status
io.to(`user:${userId}`).emit('transaction-update', {
  transactionId: 'tx123',
  status: 'completed',
  amount: 100
});

// Fraud alert (admin only)
io.to('admin-room').emit('fraud-alert', {
  userId: 'user123',
  alertType: 'rapid_transactions',
  severity: 'high'
});

// Live stream boost
io.to('livestream-lobby').emit('stream-boosted', {
  streamId: 'stream123',
  boostLevel: 'premium',
  expiresAt: Date
});
```

---

## 🎨 Frontend Integration

### Mobile (React Native):
```
screens/
├── WalletScreen.js           - Main wallet UI
├── DepositScreen.js          - Select package + payment
├── WithdrawScreen.js         - Withdraw request form
├── TransferScreen.js         - Send coins to user
├── TransactionHistoryScreen.js
├── KYCVerificationScreen.js
└── PremiumContentScreen.js   - Content unlock UI
```

### Web (React):
```
components/
├── Wallet.js
├── CoinPackages.js
├── PaymentModal.js
├── KYCForm.js
├── CreatorEarnings.js
└── AdminFraudDashboard.js
```

---

## 🧪 Testing Strategy

### 1. Unit Tests:
- Wallet balance calculations
- Revenue split logic
- Fraud detection rules

### 2. Integration Tests:
- Payment webhook processing
- Atomic transaction rollback
- Real-time socket events

### 3. Security Tests:
- SQL injection prevention
- Double-spend attempts
- Webhook signature spoofing

### 4. Load Tests:
- 1000 concurrent transactions
- Payment gateway failover
- Socket.io connection limits

---

## 📈 Metrics to Track

### Business Metrics:
- Daily Active Payers (DAP)
- Average Revenue Per User (ARPU)
- Conversion rate (free → paid)
- Creator earnings distribution

### Technical Metrics:
- Transaction success rate
- Payment gateway latency
- Fraud detection accuracy
- False positive rate

### Fraud Metrics:
- Flagged transactions per day
- Chargeback rate
- Account freeze rate
- Banned users per week

---

## 🚀 Implementation Priority

### Phase 4.1 - Wallet Core (Week 1):
1. Wallet model + basic endpoints
2. Deposit flow (without payment gateway)
3. Transfer between users
4. Transaction history

### Phase 4.2 - Payment Integration (Week 2):
1. Midtrans SDK integration
2. Coin packages + webhook
3. Auto top-up on successful payment
4. Payment failure handling

### Phase 4.3 - Premium Content (Week 3):
1. Content unlock system
2. Revenue split calculation
3. Creator earnings dashboard
4. Refund logic

### Phase 4.4 - Anti-Fraud (Week 4):
1. Device fingerprinting
2. Spending limits
3. Fraud detection rules
4. Admin alert dashboard

### Phase 4.5 - Optimization (Week 5):
1. KYC verification flow
2. Live stream boost enhancement
3. Marketplace commission system
4. Performance optimization

---

## ⚠️ Risk Mitigation

### Risk: Payment fraud
**Mitigation:** Multi-layer fraud detection, manual review for high-value

### Risk: Double-spend bugs
**Mitigation:** Atomic transactions, comprehensive testing, balance validation

### Risk: Chargebacks
**Mitigation:** Clear ToS, transaction logs, email confirmations

### Risk: KYC data breach
**Mitigation:** Encryption at rest, access control, audit logs

### Risk: Payment gateway downtime
**Mitigation:** Multiple gateway support, fallback queue system

---

## 📝 Next Steps

**Ready to implement?** Start with:
1. Create Wallet + WalletTransaction models
2. Implement basic deposit/transfer/withdraw endpoints
3. Add atomic transaction support
4. Test with mock payment data

**Mau mulai dari mana bro?** 🚀
