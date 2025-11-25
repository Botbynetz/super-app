# Phase 3 Testing Guide - Super App

## 🧪 Complete Testing Workflow

Testing dilakukan menggunakan REST Client atau Postman. Semua endpoint memerlukan authentication token.

---

## 🔐 Step 0: Setup & Authentication

### Get Authentication Token:
```bash
# 1. Send OTP
POST http://localhost:5000/api/auth/send-otp
Content-Type: application/json

{
  "phoneNumber": "+6281234567890"
}

# 2. Verify OTP (check your phone or server logs for OTP)
POST http://localhost:5000/api/auth/verify-otp
Content-Type: application/json

{
  "phoneNumber": "+6281234567890",
  "otp": "123456",
  "autoLogin": true
}

# Response will include token:
# {
#   "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
#   "user": { ... }
# }
```

**Save the token** - Gunakan untuk semua request berikutnya sebagai:
```
Authorization: Bearer YOUR_TOKEN_HERE
```

---

## 📦 Step 1: Seed Initial Data

### 1.1 Seed Product Templates
```bash
POST http://localhost:5000/api/ai/seed-product-templates
Authorization: Bearer YOUR_TOKEN
Content-Type: application/json

# Expected Response:
# {
#   "success": true,
#   "message": "5 product templates seeded successfully",
#   "templates": [...]
# }
```

**What it does:** Creates 5 category templates dengan synonym database untuk variasi text.

### 1.2 Seed CV Templates
```bash
POST http://localhost:5000/api/ai/seed-cv-templates
Authorization: Bearer YOUR_TOKEN
Content-Type: application/json

# Expected Response:
# {
#   "success": true,
#   "message": "2 CV templates seeded",
#   "templates": [...]
# }
```

**What it does:** Creates 2 CV templates (Modern Professional, Creative Designer).

### 1.3 Seed Badges (for CV/Freelancer features)
```bash
POST http://localhost:5000/api/gamification/seed-badges
Authorization: Bearer YOUR_TOKEN
Content-Type: application/json

# Expected Response:
# {
#   "success": true,
#   "message": "Default badges seeded"
# }
```

**What it does:** Creates 8 default badges untuk testing freelancer scoring.

---

## 💰 Step 2: Test AI Financial Assistant

### 2.1 Create Sample Transactions (Optional)
First, create some transactions for testing:
```bash
# Award some coins and badges to generate transactions
POST http://localhost:5000/api/gamification/add-exp
Authorization: Bearer YOUR_TOKEN
Content-Type: application/json

{
  "amount": 50,
  "reason": "Testing financial report"
}
```

### 2.2 Generate Financial Report
```bash
POST http://localhost:5000/api/ai/financial-assistant
Authorization: Bearer YOUR_TOKEN
Content-Type: application/json

{
  "userId": "YOUR_USER_ID",
  "month": 11,
  "year": 2025
}

# Expected Response:
# {
#   "success": true,
#   "report": {
#     "userId": "...",
#     "month": 11,
#     "year": 2025,
#     "income": {
#       "giftReceived": 0,
#       "liveStreamRevenue": 0,
#       "premiumContent": 0,
#       "marketplaceSales": 0,
#       "affiliateEarnings": 0,
#       "freelanceJobs": 0,
#       "other": 0,
#       "total": 0
#     },
#     "expenses": {
#       "giftsSent": 0,
#       "boostPurchases": 0,
#       "premiumSubscriptions": 0,
#       "marketplacePurchases": 0,
#       "platformFees": 0,
#       "other": 0,
#       "total": 0
#     },
#     "netBalance": 0,
#     "insights": {
#       "topIncomeSource": null,
#       "topExpenseCategory": null,
#       "savingsRate": 0,
#       "growthRate": null,
#       "recommendations": [
#         "Mulai live streaming untuk mendapatkan gift dari viewers",
#         "Hemat pengeluaran! Expenses sangat tinggi (>50% dari income)",
#         "Pertimbangkan untuk boost live stream Anda agar lebih banyak viewers"
#       ]
#     },
#     "isGenerated": true
#   }
# }
```

**What to test:**
- ✅ Report generation berhasil
- ✅ Income/expense breakdown muncul
- ✅ Savings rate calculated
- ✅ Recommendations ada (at least 3-4 items)

### 2.3 Get Financial Report (Read)
```bash
GET http://localhost:5000/api/ai/financial-report/YOUR_USER_ID?month=11&year=2025
Authorization: Bearer YOUR_TOKEN

# Expected: Same report as generated above
```

### 2.4 Set Financial Targets
```bash
POST http://localhost:5000/api/ai/financial-targets
Authorization: Bearer YOUR_TOKEN
Content-Type: application/json

{
  "userId": "YOUR_USER_ID",
  "month": 12,
  "year": 2025,
  "incomeTarget": 5000,
  "expenseLimit": 2000
}

# Expected Response:
# {
#   "success": true,
#   "report": {
#     "targets": {
#       "incomeTarget": 5000,
#       "expenseLimit": 2000
#     },
#     ...
#   }
# }
```

---

## 🛍️ Step 3: Test AI Product Description Generator

### 3.1 Generate Product Description (Electronics)
```bash
POST http://localhost:5000/api/ai/product-description
Authorization: Bearer YOUR_TOKEN
Content-Type: application/json

{
  "productName": "Smart Watch Pro X",
  "category": "electronics",
  "inputs": {
    "adjective": "canggih",
    "benefit": "meningkatkan produktivitas",
    "feature1": "GPS tracking",
    "feature2": "heart rate monitor",
    "advantage": "tahan air 50m",
    "targetAudience": "atlet dan profesional"
  }
}

# Expected Response:
# {
#   "success": true,
#   "description": "Smart Watch Pro X - Smartwatch [hebat/luar biasa/canggih] yang meningkatkan produktivitas dengan GPS tracking dan heart rate monitor. Keunggulan: tahan air 50m. Cocok untuk atlet dan profesional!",
#   "productDescription": {
#     "_id": "...",
#     "userId": "...",
#     "productName": "Smart Watch Pro X",
#     "category": "electronics",
#     "inputs": {...},
#     "generatedDescription": "...",
#     "templateUsed": "TEMPLATE_ID",
#     "isPublished": false
#   }
# }
```

**What to test:**
- ✅ Description generated dengan variasi (synonyms replaced)
- ✅ All input variables interpolated correctly
- ✅ Template usage tracked
- ✅ Try multiple times - description should vary slightly

### 3.2 Generate Fashion Product
```bash
POST http://localhost:5000/api/ai/product-description
Authorization: Bearer YOUR_TOKEN
Content-Type: application/json

{
  "productName": "Kaos Premium Cotton",
  "category": "fashion",
  "inputs": {
    "adjective": "nyaman",
    "material": "100% cotton",
    "quality": "premium",
    "targetAudience": "semua kalangan"
  }
}

# Test that fashion template is used
```

### 3.3 Get All Generated Descriptions
```bash
GET http://localhost:5000/api/ai/product-descriptions
Authorization: Bearer YOUR_TOKEN

# Expected: Array of all your generated descriptions
```

---

## 🤖 Step 4: Test AI Chatbot Generator

### 4.1 Create Chatbot with Flows
```bash
POST http://localhost:5000/api/ai/chatbot-generator
Authorization: Bearer YOUR_TOKEN
Content-Type: application/json

{
  "name": "Customer Support Bot",
  "description": "Handles customer inquiries",
  "flows": [
    {
      "trigger": "hello",
      "triggerType": "contains",
      "response": "Hi! How can I help you today?"
    },
    {
      "trigger": "jam operasional",
      "triggerType": "contains",
      "response": "Kami buka Senin-Jumat, 09:00-17:00 WIB"
    },
    {
      "trigger": "^price$",
      "triggerType": "regex",
      "response": "Our prices start from Rp 100,000"
    },
    {
      "trigger": "thanks",
      "triggerType": "startsWith",
      "response": "You're welcome! Happy to help! 😊"
    }
  ],
  "defaultResponse": "Maaf, saya tidak mengerti. Ketik 'help' untuk bantuan.",
  "deploymentType": "public"
}

# Expected Response:
# {
#   "success": true,
#   "chatbot": {
#     "_id": "CHATBOT_ID",
#     "userId": "...",
#     "name": "Customer Support Bot",
#     "flows": [...],
#     "defaultResponse": "...",
#     "isActive": true,
#     "deploymentType": "public"
#   }
# }
```

**Save CHATBOT_ID** untuk testing interaksi!

### 4.2 Get All Chatbots
```bash
GET http://localhost:5000/api/ai/chatbots
Authorization: Bearer YOUR_TOKEN

# Expected: Array of your chatbots
```

### 4.3 Test Chatbot Interaction - Exact Match
```bash
POST http://localhost:5000/api/ai/chatbot/CHATBOT_ID/message
Authorization: Bearer YOUR_TOKEN
Content-Type: application/json

{
  "message": "price"
}

# Expected Response:
# {
#   "success": true,
#   "response": "Our prices start from Rp 100,000",
#   "matchedFlow": {...}
# }
```

### 4.4 Test Chatbot Interaction - Contains
```bash
POST http://localhost:5000/api/ai/chatbot/CHATBOT_ID/message
Authorization: Bearer YOUR_TOKEN
Content-Type: application/json

{
  "message": "Hi hello there"
}

# Expected: "Hi! How can I help you today?"
```

### 4.5 Test Chatbot Interaction - StartsWith
```bash
POST http://localhost:5000/api/ai/chatbot/CHATBOT_ID/message
Authorization: Bearer YOUR_TOKEN
Content-Type: application/json

{
  "message": "thanks a lot for your help"
}

# Expected: "You're welcome! Happy to help! 😊"
```

### 4.6 Test Default Response
```bash
POST http://localhost:5000/api/ai/chatbot/CHATBOT_ID/message
Authorization: Bearer YOUR_TOKEN
Content-Type: application/json

{
  "message": "xyzabc random text"
}

# Expected: "Maaf, saya tidak mengerti. Ketik 'help' untuk bantuan."
```

### 4.7 Get Chatbot Stats
```bash
GET http://localhost:5000/api/ai/chatbot/CHATBOT_ID/stats
Authorization: Bearer YOUR_TOKEN

# Expected Response:
# {
#   "success": true,
#   "stats": {
#     "totalInteractions": 4,
#     "uniqueUsers": 1,
#     "averageResponseTime": 45
#   }
# }
```

### 4.8 Update Chatbot
```bash
PUT http://localhost:5000/api/ai/chatbot/CHATBOT_ID
Authorization: Bearer YOUR_TOKEN
Content-Type: application/json

{
  "name": "Updated Support Bot",
  "isActive": true
}

# Expected: Updated chatbot object
```

---

## 📄 Step 5: Test AI CV Generator & Freelancer Helper

### 5.1 Award Some Badges First (for CV auto-population)
```bash
# Check available badges
GET http://localhost:5000/api/gamification/badges
Authorization: Bearer YOUR_TOKEN

# Auto-check and award badges
POST http://localhost:5000/api/gamification/check-badges/YOUR_USER_ID
Authorization: Bearer YOUR_TOKEN

# Or manually award a badge
POST http://localhost:5000/api/gamification/award-badge
Authorization: Bearer YOUR_TOKEN
Content-Type: application/json

{
  "badgeId": "BADGE_ID_FROM_PREVIOUS_CALL",
  "userId": "YOUR_USER_ID"
}
```

### 5.2 Generate CV
```bash
POST http://localhost:5000/api/ai/generate-cv
Authorization: Bearer YOUR_TOKEN
Content-Type: application/json

{
  "templateId": "TEMPLATE_ID_FROM_SEED",
  "data": {
    "fullName": "John Doe",
    "email": "john.doe@example.com",
    "phone": "+6281234567890",
    "summary": "Experienced Full Stack Developer with 5+ years of expertise in building scalable web applications. Passionate about clean code and user experience.",
    "skills": ["JavaScript", "React", "Node.js", "MongoDB", "Python", "Docker"],
    "experience": [
      {
        "title": "Senior Developer",
        "company": "Tech Corp",
        "duration": "2020 - Present",
        "description": "Led development of microservices architecture"
      },
      {
        "title": "Frontend Developer",
        "company": "Startup Inc",
        "duration": "2018 - 2020",
        "description": "Built responsive web applications"
      }
    ],
    "education": [
      {
        "degree": "Bachelor of Computer Science",
        "institution": "University ABC",
        "year": "2018"
      }
    ]
  }
}

# Expected Response:
# {
#   "success": true,
#   "cv": {
#     "_id": "CV_ID",
#     "userId": "...",
#     "templateUsed": "...",
#     "data": {...},
#     "generatedHtml": "<html>...</html>",
#     "isPublic": false
#   }
# }
```

**What to test:**
- ✅ CV generated with HTML
- ✅ Badges auto-included from UserProgress
- ✅ All input data interpolated correctly

### 5.3 Get All My CVs
```bash
GET http://localhost:5000/api/ai/cvs
Authorization: Bearer YOUR_TOKEN

# Expected: Array of your CVs
```

### 5.4 Calculate Freelancer Score
```bash
POST http://localhost:5000/api/ai/calculate-freelancer-score
Authorization: Bearer YOUR_TOKEN
Content-Type: application/json

{
  "userId": "YOUR_USER_ID"
}

# Expected Response:
# {
#   "success": true,
#   "score": {
#     "_id": "...",
#     "userId": "...",
#     "skills": [...],
#     "scores": {
#       "skillMatch": 25,
#       "eventParticipation": 0,
#       "badgeQuality": 30,
#       "userRating": 67.5,
#       "completionRate": 12.75,
#       "responseTime": 0,
#       "totalScore": 135.25
#     },
#     "portfolio": [],
#     "availability": "available",
#     "hourlyRate": 0
#   }
# }
```

**What to test:**
- ✅ Score calculation based on badges
- ✅ Weighted algorithm working (25%, 20%, 25%, etc.)
- ✅ Badge quality points: legendary=40, epic=30, rare=20, common=10

### 5.5 Get Freelancer Rankings
```bash
GET http://localhost:5000/api/ai/freelancer-rankings?limit=10
Authorization: Bearer YOUR_TOKEN

# Expected: Top 10 freelancers sorted by totalScore
```

### 5.6 Get Rankings by Skill
```bash
GET http://localhost:5000/api/ai/freelancer-rankings?skill=JavaScript&limit=5
Authorization: Bearer YOUR_TOKEN

# Expected: Top 5 freelancers with JavaScript skill
```

---

## 🎯 Step 6: Test AI Smart Recommendations

### 6.1 Update User Preferences First
```bash
POST http://localhost:5000/api/ai/update-preferences
Authorization: Bearer YOUR_TOKEN
Content-Type: application/json

{
  "interests": ["programming", "design", "photography", "music"],
  "preferredEventTypes": ["workshop", "webinar", "meetup"],
  "preferredContentTypes": ["tutorial", "inspiration", "news"],
  "preferredStreamCategories": ["coding", "design", "gaming"]
}

# Expected Response:
# {
#   "success": true,
#   "preferences": {...}
# }
```

### 6.2 Create Sample Events (for recommendation testing)
```bash
POST http://localhost:5000/api/event/create
Authorization: Bearer YOUR_TOKEN
Content-Type: application/json

{
  "title": "Web Development Workshop",
  "description": "Learn modern web development with React and Node.js programming",
  "date": "2025-12-01T10:00:00Z",
  "category": "workshop"
}

POST http://localhost:5000/api/event/create
Authorization: Bearer YOUR_TOKEN
Content-Type: application/json

{
  "title": "Photography Meetup",
  "description": "Photography enthusiasts gathering and photo sharing session",
  "date": "2025-12-05T14:00:00Z",
  "category": "meetup"
}
```

### 6.3 Get Event Recommendations
```bash
GET http://localhost:5000/api/ai/recommend/events?limit=10
Authorization: Bearer YOUR_TOKEN

# Expected Response:
# {
#   "success": true,
#   "recommendations": [
#     {
#       "_id": "EVENT_ID",
#       "title": "Web Development Workshop",
#       "description": "...",
#       "score": 85,
#       "factors": {
#         "skillMatch": 20,
#         "interestMatch": 20,
#         "historyMatch": 0,
#         "popularityScore": 0,
#         "recencyScore": 10,
#         "socialScore": 0
#       }
#     }
#   ]
# }
```

**What to test:**
- ✅ Events sorted by score (highest first)
- ✅ Score breakdown with 6 factors
- ✅ Interests matching title/description
- ✅ Recommendations saved to DB with 7-day TTL

### 6.4 Get Content Recommendations
```bash
# First create some content
POST http://localhost:5000/api/content/upload
Authorization: Bearer YOUR_TOKEN
Content-Type: multipart/form-data

# (Form data with file and caption containing keywords like "programming tutorial")

# Then get recommendations
GET http://localhost:5000/api/ai/recommend/content?limit=10
Authorization: Bearer YOUR_TOKEN

# Expected: Content sorted by relevance score
```

### 6.5 Get Stream Recommendations
```bash
GET http://localhost:5000/api/ai/recommend/streams?limit=10
Authorization: Bearer YOUR_TOKEN

# Expected: Live streams matching preferences
# (May be empty if no streams active)
```

### 6.6 Get User Recommendations
```bash
GET http://localhost:5000/api/ai/recommend/users?limit=10
Authorization: Bearer YOUR_TOKEN

# Expected Response:
# {
#   "success": true,
#   "recommendations": [
#     {
#       "_id": "USER_ID",
#       "username": "user123",
#       "score": 45,
#       "factors": {
#         "skillMatch": 20,
#         "interestMatch": 15,
#         "historyMatch": 0,
#         "popularityScore": 0,
#         "recencyScore": 10,
#         "socialScore": 0
#       }
#     }
#   ]
# }
```

**What to test:**
- ✅ Excludes self (your own user)
- ✅ Excludes already followed users
- ✅ Badge/skill overlap scoring
- ✅ Online status bonus

### 6.7 Track Interaction
```bash
POST http://localhost:5000/api/ai/track-interaction
Authorization: Bearer YOUR_TOKEN
Content-Type: application/json

{
  "itemId": "EVENT_ID",
  "itemType": "event",
  "action": "view"
}

# Expected Response:
# {
#   "success": true,
#   "message": "Interaction tracked"
# }
```

**Interaction Types:**
- `view` - Viewed item
- `join` - Joined event
- `like` - Liked content
- `follow` - Followed user
- `watch` - Watched stream

**What to test:**
- ✅ Interaction saved to UserPreference
- ✅ History updated
- ✅ RecommendationScore marked as interacted

---

## 🔍 Verification Checklist

### Financial Assistant:
- [ ] Report generation works
- [ ] Income/expense categorization correct
- [ ] Savings rate calculated
- [ ] Growth rate compared to previous month
- [ ] 3-4 recommendations generated
- [ ] Targets can be set

### Product Generator:
- [ ] Template selection by category
- [ ] Synonym replacement creates variations
- [ ] Variable interpolation works
- [ ] Multiple generations have different text
- [ ] All 5 categories work (electronics, fashion, food, services, digital)

### Chatbot Builder:
- [ ] Chatbot creation successful
- [ ] Flow management works
- [ ] Pattern matching (exact) works
- [ ] Pattern matching (contains) works
- [ ] Pattern matching (startsWith) works
- [ ] Pattern matching (regex) works
- [ ] Default response for unmatched
- [ ] Stats tracking accurate
- [ ] Update chatbot works

### CV Generator:
- [ ] CV generation successful
- [ ] HTML template interpolation works
- [ ] Badges auto-included
- [ ] Skills/experience/education formatted
- [ ] Multiple templates available
- [ ] Freelancer score calculation accurate
- [ ] Badge quality weighted correctly (legendary=40, epic=30, rare=20, common=10)
- [ ] Rankings sorted by score

### Smart Recommendations:
- [ ] User preferences saved
- [ ] Event recommendations sorted by score
- [ ] 6 factors calculated correctly
- [ ] Content recommendations work
- [ ] Stream recommendations work
- [ ] User recommendations exclude self
- [ ] Interaction tracking updates history
- [ ] RecommendationScore TTL set (7 days)

---

## 🐛 Common Issues & Solutions

### Issue: "Token invalid" or 401 Unauthorized
**Solution:** Get new token via `/api/auth/send-otp` and `/api/auth/verify-otp`

### Issue: "User not found" errors
**Solution:** Use correct USER_ID from token payload or profile endpoint

### Issue: "Template not found"
**Solution:** Run seed endpoints first (`/api/ai/seed-product-templates`, `/api/ai/seed-cv-templates`)

### Issue: Empty recommendations
**Solution:** 
- Create sample events/content first
- Update user preferences
- Ensure you have badges/progress data

### Issue: Chatbot always returns default response
**Solution:** Check trigger patterns match input. Use lowercase for comparison. Check triggerType is correct.

### Issue: Financial report empty
**Solution:** Create transactions first (add XP, award badges, send gifts, etc.)

### Issue: Freelancer score 0 or very low
**Solution:** Award badges first, join events, complete profile

---

## 📊 Expected Results Summary

| Feature | Endpoint | Expected Result |
|---------|----------|-----------------|
| Financial Report | POST /ai/financial-assistant | Report with insights & recommendations |
| Product Description | POST /ai/product-description | Varied text with synonyms |
| Chatbot Creation | POST /ai/chatbot-generator | Chatbot with flows |
| Chatbot Message | POST /ai/chatbot/:id/message | Matched response or default |
| CV Generation | POST /ai/generate-cv | HTML CV with badges |
| Freelancer Score | POST /ai/calculate-freelancer-score | Weighted score 0-500 |
| Event Recommendations | GET /ai/recommend/events | Sorted by score with factors |
| User Recommendations | GET /ai/recommend/users | Users with badge overlap |
| Interaction Tracking | POST /ai/track-interaction | History updated |

---

## ✅ Testing Complete!

Jika semua test berhasil:
- ✅ All 5 AI features working
- ✅ 30+ endpoints tested
- ✅ Internal algorithms functioning
- ✅ Database operations correct
- ✅ No external AI dependencies

**Next Steps:**
1. Fix any failing tests
2. Test mobile UI integration
3. Performance optimization if needed
4. Deploy to staging/production

---

**Testing Duration:** ~30-45 minutes
**Date:** November 24, 2025
**Version:** Phase 3.0.0
