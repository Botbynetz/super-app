# 🎯 RENDER.COM DEPLOYMENT GUIDE

Complete step-by-step guide to deploy Super App backend to Render.com

---

## 📋 Prerequisites

- ✅ GitHub account
- ✅ Render.com account (free tier available)
- ✅ MongoDB Atlas account
- ✅ Sentry.io account (optional but recommended)
- ✅ Telegram account (for alerts)

---

## Step 1: MongoDB Atlas Setup

### 1.1 Create Cluster

1. Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Click **"Create"** → **"Shared Cluster"** (free)
3. Select region closest to your Render deployment
4. Click **"Create Cluster"**

### 1.2 Configure Replica Set

**Important**: Replica set is **required** for transactions!

1. Cluster → **Configuration** → **"Edit Configuration"**
2. Ensure "Replica Set" is enabled (default for Atlas)
3. Save changes

### 1.3 Create Database User

1. Security → **Database Access**
2. Click **"Add New Database User"**
3. Choose **"Password"** authentication
4. Username: `superapp_user`
5. Generate strong password
6. Database User Privileges: **"Read and write to any database"**
7. Click **"Add User"**

### 1.4 Whitelist IPs

1. Security → **Network Access**
2. Click **"Add IP Address"**
3. Add **"0.0.0.0/0"** (allow from anywhere)
   - ⚠️ For production, use specific Render IP ranges
4. Click **"Confirm"**

### 1.5 Get Connection String

1. Click **"Connect"** on your cluster
2. Choose **"Connect your application"**
3. Driver: **Node.js**
4. Copy connection string:
   ```
   mongodb+srv://superapp_user:<password>@cluster.mongodb.net/superapp_staging?retryWrites=true&w=majority
   ```
5. Replace `<password>` with actual password
6. **Save this** - you'll need it for Render

---

## Step 2: Sentry Setup (Optional)

### 2.1 Create Project

1. Go to [sentry.io](https://sentry.io)
2. Create account (free tier available)
3. Click **"Create Project"**
4. Platform: **Node.js**
5. Project name: `superapp-staging`
6. Click **"Create Project"**

### 2.2 Get DSN

1. Settings → **Projects** → **superapp-staging**
2. Client Keys (DSN)
3. Copy **DSN**:
   ```
   https://xxxxx@oxxxxx.ingest.sentry.io/xxxxx
   ```
4. **Save this** for Render

---

## Step 3: Telegram Bot Setup

### 3.1 Create Bot

1. Open Telegram
2. Search for [@BotFather](https://t.me/BotFather)
3. Send `/newbot`
4. Follow prompts:
   - Bot name: `Super App Ops Bot`
   - Username: `superapp_ops_bot` (must end with `_bot`)
5. Copy **bot token**:
   ```
   1234567890:ABCdefGHIjklMNOpqrsTUVwxyz
   ```
6. **Save this** for Render

### 3.2 Get Your Chat ID

1. Search for [@userinfobot](https://t.me/userinfobot)
2. Send `/start`
3. Copy your **user ID**:
   ```
   123456789
   ```
4. **Save this** for Render

### 3.3 Start Bot

1. Search for your bot: `@superapp_ops_bot`
2. Send `/start`
3. Keep this chat open for alerts

---

## Step 4: Render Account Setup

### 4.1 Create Account

1. Go to [render.com](https://render.com)
2. Sign up with **GitHub** (recommended)
3. Authorize Render to access your repositories

### 4.2 Connect Repository

1. Dashboard → **"New +"** → **"Web Service"**
2. Connect repository: `Botbynetz/super-app`
3. If not listed, click **"Configure account"**
4. Grant access to `super-app` repository

---

## Step 5: Create Web Service

### 5.1 Basic Configuration

1. Click **"New Web Service"**
2. Connect repository: `super-app`
3. Configure:
   - **Name**: `superapp-backend-staging`
   - **Region**: Oregon (or closest to you)
   - **Branch**: `staging`
   - **Root Directory**: Leave blank (uses root)
   - **Environment**: **Docker**
   - **Dockerfile Path**: `./Dockerfile`

### 5.2 Instance Type

- **Plan**: Starter ($7/month) or Free (sleep after inactivity)
- For testing: Free tier is fine
- For real staging: Use Starter

### 5.3 Auto-Deploy

- ✅ Enable **"Auto-Deploy"**
- Deploys automatically when you push to `staging` branch

Click **"Create Web Service"**

---

## Step 6: Configure Environment Variables

In Render dashboard → **Environment** tab:

### 6.1 Core Configuration

```bash
NODE_ENV=production
PORT=5000
```

### 6.2 Database

```bash
DATABASE_URI=mongodb+srv://superapp_user:YOUR_PASSWORD@cluster.mongodb.net/superapp_staging?retryWrites=true&w=majority
```
*(Replace with your MongoDB connection string from Step 1.5)*

### 6.3 JWT Secret

Click **"Generate"** button next to `JWT_SECRET`  
Or manually:
```bash
JWT_SECRET=<64-character-hex-string>
JWT_EXPIRES_IN=7d
```

Generate manually:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### 6.4 Socket.io Configuration

```bash
ENABLE_SOCKET_IO=true
SOCKET_CORS_ORIGIN=https://your-frontend-url.com,http://localhost:3000
```
*(Add your actual frontend URL)*

### 6.5 Sentry (from Step 2.2)

```bash
SENTRY_DSN=https://xxxxx@oxxxxx.ingest.sentry.io/xxxxx
SENTRY_ENVIRONMENT=staging
SENTRY_TRACES_SAMPLE_RATE=0.2
```

### 6.6 Telegram (from Step 3)

```bash
TELEGRAM_BOT_TOKEN=1234567890:ABCdefGHIjklMNOpqrsTUVwxyz
TELEGRAM_ADMIN_CHAT_ID=123456789
TELEGRAM_ALERTS_ENABLED=true
```

### 6.7 Staging Features

```bash
IS_STAGING=true
DISABLE_REAL_PAYOUTS=true
ENABLE_COIN_FAUCET=true
STAGING_FAUCET_AMOUNT=10000
```

### 6.8 PM2 Configuration

```bash
PM2_INSTANCES=2
```

### 6.9 Logging

```bash
LOG_LEVEL=debug
LOG_MAX_FILES=7
LOG_MAX_SIZE=10m
```

### 6.10 Rate Limiting

```bash
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=200
```

Click **"Save Changes"**

---

## Step 7: Deploy

### 7.1 Trigger First Deployment

If auto-deploy is enabled and you've pushed to `staging`:
- Deployment starts automatically
- Watch logs in Render dashboard

Manual trigger:
- Click **"Manual Deploy"** → **"Deploy latest commit"**

### 7.2 Monitor Deployment

1. Go to **"Logs"** tab
2. Watch build process:
   ```
   Building Dockerfile...
   Installing dependencies...
   Starting PM2...
   Server started on port 5000
   ```

### 7.3 Expected Duration

- **First deployment**: 5-10 minutes
- **Subsequent deploys**: 2-5 minutes

---

## Step 8: Verify Deployment

### 8.1 Health Check

Open in browser:
```
https://superapp-backend-staging.onrender.com/api/health
```

Expected response:
```json
{
  "status": "healthy",
  "uptime": 123,
  "services": {
    "database": "connected"
  }
}
```

### 8.2 Check Telegram

You should receive startup notification:
```
🚀 Server Started

Environment: production
Time: 2025-11-25T10:00:00Z
Status: ✅ All systems operational
```

### 8.3 Test Staging Features

```bash
# Get staging info
curl https://superapp-backend-staging.onrender.com/api/staging/info

# Register test user (replace with your data)
curl -X POST https://superapp-backend-staging.onrender.com/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","email":"test@example.com","password":"Test123!@#"}'
```

---

## Step 9: Setup CI/CD (GitHub Actions)

### 9.1 Get Render Deploy Hook

1. Render Dashboard → **Settings** tab
2. Scroll to **"Deploy Hook"**
3. Copy URL:
   ```
   https://api.render.com/deploy/srv-xxxxx?key=xxxxx
   ```

### 9.2 Add GitHub Secrets

1. Go to your GitHub repository
2. **Settings** → **Secrets and variables** → **Actions**
3. Add secrets:

| Secret Name | Value |
|-------------|-------|
| `RENDER_DEPLOY_HOOK_STAGING` | *(Deploy hook from Step 9.1)* |
| `TELEGRAM_BOT_TOKEN` | *(Bot token from Step 3.1)* |
| `TELEGRAM_ADMIN_CHAT_ID` | *(Your user ID from Step 3.2)* |

### 9.3 Push to Staging

```bash
git checkout staging
git merge main
git push origin staging
```

GitHub Actions will:
1. Run tests
2. Build Docker image
3. Deploy to Render
4. Run health check
5. Send Telegram notification

---

## Step 10: Custom Domain (Optional)

### 10.1 Add Domain in Render

1. **Settings** → **Custom Domain**
2. Add your domain: `staging.superapp.com`
3. Copy CNAME target:
   ```
   superapp-backend-staging.onrender.com
   ```

### 10.2 Configure DNS

In your domain provider (Cloudflare, Namecheap, etc.):

| Type | Name | Value | TTL |
|------|------|-------|-----|
| CNAME | staging | superapp-backend-staging.onrender.com | Auto |

### 10.3 Enable SSL

- Render automatically provisions SSL (Let's Encrypt)
- Wait 5-10 minutes for DNS propagation
- Access: `https://staging.superapp.com`

---

## Troubleshooting

### Issue: Build Fails

**Error**: `npm install` fails

**Solution**:
```bash
# Check Node version in Dockerfile matches package.json engines
# Verify all dependencies are in package.json
```

### Issue: Database Connection Error

**Error**: `MongoNetworkError`

**Solution**:
- Verify MongoDB IP whitelist includes `0.0.0.0/0`
- Check `DATABASE_URI` format
- Test connection string locally first

### Issue: Health Check Fails

**Error**: `/api/health` returns 503

**Solution**:
```bash
# Check Render logs for errors
# Verify all environment variables are set
# Check MongoDB connection
```

### Issue: Telegram Not Sending

**Error**: No startup notification

**Solution**:
- Verify bot token is correct
- Check you've started the bot (`/start`)
- Verify chat ID is correct
- Check `TELEGRAM_ALERTS_ENABLED=true`

---

## Scaling & Performance

### Horizontal Scaling

Render Dashboard → **Settings**:
```
Min Instances: 1
Max Instances: 3
```

Scales automatically based on:
- CPU usage > 70%
- Memory usage > 80%

### Vertical Scaling

Upgrade instance type:
- **Starter**: 512MB RAM, 0.5 CPU
- **Standard**: 2GB RAM, 1 CPU
- **Pro**: 4GB RAM, 2 CPU

---

## Monitoring URLs

After deployment:

| Service | URL |
|---------|-----|
| **API** | `https://superapp-backend-staging.onrender.com` |
| **Health** | `https://superapp-backend-staging.onrender.com/api/health` |
| **Sentry** | `https://sentry.io/organizations/your-org/projects/superapp-staging/` |
| **Render Logs** | Render Dashboard → Logs tab |
| **Telegram Alerts** | Your bot chat |

---

## Cost Estimate

| Service | Plan | Cost/Month |
|---------|------|------------|
| Render Web Service | Starter | $7 |
| MongoDB Atlas | M0 (Free) | $0 |
| Sentry | Developer | $0 |
| Telegram Bot | Free | $0 |
| **Total** | | **$7/month** |

Free tier options:
- Render Free (sleeps after 15 min inactivity)
- Still good for testing!

---

## Next Steps

✅ Deployment complete!

Now:
1. Test all API endpoints
2. Run integration tests
3. Perform load testing
4. QA testing (see `STAGING_TEST_GUIDE.md`)
5. Monitor Sentry for errors
6. Check Telegram for alerts

---

## Support

**Render Docs**: https://render.com/docs  
**MongoDB Atlas**: https://docs.atlas.mongodb.com  
**Sentry**: https://docs.sentry.io  

**Issues**: Create GitHub issue  
**Questions**: Check Render community forum

---

**Last Updated**: November 25, 2025  
**Guide Version**: 1.0  
**Status**: ✅ Production Ready
