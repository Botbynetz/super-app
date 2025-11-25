# Phase 5: Monetization System - Setup Instructions

## 🚀 Quick Start (5 Minutes)

### Step 1: Verify Dependencies

All required dependencies are already in `package.json`:
- ✅ `multer` - File uploads
- ✅ `express-validator` - Input validation
- ✅ `mongoose` - MongoDB with sessions
- ✅ `uuid` - Idempotency keys

```bash
cd backend
npm install
```

### Step 2: Environment Variables

Ensure `.env` has MongoDB URI with replica set (required for transactions):

```env
# MongoDB (must be replica set for transactions)
MONGODB_URI=mongodb://localhost:27017/superapp?replicaSet=rs0

# Or MongoDB Atlas (automatically uses replica set)
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/superapp

# Test database
MONGODB_TEST_URI=mongodb://localhost:27017/superapp_test
```

### Step 3: Setup MongoDB Replica Set (Local Development)

If using local MongoDB, enable replica set mode:

```bash
# Stop MongoDB
sudo systemctl stop mongod

# Edit mongod.conf
sudo nano /etc/mongod.conf

# Add replication settings:
replication:
  replSetName: "rs0"

# Restart MongoDB
sudo systemctl start mongod

# Initialize replica set
mongosh
> rs.initiate()
```

**For MongoDB Atlas**: Replica sets are enabled by default. ✅

### Step 4: Create Upload Directory

```bash
mkdir -p uploads/premium
chmod 755 uploads/premium
```

### Step 5: Start Server

```bash
npm run dev
```

Server should start on `http://localhost:5000`

---

## 🧪 Testing the System

### Run Jest Tests

```bash
# Run all monetization tests
npm test -- tests/monetization

# Run specific test file
npm test -- tests/monetization/premiumContent.test.js

# Run with coverage
npm test -- tests/monetization --coverage
```

### Manual API Testing with cURL

```bash
# 1. Login to get token
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","password":"password123"}'

# 2. Create premium content
curl -X POST http://localhost:5000/api/premium/create \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "title=Test Content" \
  -F "description=This is a test premium content" \
  -F "category=education" \
  -F "price_coins=100" \
  -F "mediaType=video"

# 3. Browse content
curl http://localhost:5000/api/premium/browse?sort=recent&limit=10
```

---

## ⚙️ Setup Cron Job (Expired Subscriptions)

### Option 1: System Crontab (Production)

```bash
# Edit crontab
crontab -e

# Add entry (runs daily at midnight UTC)
0 0 * * * cd /path/to/super-app && node backend/jobs/processExpiredSubscriptions.js >> /path/to/logs/cron.log 2>&1
```

### Option 2: PM2 Cron (Recommended)

```bash
# Install PM2
npm install -g pm2

# Create PM2 ecosystem file
cat > ecosystem.config.js << EOF
module.exports = {
  apps: [
    {
      name: 'super-app',
      script: 'backend/server.js',
      instances: 1,
      exec_mode: 'cluster'
    },
    {
      name: 'expired-subscriptions-cron',
      script: 'backend/jobs/processExpiredSubscriptions.js',
      cron_restart: '0 0 * * *', // Daily at midnight
      autorestart: false,
      watch: false
    }
  ]
};
EOF

# Start with PM2
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

### Option 3: In-App Scheduler (Development)

Add to `server.js`:

```javascript
const cron = require('node-cron');
const SubscriptionService = require('./services/SubscriptionService');

// Run daily at 00:00
cron.schedule('0 0 * * *', async () => {
  console.log('Running expired subscriptions cron job...');
  try {
    const result = await SubscriptionService.processExpiredSubscriptions();
    console.log(`Processed ${result.processedCount} expired subscriptions`);
  } catch (error) {
    console.error('Cron job error:', error);
  }
});
```

Install `node-cron`:
```bash
npm install node-cron
```

---

## 🗄️ Database Indexes (Performance)

Indexes are automatically created by Mongoose schemas. Verify with:

```javascript
mongosh superapp

// Check indexes
db.premiumunlocks.getIndexes()
db.subscriptions.getIndexes()
db.premiumcontents.getIndexes()
db.creatorrevenues.getIndexes()
```

Expected indexes:
```javascript
// PremiumUnlock
{ idempotencyKey: 1 } // Unique, sparse (prevent double-spend)
{ userId: 1, contentId: 1 }
{ creatorId: 1, txStatus: 1 }

// Subscription
{ subscriberId: 1, creatorId: 1, status: 1 }
{ expiresAt: 1, status: 1 } // For batch expiry job

// CreatorRevenue
{ 'lifetime.total_earned_coins': -1 } // Leaderboard
{ 'monthly.current_month_earnings': -1 }

// PremiumContent
{ creatorId: 1, is_published: 1 }
{ category: 1, is_published: 1 }
{ 'stats.unlocks': -1 } // Popular sort
```

---

## 🔐 Create Platform Wallet (One-Time Setup)

Platform revenue needs a wallet account:

```javascript
mongosh superapp

db.wallets.insertOne({
  userId: mongoose.Types.ObjectId('000000000000000000000001'), // Fixed platform ID
  balance_cents: 0,
  statistics: {
    total_spent_cents: 0,
    total_received_cents: 0,
    purchase_count: 0
  },
  createdAt: new Date(),
  updatedAt: new Date()
})
```

Or via API endpoint (admin only):

```bash
curl -X POST http://localhost:5000/api/admin/setup-platform-wallet \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

---

## 🧹 Database Cleanup (Testing)

Reset test data:

```javascript
mongosh superapp

// Clear monetization collections
db.premiumcontents.deleteMany({})
db.premiumunlocks.deleteMany({})
db.subscriptions.deleteMany({})
db.creatorrevenues.deleteMany({})

// Reset wallet balances (optional)
db.wallets.updateMany({}, { $set: { balance_cents: 100000 } })
```

---

## 🔍 Monitoring & Debugging

### Check Logs

```bash
# View server logs
tail -f logs/server.log

# View cron job logs
tail -f logs/cron.log

# View PM2 logs
pm2 logs super-app
pm2 logs expired-subscriptions-cron
```

### Query Revenue Stats

```javascript
mongosh superapp

// Total platform revenue (today)
const today = new Date();
today.setHours(0, 0, 0, 0);

db.premiumunlocks.aggregate([
  { $match: { txStatus: 'completed', createdAt: { $gte: today } } },
  { $group: {
    _id: null,
    totalRevenue: { $sum: '$amount_coins' },
    platformShare: { $sum: '$platform_share' },
    count: { $sum: 1 }
  }}
])

// Top earners (lifetime)
db.creatorrevenues.find({}).sort({ 'lifetime.total_earned_coins': -1 }).limit(10)
```

### Check Failed Transactions

```javascript
// Pending/failed unlocks
db.premiumunlocks.find({ txStatus: { $ne: 'completed' } })

// Suspended subscriptions
db.subscriptions.find({ status: 'suspended' })
```

---

## 🚨 Troubleshooting

### Issue: "Transaction failed: No replica set"

**Solution**: MongoDB must run in replica set mode for transactions.

```bash
# Local MongoDB - init replica set
mongosh
> rs.initiate()

# Or use MongoDB Atlas (automatically uses replica sets)
```

### Issue: "INSUFFICIENT_BALANCE" but wallet has coins

**Solution**: Check coin-to-cents conversion.

```javascript
// Correct: 1 coin = 10000 cents
const balance_coins = balance_cents / 10000;

// Verify wallet balance
db.wallets.findOne({ userId: ObjectId('...') })
```

### Issue: "Rate limit exceeded" during testing

**Solution**: Clear rate limit cache (restart server) or increase limits in code.

```javascript
// In routes/premium.js
rateLimit(100, 60000) // Increase to 100 per minute for testing
```

### Issue: File upload fails with "Invalid file type"

**Solution**: Check allowed MIME types in `routes/premium.js`:

```javascript
const allowedTypes = /jpeg|jpg|png|gif|mp4|mov|avi|mp3|wav|pdf|doc|docx/;
```

### Issue: Socket.io events not received

**Solution**: Verify client joined user room:

```javascript
// Client-side
socket.emit('user-online', userId);

// Server-side (check)
io.sockets.adapter.rooms.get(`user:${userId}`)
```

---

## 📊 Performance Benchmarks

Expected performance (local testing):

| Operation | Latency (p50) | Latency (p95) |
|-----------|---------------|---------------|
| Browse content | 50ms | 120ms |
| Get content details | 30ms | 80ms |
| Unlock content | 150ms | 350ms |
| Subscribe | 180ms | 400ms |
| Get revenue summary | 80ms | 200ms |

**Note**: Transaction operations (unlock, subscribe) are slower due to MongoDB sessions + 3-way transfers.

---

## 🔄 Deployment Checklist

Before deploying to production:

- [ ] MongoDB replica set enabled
- [ ] Environment variables configured
- [ ] Upload directory created with correct permissions
- [ ] Cron job scheduled (expired subscriptions)
- [ ] Platform wallet created
- [ ] Database indexes verified
- [ ] Tests passing (`npm test`)
- [ ] Rate limits configured appropriately
- [ ] Error monitoring setup (Sentry, etc.)
- [ ] Backup strategy configured
- [ ] SSL/TLS enabled for MongoDB connection
- [ ] File upload size limits reviewed (multer config)
- [ ] Socket.io CORS configured for production domain

---

## 📚 Additional Resources

- [Phase 5 Complete Documentation](./PHASE5_COMPLETE.md)
- [API Examples](./PHASE5_API_EXAMPLES.md)
- [Mongoose Transactions Docs](https://mongoosejs.com/docs/transactions.html)
- [Express Validator Guide](https://express-validator.github.io/docs/)
- [Multer Documentation](https://github.com/expressjs/multer)

---

**Setup Time**: ~5 minutes (with MongoDB Atlas)
**Support**: See PHASE5_COMPLETE.md for detailed API documentation

**Date**: November 25, 2025
**Version**: 1.0.0
