# ===================================
# PHASE 6 - Multi-Stage Dockerfile
# Optimized for Render deployment
# ===================================

# ========== Stage 1: Builder ==========
FROM node:18-alpine AS builder

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache python3 make g++

# Copy package files
COPY backend/package*.json ./

# Install dependencies (including dev for build)
RUN npm ci --only=production && npm cache clean --force

# ========== Stage 2: Production ==========
FROM node:18-alpine

# Install PM2 globally for process management
RUN npm install -g pm2

# Create app user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

WORKDIR /app

# Copy dependencies from builder
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules

# Copy application code
COPY --chown=nodejs:nodejs backend/ ./

# Create logs directory
RUN mkdir -p /app/logs && chown -R nodejs:nodejs /app/logs

# Expose ports
EXPOSE 5000

# Switch to non-root user
USER nodejs

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:5000/api/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start with PM2 in cluster mode
CMD ["pm2-runtime", "start", "ecosystem.config.js", "--env", "production"]
