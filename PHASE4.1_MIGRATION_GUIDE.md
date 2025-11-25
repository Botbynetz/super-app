# Phase 4.1 Wallet System - Migration Guide

## For Existing Super App Installations

If you already have Phase 1-3 running and want to add Phase 4.1 Wallet Core:

## Quick Migration Steps

### 1. Backup Your Data (IMPORTANT!)

```bash
# Backup MongoDB database
mongodump --db=superapp --out=./backup/$(date +%Y%m%d)

# Backup backend code
cp -r backend backend_backup_$(date +%Y%m%d)
```

### 2. Update Dependencies

```bash
cd backend
npm install express-validator@^7.0.1 express-rate-limit@^7.1.5 uuid@^9.0.1 winston@^3.11.0 --save
```

### 3. Add New Files

Copy these files to your backend:

**Models:**
- `backend/models/Wallet.js`
- `backend/models/WalletTransaction.js`
- `backend/models/AuditLog.js`

**Services:**
- `backend/services/walletService.js`

**Routes:**
- `backend/routes/wallet.js`

### 4. Update server.js

Add to your `backend/server.js`:

```javascript
// At the top with other route imports
const walletRoutes = require('./routes/wallet');

// After app.use(express.json())
app.set('io', io); // Make io accessible in routes

// With other route registrations
app.use('/api/wallet', walletRoutes);

// In Socket.io connection handler, add:
socket.on('REQUEST_BALANCE', async (data) => {
  try {
    const WalletService = require('./services/walletService');
    const balance = await WalletService.getBalance(socket.userId);
    socket.emit('BALANCE_RESPONSE', {
      success: true,
      data: balance
    });
  } catch (error) {
    socket.emit('BALANCE_RESPONSE', {
      success: false,
      error: error.message
    });
  }
});
```

### 5. Configure MongoDB Replica Set

**Critical:** Wallet system requires MongoDB replica set for transactions.

**Option A: Migrate to MongoDB Atlas (Recommended)**

1. Create free cluster at https://cloud.mongodb.com
2. Export your data:
   ```bash
   mongodump --db=superapp --out=./export
   ```
3. Import to Atlas:
   ```bash
   mongorestore --uri="mongodb+srv://user:pass@cluster.mongodb.net/superapp" ./export/superapp
   ```
4. Update `.env`:
   ```
   MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/superapp?retryWrites=true&w=majority
   ```

**Option B: Convert Local MongoDB to Replica Set**

1. Stop MongoDB:
   ```bash
   net stop MongoDB
   ```

2. Create new config file `mongod.cfg`:
   ```yaml
   replication:
     replSetName: "rs0"
   ```

3. Restart with replica set:
   ```bash
   mongod --config mongod.cfg --port 27017 --dbpath C:\data\db
   ```

4. Initialize replica set:
   ```bash
   mongosh
   > rs.initiate()
   ```

5. Update `.env`:
   ```
   MONGODB_URI=mongodb://localhost:27017/superapp?replicaSet=rs0
   ```

### 6. Test Migration

```bash
# Start server
npm run dev

# Test basic wallet operations
curl http://localhost:5000/api/wallet/balance \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Data Migration (Optional)

If you want to initialize wallets for existing users:

### Create Migration Script

Create `backend/scripts/init-wallets.js`:

```javascript
const mongoose = require('mongoose');
const User = require('../models/User');
const Wallet = require('../models/Wallet');
require('dotenv').config();

async function initializeWallets() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('MongoDB connected');

    const users = await User.find({});
    console.log(`Found ${users.length} users`);

    let created = 0;
    for (const user of users) {
      const existingWallet = await Wallet.findOne({ userId: user._id });
      if (!existingWallet) {
        await Wallet.create({
          userId: user._id,
          balance_cents: 0,
          currency: 'IDR',
          status: 'active'
        });
        created++;
      }
    }

    console.log(`Created ${created} wallets`);
    console.log('Migration complete!');
    process.exit(0);
  } catch (error) {
    console.error('Migration error:', error);
    process.exit(1);
  }
}

initializeWallets();
```

### Run Migration

```bash
node backend/scripts/init-wallets.js
```

## Frontend Integration

### Add Wallet Balance to User Profile

**Web (React):**

```javascript
import { useEffect, useState } from 'react';
import io from 'socket.io-client';

function WalletBalance() {
  const [balance, setBalance] = useState(null);
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    // Connect to Socket.io
    const newSocket = io('http://localhost:5000');
    setSocket(newSocket);

    // Request balance
    newSocket.emit('REQUEST_BALANCE');

    // Listen for balance updates
    newSocket.on('BALANCE_RESPONSE', (data) => {
      if (data.success) {
        setBalance(data.data);
      }
    });

    newSocket.on('COIN_UPDATE', (data) => {
      // Update balance when coins change
      setBalance(prev => ({
        ...prev,
        balance_cents: data.balance,
        balance_coins: data.balance / 10000
      }));
      
      // Show notification
      alert(`${data.change > 0 ? 'Received' : 'Sent'} ${Math.abs(data.change / 10000)} coins`);
    });

    return () => newSocket.close();
  }, []);

  if (!balance) return <div>Loading...</div>;

  return (
    <div className="wallet-balance">
      <h3>Your Balance</h3>
      <p className="coins">{balance.balance_coins} coins</p>
      <p className="rupiah">Rp {balance.balance_rupiah.toLocaleString()}</p>
    </div>
  );
}

export default WalletBalance;
```

**Mobile (React Native):**

```javascript
import React, { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import io from 'socket.io-client';

const WalletBalance = () => {
  const [balance, setBalance] = useState(null);

  useEffect(() => {
    const socket = io('http://localhost:5000');

    socket.emit('REQUEST_BALANCE');

    socket.on('BALANCE_RESPONSE', (data) => {
      if (data.success) {
        setBalance(data.data);
      }
    });

    socket.on('COIN_UPDATE', (data) => {
      setBalance(prev => ({
        ...prev,
        balance_cents: data.balance,
        balance_coins: data.balance / 10000
      }));
    });

    return () => socket.disconnect();
  }, []);

  if (!balance) return <Text>Loading...</Text>;

  return (
    <View style={{ padding: 20 }}>
      <Text style={{ fontSize: 24, fontWeight: 'bold' }}>
        {balance.balance_coins} coins
      </Text>
      <Text style={{ fontSize: 16, color: '#666' }}>
        Rp {balance.balance_rupiah.toLocaleString()}
      </Text>
    </View>
  );
};

export default WalletBalance;
```

### Add Transfer Button

```javascript
const transferCoins = async (toUserId, amount) => {
  try {
    const response = await fetch('http://localhost:5000/api/wallet/transfer', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        toUserId,
        amount: amount * 10000, // Convert coins to cents
        idempotencyKey: `transfer_${Date.now()}`,
        note: 'Gift'
      })
    });

    const data = await response.json();
    
    if (data.success) {
      alert('Transfer successful!');
    } else {
      alert(`Transfer failed: ${data.error}`);
    }
  } catch (error) {
    alert(`Error: ${error.message}`);
  }
};
```

## Rollback Plan (If Issues Occur)

### 1. Stop Server

```bash
# Press Ctrl+C to stop server
```

### 2. Restore Backup

```bash
# Restore database
mongorestore --drop --db=superapp ./backup/YYYYMMDD/superapp

# Restore code
rm -rf backend
cp -r backend_backup_YYYYMMDD backend
```

### 3. Revert MongoDB Configuration

```bash
# Stop MongoDB
net stop MongoDB

# Remove replica set config
# Edit mongod.cfg and remove replication section

# Restart normally
net start MongoDB
```

### 4. Revert Dependencies

```bash
cd backend
npm install  # Will use package.json before wallet additions
```

## Testing After Migration

### 1. Basic Health Check

```bash
# Test server
curl http://localhost:5000/api/user/profile -H "Authorization: Bearer YOUR_TOKEN"

# Should return user profile (existing functionality)
```

### 2. Test Wallet Endpoints

```bash
# Test balance
curl http://localhost:5000/api/wallet/balance -H "Authorization: Bearer YOUR_TOKEN"

# Should return: {"success": true, "data": {"balance_cents": 0, ...}}
```

### 3. Test Existing Features

- Login/Signup still works?
- Content upload still works?
- Chat still works?
- AI features still work?

### 4. Run Wallet Tests

Use `test-wallet.rest` with REST Client extension to test all wallet endpoints.

## Troubleshooting

### Issue: "Transaction numbers are only allowed on a replica set member"

**Solution:** MongoDB not configured as replica set. Follow Step 5 above.

### Issue: "Cannot find module 'express-validator'"

**Solution:** Run `npm install` to install new dependencies.

### Issue: Existing features broken after migration

**Solution:** Check if `server.js` updates were applied correctly. Compare with backup.

### Issue: Balance not showing in UI

**Solution:** Check Socket.io connection. Ensure `REQUEST_BALANCE` event is emitted.

## Performance Impact

### Expected Changes
- Minimal impact on existing features
- Wallet operations are isolated
- MongoDB transactions add ~10ms latency (acceptable)

### Monitor These Metrics
- Average response time (should be <100ms)
- Database connection pool usage
- Memory usage (wallet adds ~50MB)

## Security Considerations

### New Attack Vectors
- **Rate limiting bypass**: Handled by express-rate-limit
- **Replay attacks**: Handled by idempotency keys
- **Race conditions**: Handled by atomic operations

### Recommended Actions
1. Enable HTTPS (Let's Encrypt)
2. Add webhook signature verification (Phase 4.2)
3. Implement fraud detection (Phase 4.4)
4. Regular security audits

## Support

If you encounter issues during migration:

1. Check documentation:
   - PHASE4_WALLET_SETUP.md
   - PHASE4.1_COMPLETE.md
   - PHASE4.1_ARCHITECTURE.md

2. Common issues covered in PHASE4_WALLET_SETUP.md "Common Issues" section

3. Review test cases in test-wallet.rest for expected behavior

4. Check audit logs for transaction errors:
   ```javascript
   db.audit_logs.find({ action: 'rollback' }).sort({ timestamp: -1 })
   ```

## Success Criteria

Migration is successful when:
- ✅ All existing features work (login, content, chat, AI)
- ✅ GET /api/wallet/balance returns data
- ✅ MongoDB replica set operational
- ✅ Socket.io COIN_UPDATE events received
- ✅ No errors in server logs
- ✅ All 50+ test cases in test-wallet.rest pass

---

**Migration Time:** ~30 minutes (if MongoDB Atlas used)
**Downtime:** ~5 minutes (during MongoDB migration)
**Rollback Time:** ~10 minutes (if issues occur)

Good luck with your migration! 🚀
