# 🔄 CI/CD PIPELINE GUIDE

Automated deployment pipeline with GitHub Actions for staging environment.

---

## Pipeline Overview

```
Push to staging → Tests → Security Scan → Docker Build → Deploy → Health Check → Notify
```

**Workflow File**: `.github/workflows/staging-deploy.yml`

---

## Pipeline Stages

### 1️⃣ Test Stage (3-5 minutes)

**What it does**:
- Sets up MongoDB test container
- Installs dependencies
- Runs linter (if configured)
- Runs unit tests
- Runs integration tests
- Uploads coverage to Codecov

**Trigger**: Every push to `staging` branch and PRs

### 2️⃣ Security Stage (2-3 minutes)

**What it does**:
- npm audit for vulnerable dependencies
- Trivy scanner for security issues
- Uploads results to GitHub Security

**Thresholds**:
- Blocks on critical/high vulnerabilities
- Warns on moderate

### 3️⃣ Build Stage (4-6 minutes)

**What it does**:
- Builds Docker image
- Caches layers for faster builds
- Tests Docker container starts
- Validates health endpoint

### 4️⃣ Deploy Stage (2-4 minutes)

**What it does**:
- Triggers Render deployment
- Waits 60s for deployment
- Runs health checks (10 retries, 15s interval)
- Rolls back on failure

**Only runs on**: Direct push to `staging` (not PRs)

### 5️⃣ Post-Deploy Tests (1-2 minutes)

**What it does**:
- Runs smoke tests against live API
- Tests Socket.io connection
- Verifies critical endpoints

---

## GitHub Secrets Required

Configure in **Settings** → **Secrets and variables** → **Actions**:

| Secret | Description | How to Get |
|--------|-------------|------------|
| `RENDER_DEPLOY_HOOK_STAGING` | Render deploy webhook | Render Dashboard → Settings → Deploy Hook |
| `TELEGRAM_BOT_TOKEN` | Bot token for notifications | @BotFather on Telegram |
| `TELEGRAM_ADMIN_CHAT_ID` | Your Telegram user ID | @userinfobot on Telegram |
| `RENDER_ROLLBACK_HOOK` | Rollback webhook (optional) | Render Dashboard (if available) |

---

## How to Trigger Deployment

### Automatic Deployment

```bash
# 1. Make changes
git checkout staging
git merge main

# 2. Push to staging
git push origin staging

# 3. Watch GitHub Actions
# Go to: https://github.com/Botbynetz/super-app/actions
```

### Manual Deployment

```bash
# Trigger via GitHub CLI
gh workflow run staging-deploy.yml

# Or via GitHub UI
# Actions tab → Select "Staging Deployment Pipeline" → "Run workflow"
```

---

## Deployment Flow Diagram

```
┌──────────────────┐
│  Developer Push  │
│   to staging     │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  GitHub Actions  │
│     Triggered    │
└────────┬─────────┘
         │
         ├─────────────────┐
         │                 │
         ▼                 ▼
┌────────────────┐  ┌─────────────────┐
│  Run Tests     │  │ Security Scan   │
│  • Unit        │  │ • npm audit     │
│  • Integration │  │ • Trivy         │
└────────┬───────┘  └────────┬────────┘
         │                   │
         └─────────┬─────────┘
                   │
                   ▼
         ┌─────────────────┐
         │  Build Docker   │
         │     Image       │
         └────────┬────────┘
                  │
                  ▼
         ┌─────────────────┐
         │  Trigger Render │
         │   Deployment    │
         └────────┬────────┘
                  │
                  ▼
         ┌─────────────────┐
         │  Wait 60s       │
         │  for Deploy     │
         └────────┬────────┘
                  │
                  ▼
         ┌─────────────────┐
         │  Health Check   │
         │  (10 retries)   │
         └────────┬────────┘
                  │
         ┌────────┴────────┐
         │                 │
    ✅ Success        ❌ Failure
         │                 │
         ▼                 ▼
┌─────────────────┐ ┌──────────────────┐
│ Send Telegram   │ │ Rollback + Alert │
│ Success Alert   │ │ Telegram         │
└─────────────────┘ └──────────────────┘
```

---

## Pipeline Status Checks

### Success Criteria

✅ All tests pass (unit + integration)  
✅ No critical/high security vulnerabilities  
✅ Docker image builds successfully  
✅ Health check returns 200 status  
✅ Socket.io connection works  

### Failure Scenarios

❌ **Tests fail** → Deployment blocked  
❌ **Security issues** → Deployment blocked  
❌ **Docker build fails** → Deployment blocked  
❌ **Health check fails** → Auto-rollback triggered  

---

## Rollback Process

### Automatic Rollback

If health checks fail after deployment:
1. Pipeline detects failure
2. Calls rollback webhook
3. Sends Telegram alert
4. Previous version restored

### Manual Rollback

In Render Dashboard:
```
Settings → Rollback → Select previous deployment
```

Or via webhook:
```bash
curl -X POST "$RENDER_ROLLBACK_HOOK"
```

---

## Monitoring Pipeline

### View Logs

**GitHub Actions**:
```
Repository → Actions → Select workflow run
```

**Render Deployment**:
```
Render Dashboard → Logs tab
```

### Telegram Notifications

You'll receive:
- ✅ Deployment success
- ❌ Deployment failure
- ⚠️ Rollback triggered

Example success message:
```
✅ Staging deployment successful!
Branch: staging
Commit: abc123
Author: yourname
```

---

## Pipeline Configuration

### Customize Node Version

Edit `.github/workflows/staging-deploy.yml`:

```yaml
env:
  NODE_VERSION: '18.x'  # Change to 20.x if needed
```

### Adjust Health Check Retries

```yaml
MAX_RETRIES=10  # Increase if deployment takes longer
```

### Modify Test Commands

```yaml
- name: Run unit tests
  run: npm test  # Change to your test command
```

---

## Performance Optimization

### Cache Dependencies

Already configured:
```yaml
- uses: actions/setup-node@v4
  with:
    cache: 'npm'
```

### Docker Layer Caching

Already configured:
```yaml
- uses: docker/build-push-action@v5
  with:
    cache-from: type=gha
    cache-to: type=gha,mode=max
```

**Result**: 50-70% faster builds after first run

---

## Debugging Failed Deployments

### Check Pipeline Logs

1. Go to GitHub Actions
2. Select failed workflow
3. Expand failed step
4. Review error messages

### Common Issues

**Issue**: Tests fail
```bash
# Run tests locally first
npm test
npm run test:integration
```

**Issue**: Docker build fails
```bash
# Test Docker build locally
docker build -t test-build .
```

**Issue**: Health check times out
```bash
# Check Render logs
# Verify DATABASE_URI is correct
# Ensure MongoDB is accessible
```

---

## Branch Protection

Recommended settings for `staging` branch:

**Settings** → **Branches** → **Add rule**:

- ✅ Require pull request before merging
- ✅ Require status checks to pass
  - `test` (Run Tests)
  - `security` (Security Scan)
  - `build` (Build Docker Image)
- ✅ Require branches to be up to date

---

## Cost Optimization

### GitHub Actions Minutes

**Free tier**: 2,000 minutes/month

Average pipeline: ~15 minutes

**Max deploys/month**: ~130 deployments

### Reduce Usage

1. Skip tests on non-code changes:
```yaml
on:
  push:
    paths-ignore:
      - '**.md'
      - 'docs/**'
```

2. Cancel in-progress runs:
```yaml
concurrency:
  group: staging-deploy
  cancel-in-progress: true
```

---

## Best Practices

✅ **Always test locally** before pushing  
✅ **Write meaningful commit messages** for tracking  
✅ **Monitor Telegram** for deployment status  
✅ **Check Sentry** after deployment for errors  
✅ **Run smoke tests** manually after deployment  

---

## Troubleshooting Commands

```bash
# View workflow runs
gh run list --workflow=staging-deploy.yml

# View specific run
gh run view <run-id>

# Re-run failed workflow
gh run rerun <run-id>

# Watch logs in real-time
gh run watch
```

---

## Next Steps

After successful deployment:
1. ✅ Monitor Sentry dashboard
2. ✅ Check Telegram for alerts
3. ✅ Run manual smoke tests
4. ✅ Perform QA testing
5. ✅ Run load tests

---

**Last Updated**: November 25, 2025  
**Pipeline Version**: 1.0  
**Status**: ✅ Production Ready
