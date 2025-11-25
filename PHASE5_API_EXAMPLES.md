# 🚀 Phase 5 API Quick Reference

## Quick Start Examples

### 1. Create Premium Content

```bash
curl -X POST http://localhost:5000/api/premium/create \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "title=Advanced JavaScript Tutorial" \
  -F "description=Learn advanced JS concepts including closures, async/await, and more" \
  -F "category=education" \
  -F "price_coins=100" \
  -F "mediaType=video" \
  -F "tags[]=javascript" \
  -F "tags[]=programming" \
  -F "media=@/path/to/video.mp4"
```

**Response**:
```json
{
  "success": true,
  "content": {
    "id": "64abc123...",
    "title": "Advanced JavaScript Tutorial",
    "status": "draft",
    "message": "Content created. Use /publish endpoint to make it available."
  }
}
```

---

### 2. Publish Content

```bash
curl -X PUT http://localhost:5000/api/premium/64abc123.../publish \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response**:
```json
{
  "success": true,
  "message": "Content published successfully",
  "content": {
    "id": "64abc123...",
    "title": "Advanced JavaScript Tutorial",
    "is_published": true
  }
}
```

---

### 3. Browse Premium Content

```bash
curl -X GET "http://localhost:5000/api/premium/browse?category=education&sort=popular&page=1&limit=20"
```

**Response**:
```json
{
  "success": true,
  "contents": [
    {
      "id": "64abc123...",
      "title": "Advanced JavaScript Tutorial",
      "description": "Learn advanced JS concepts...",
      "category": "education",
      "price_coins": 100,
      "price_rupiah": 10000,
      "mediaType": "video",
      "thumbnailUrl": "/uploads/premium/.../thumb.jpg",
      "tags": ["javascript", "programming"],
      "stats": {
        "views": 1500,
        "unlocks": 250,
        "likes": 180
      },
      "creator": {
        "id": "64creator...",
        "username": "john_dev",
        "profilePhoto": "/uploads/profiles/john.jpg"
      },
      "createdAt": "2025-11-20T10:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "pages": 8
  }
}
```

---

### 4. Get Content Details (With Access Check)

```bash
curl -X GET http://localhost:5000/api/premium/64abc123... \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response (Locked)**:
```json
{
  "success": true,
  "content": {
    "id": "64abc123...",
    "title": "Advanced JavaScript Tutorial",
    "price_coins": 100,
    "price_rupiah": 10000,
    "accessStatus": "locked-pay-per-view",
    "canAccess": false,
    "fullMediaUrl": null,
    "previewMediaUrl": "/uploads/premium/.../preview.mp4"
  }
}
```

**Response (Unlocked)**:
```json
{
  "success": true,
  "content": {
    "id": "64abc123...",
    "title": "Advanced JavaScript Tutorial",
    "accessStatus": "paid-unlocked",
    "canAccess": true,
    "fullMediaUrl": "/uploads/premium/.../full-video.mp4"
  }
}
```

---

### 5. Unlock Content

```bash
curl -X POST http://localhost:5000/api/premium/64abc123.../unlock \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "idempotencyKey": "unique-key-12345"
  }'
```

**Success Response**:
```json
{
  "success": true,
  "message": "Content unlocked successfully",
  "unlock": {
    "unlockId": "UNL-1732512345-abc123",
    "amount_coins": 100,
    "amount_rupiah": 10000,
    "accessGranted": true
  },
  "content": {
    "id": "64abc123...",
    "title": "Advanced JavaScript Tutorial"
  }
}
```

**Error Responses**:

**Insufficient Balance**:
```json
{
  "code": "INSUFFICIENT_BALANCE",
  "reason": "Insufficient balance. Required: 100 coins, Available: 50 coins",
  "status": 400
}
```

**Fraud Check Failed**:
```json
{
  "code": "FRAUD_CHECK_FAILED",
  "reason": "Too many unlocks per minute. Please wait.",
  "riskScore": 85,
  "action": "blocked"
}
```

**Already Unlocked**:
```json
{
  "code": "ALREADY_UNLOCKED",
  "reason": "Content already unlocked by this user",
  "status": 400
}
```

---

### 6. Subscribe to Creator

```bash
curl -X POST http://localhost:5000/api/subscription/subscribe \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "creatorId": "64creator...",
    "tier": "monthly",
    "price_coins": 50,
    "idempotencyKey": "sub-unique-key-67890"
  }'
```

**Response**:
```json
{
  "success": true,
  "message": "Subscription created successfully",
  "subscription": {
    "id": "64sub123...",
    "tier": "monthly",
    "price_coins": 50,
    "price_rupiah": 5000,
    "startedAt": "2025-11-25T10:00:00.000Z",
    "expiresAt": "2025-12-25T10:00:00.000Z",
    "autoRenew": true
  }
}
```

---

### 7. Get My Subscriptions

```bash
curl -X GET "http://localhost:5000/api/subscription/my-subscriptions?status=active&page=1&limit=10" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response**:
```json
{
  "success": true,
  "subscriptions": [
    {
      "id": "64sub123...",
      "creator": {
        "id": "64creator...",
        "username": "john_dev",
        "profilePhoto": "/uploads/profiles/john.jpg"
      },
      "tier": "monthly",
      "price_coins": 50,
      "startedAt": "2025-11-25T10:00:00.000Z",
      "expiresAt": "2025-12-25T10:00:00.000Z",
      "daysRemaining": 30,
      "autoRenew": true,
      "status": "active"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 3,
    "pages": 1
  }
}
```

---

### 8. Cancel Subscription

```bash
curl -X POST http://localhost:5000/api/subscription/64sub123.../cancel \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "No longer interested"
  }'
```

**Response**:
```json
{
  "success": true,
  "message": "Subscription cancelled successfully",
  "subscription": {
    "id": "64sub123...",
    "status": "cancelled",
    "cancelledAt": "2025-11-25T15:30:00.000Z",
    "expiresAt": "2025-12-25T10:00:00.000Z",
    "reason": "No longer interested"
  }
}
```

---

### 9. Check Subscription Status

```bash
curl -X GET http://localhost:5000/api/subscription/check/64creator... \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response (Subscribed)**:
```json
{
  "success": true,
  "isSubscribed": true,
  "subscription": {
    "id": "64sub123...",
    "tier": "monthly",
    "expiresAt": "2025-12-25T10:00:00.000Z",
    "autoRenew": true,
    "daysRemaining": 30
  }
}
```

**Response (Not Subscribed)**:
```json
{
  "success": true,
  "isSubscribed": false,
  "subscription": null
}
```

---

### 10. Get Creator Revenue Summary

```bash
curl -X GET http://localhost:5000/api/creator/revenue \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response**:
```json
{
  "success": true,
  "revenue": {
    "creatorId": "64creator...",
    "balance": {
      "available_coins": 1500,
      "available_rupiah": 150000,
      "pending_coins": 200,
      "pending_rupiah": 20000,
      "withdrawn_coins": 3000,
      "withdrawn_rupiah": 300000,
      "total_coins": 1700,
      "total_rupiah": 170000
    },
    "lifetime": {
      "total_earned_coins": 4700,
      "total_earned_rupiah": 470000,
      "total_unlocks": 180,
      "total_subscribers": 50
    },
    "monthly": {
      "current_month_earnings_coins": 500,
      "current_month_earnings_rupiah": 50000,
      "last_month_earnings_coins": 350,
      "last_month_earnings_rupiah": 35000,
      "month_over_month_change_percent": 42.9,
      "trend": "up"
    },
    "sources": {
      "unlocks": {
        "total_unlocks": 180,
        "total_revenue_coins": 3500,
        "creator_share_coins": 2450,
        "creator_share_rupiah": 245000
      },
      "subscriptions": {
        "active_subscribers": 50,
        "total_subscribers": 75,
        "total_revenue_coins": 2500,
        "total_revenue_rupiah": 250000,
        "average_price_coins": 50
      }
    },
    "payment_info": {
      "verified": true,
      "has_bank_details": true
    }
  }
}
```

---

### 11. Request Withdrawal

```bash
curl -X POST http://localhost:5000/api/creator/revenue/withdraw \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "amount_coins": 1000
  }'
```

**Success Response**:
```json
{
  "success": true,
  "message": "Withdrawal initiated successfully",
  "withdrawal": {
    "id": "64withdraw...",
    "amount_coins": 1000,
    "amount_rupiah": 100000,
    "status": "pending",
    "withdrawnAt": "2025-11-25T16:00:00.000Z",
    "bankDetails": {
      "bankName": "BCA",
      "accountNumber": "***1234"
    }
  },
  "remainingBalance": {
    "available_coins": 500,
    "available_rupiah": 50000
  }
}
```

**Error (KYC Not Verified)**:
```json
{
  "code": "PAYMENT_INFO_NOT_VERIFIED",
  "reason": "Please complete KYC verification before withdrawing",
  "kyc_status": "pending"
}
```

---

### 12. Set Payment Information (KYC)

```bash
curl -X PUT http://localhost:5000/api/creator/revenue/payment-info \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "bankName": "BCA",
    "accountNumber": "1234567890",
    "accountName": "John Doe",
    "taxId": "12.345.678.9-012.345"
  }'
```

**Response**:
```json
{
  "success": true,
  "message": "Payment information submitted. Pending admin verification.",
  "paymentInfo": {
    "bankName": "BCA",
    "accountNumber": "***7890",
    "verified": false
  }
}
```

---

### 13. Get Revenue Growth Chart

```bash
curl -X GET "http://localhost:5000/api/creator/revenue/chart?months=6" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response**:
```json
{
  "success": true,
  "chart": [
    {
      "month": "2025-06",
      "month_name": "June 2025",
      "unlocks": {
        "count": 20,
        "revenue_coins": 350
      },
      "subscriptions": {
        "count": 0,
        "revenue_coins": 175
      },
      "total_revenue_coins": 525,
      "total_revenue_rupiah": 52500
    },
    {
      "month": "2025-07",
      "month_name": "July 2025",
      "unlocks": {
        "count": 30,
        "revenue_coins": 490
      },
      "subscriptions": {
        "count": 0,
        "revenue_coins": 245
      },
      "total_revenue_coins": 735,
      "total_revenue_rupiah": 73500
    }
  ]
}
```

---

### 14. Get Top Performing Content

```bash
curl -X GET "http://localhost:5000/api/creator/revenue/top-content?limit=10&days=30" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response**:
```json
{
  "success": true,
  "topContent": [
    {
      "rank": 1,
      "content": {
        "id": "64abc123...",
        "title": "Advanced JavaScript Tutorial",
        "category": "education",
        "mediaType": "video",
        "thumbnailUrl": "/uploads/premium/.../thumb.jpg"
      },
      "creator": {
        "id": "64creator...",
        "username": "john_dev",
        "profilePhoto": "/uploads/profiles/john.jpg"
      },
      "performance": {
        "total_unlocks": 85,
        "total_revenue_coins": 8500,
        "total_revenue_rupiah": 850000,
        "creator_earnings_coins": 5950,
        "creator_earnings_rupiah": 595000,
        "average_price_coins": 100
      },
      "period_days": 30
    }
  ]
}
```

---

## Socket.io Client Examples

### Connect and Authenticate

```javascript
import io from 'socket.io-client';

const socket = io('http://localhost:5000');

// Authenticate user
socket.emit('user-online', userId);

// Handle heartbeat
socket.on('ping', () => {
  socket.emit('pong');
});
```

---

### Listen for Premium Events

```javascript
// Listen for unlock notification
socket.on('PREMIUM_UNLOCKED', (data) => {
  console.log('Content unlocked:', data);
  // {
  //   contentId: '64abc123...',
  //   title: 'Advanced JavaScript Tutorial',
  //   unlockId: 'UNL-1732512345-abc123',
  //   amount_coins: 100,
  //   timestamp: 1732512345000
  // }
  
  // Update UI - show unlocked content
  showSuccessNotification(`Unlocked: ${data.title}`);
  refreshContentAccess();
});

// Listen for subscription started
socket.on('SUBSCRIPTION_STARTED', (data) => {
  console.log('Subscription started:', data);
  // {
  //   subscriptionId: '64sub123...',
  //   creatorId: '64creator...',
  //   tier: 'monthly',
  //   expiresAt: '2025-12-25T10:00:00.000Z',
  //   timestamp: 1732512345000
  // }
  
  showSuccessNotification('Subscription activated!');
  refreshSubscriptions();
});

// Listen for revenue update (creator only)
socket.on('REVENUE_UPDATED', (data) => {
  console.log('Revenue updated:', data);
  // {
  //   type: 'unlock',
  //   contentId: '64abc123...',
  //   amount_coins: 70,
  //   timestamp: 1732512345000
  // }
  
  updateRevenueDisplay(data.amount_coins);
});
```

---

## Error Handling Best Practices

### Frontend Error Handler

```javascript
async function unlockContent(contentId) {
  try {
    const response = await axios.post(`/api/premium/${contentId}/unlock`, {
      idempotencyKey: generateUniqueKey()
    });
    
    return response.data;
  } catch (error) {
    const { code, reason, status } = error.response?.data || {};
    
    // Handle specific error codes
    switch (code) {
      case 'INSUFFICIENT_BALANCE':
        showTopUpModal();
        break;
        
      case 'FRAUD_CHECK_FAILED':
        showErrorModal('Transaction blocked', reason);
        break;
        
      case 'ALREADY_UNLOCKED':
        // Silent - just refresh page
        window.location.reload();
        break;
        
      case 'RATE_LIMIT_EXCEEDED':
        showErrorModal('Too many requests', 'Please wait a moment and try again');
        break;
        
      default:
        showErrorModal('Unlock failed', reason || 'Unknown error occurred');
    }
    
    throw error;
  }
}
```

---

## Testing with cURL Scripts

### Complete Test Flow

```bash
#!/bin/bash

# 1. Login
TOKEN=$(curl -s -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","password":"password123"}' \
  | jq -r '.token')

echo "Token: $TOKEN"

# 2. Create content
CONTENT_ID=$(curl -s -X POST http://localhost:5000/api/premium/create \
  -H "Authorization: Bearer $TOKEN" \
  -F "title=Test Content" \
  -F "description=Test description" \
  -F "category=education" \
  -F "price_coins=100" \
  -F "mediaType=video" \
  | jq -r '.content.id')

echo "Content ID: $CONTENT_ID"

# 3. Publish content
curl -s -X PUT "http://localhost:5000/api/premium/$CONTENT_ID/publish" \
  -H "Authorization: Bearer $TOKEN"

# 4. Unlock content (as different user)
curl -s -X POST "http://localhost:5000/api/premium/$CONTENT_ID/unlock" \
  -H "Authorization: Bearer $OTHER_USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"idempotencyKey":"test-key-123"}'

echo "Test flow complete!"
```

---

## Performance Tips

### 1. Use Idempotency Keys

```javascript
// Generate unique key per request
import { v4 as uuidv4 } from 'uuid';

const idempotencyKey = uuidv4(); // e.g., "550e8400-e29b-41d4-a716-446655440000"

// Send with request
await axios.post('/api/premium/:id/unlock', {
  idempotencyKey
});
```

### 2. Implement Client-Side Caching

```javascript
// Cache content details for 5 minutes
const CACHE_TTL = 5 * 60 * 1000;
const contentCache = new Map();

async function getContentDetails(contentId) {
  const cached = contentCache.get(contentId);
  
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  
  const data = await axios.get(`/api/premium/${contentId}`);
  contentCache.set(contentId, {
    data: data.data,
    timestamp: Date.now()
  });
  
  return data.data;
}
```

### 3. Batch API Requests

```javascript
// Fetch multiple content details in parallel
const contentIds = ['id1', 'id2', 'id3'];

const contents = await Promise.all(
  contentIds.map(id => axios.get(`/api/premium/${id}`))
);
```

---

**Last Updated**: November 25, 2025
**Version**: 1.0.0
