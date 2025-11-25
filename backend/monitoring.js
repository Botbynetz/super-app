/**
 * PHASE 6 - Monitoring & Observability Module
 * Integrates Sentry, PM2 metrics, and custom telemetry
 */

const Sentry = require('@sentry/node');
const { ProfilingIntegration } = require('@sentry/profiling-node');

/**
 * Initialize Sentry error tracking
 */
function initializeSentry(app) {
  if (!process.env.SENTRY_DSN) {
    console.warn('⚠️  Sentry DSN not configured, error tracking disabled');
    return;
  }

  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || 'development',
    
    // Performance Monitoring
    tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE) || 0.1,
    
    // Profiling
    profilesSampleRate: parseFloat(process.env.SENTRY_PROFILES_SAMPLE_RATE) || 0.1,
    integrations: [
      new Sentry.Integrations.Http({ tracing: true }),
      new Sentry.Integrations.Express({ app }),
      new Sentry.Integrations.Mongo(),
      new ProfilingIntegration(),
    ],
    
    // Filter sensitive data
    beforeSend(event, hint) {
      // Remove sensitive headers
      if (event.request?.headers) {
        delete event.request.headers.authorization;
        delete event.request.headers.cookie;
      }
      
      // Remove sensitive body data
      if (event.request?.data) {
        if (typeof event.request.data === 'object') {
          delete event.request.data.password;
          delete event.request.data.token;
          delete event.request.data.secret;
        }
      }
      
      return event;
    },
    
    // Ignore common non-critical errors
    ignoreErrors: [
      'ECONNABORTED',
      'ENOTFOUND',
      'ETIMEDOUT',
      'Network request failed',
    ],
  });

  // Request handlers must be first middleware
  app.use(Sentry.Handlers.requestHandler());
  app.use(Sentry.Handlers.tracingHandler());

  console.log('✅ Sentry error tracking initialized');
}

/**
 * Initialize PM2 metrics (if PM2 Plus is configured)
 */
function initializePM2Metrics() {
  if (process.env.PM2_PUBLIC_KEY && process.env.PM2_SECRET_KEY) {
    try {
      const io = require('@pm2/io');
      
      io.init({
        publicKey: process.env.PM2_PUBLIC_KEY,
        secretKey: process.env.PM2_SECRET_KEY,
        appName: 'superapp-backend',
      });

      // Custom metrics
      const activeConnections = io.metric({
        name: 'Active Connections',
        unit: 'connections',
      });

      const walletTransactions = io.counter({
        name: 'Wallet Transactions',
      });

      const premiumUnlocks = io.counter({
        name: 'Premium Unlocks',
      });

      const activeSubscriptions = io.metric({
        name: 'Active Subscriptions',
        unit: 'subs',
      });

      console.log('✅ PM2 Plus metrics initialized');

      // Export metrics for use in routes
      return {
        activeConnections,
        walletTransactions,
        premiumUnlocks,
        activeSubscriptions,
      };
    } catch (err) {
      console.warn('⚠️  PM2 Plus not available:', err.message);
      return null;
    }
  } else {
    console.log('ℹ️  PM2 Plus not configured (optional)');
    return null;
  }
}

/**
 * Custom telemetry tracker for business metrics
 */
class TelemetryTracker {
  constructor() {
    this.metrics = {
      totalRevenue: 0,
      totalTransactions: 0,
      activeUsers: new Set(),
      premiumUnlocks: 0,
      subscriptionPurchases: 0,
      giftsSent: 0,
      fraudAlerts: 0,
      errors: 0,
      requestCount: 0,
      averageResponseTime: 0,
    };
    
    this.responseTimes = [];
    this.resetInterval = null;
    
    // Reset daily metrics at midnight
    this.scheduleReset();
  }

  scheduleReset() {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    
    const timeUntilMidnight = tomorrow - now;
    
    this.resetInterval = setTimeout(() => {
      this.resetDailyMetrics();
      this.scheduleReset(); // Schedule next reset
    }, timeUntilMidnight);
  }

  resetDailyMetrics() {
    console.log('📊 Resetting daily telemetry metrics');
    this.metrics.requestCount = 0;
    this.metrics.errors = 0;
    this.responseTimes = [];
    this.metrics.averageResponseTime = 0;
  }

  trackRequest(responseTime) {
    this.metrics.requestCount++;
    this.responseTimes.push(responseTime);
    
    // Keep only last 1000 response times
    if (this.responseTimes.length > 1000) {
      this.responseTimes.shift();
    }
    
    // Calculate average
    const sum = this.responseTimes.reduce((a, b) => a + b, 0);
    this.metrics.averageResponseTime = Math.round(sum / this.responseTimes.length);
  }

  trackError() {
    this.metrics.errors++;
  }

  trackUser(userId) {
    this.metrics.activeUsers.add(userId);
  }

  trackRevenue(amount) {
    this.metrics.totalRevenue += amount;
    this.metrics.totalTransactions++;
  }

  trackPremiumUnlock() {
    this.metrics.premiumUnlocks++;
  }

  trackSubscription() {
    this.metrics.subscriptionPurchases++;
  }

  trackGift() {
    this.metrics.giftsSent++;
  }

  trackFraudAlert() {
    this.metrics.fraudAlerts++;
  }

  getMetrics() {
    return {
      ...this.metrics,
      activeUsers: this.metrics.activeUsers.size,
    };
  }

  getSnapshot() {
    return {
      timestamp: new Date(),
      metrics: this.getMetrics(),
      system: {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        cpu: process.cpuUsage(),
      },
    };
  }
}

// Global telemetry instance
const telemetry = new TelemetryTracker();

/**
 * Error handler middleware (must be last)
 */
function sentryErrorHandler() {
  return Sentry.Handlers.errorHandler({
    shouldHandleError(error) {
      // Capture all errors with status >= 500
      if (error.status >= 500) {
        return true;
      }
      // Also capture specific error types
      if (error.name === 'MongoError' || error.name === 'ValidationError') {
        return true;
      }
      return false;
    },
  });
}

/**
 * Middleware to track request metrics
 */
function telemetryMiddleware(req, res, next) {
  const startTime = Date.now();
  
  // Track user
  if (req.user && req.user.id) {
    telemetry.trackUser(req.user.id);
  }
  
  // Track response time
  res.on('finish', () => {
    const responseTime = Date.now() - startTime;
    telemetry.trackRequest(responseTime);
    
    // Track errors
    if (res.statusCode >= 500) {
      telemetry.trackError();
    }
  });
  
  next();
}

/**
 * Capture exception helper
 */
function captureException(error, context = {}) {
  console.error('❌ Error captured:', error);
  
  telemetry.trackError();
  
  if (process.env.SENTRY_DSN) {
    Sentry.captureException(error, {
      contexts: context,
    });
  }
}

/**
 * Capture message helper
 */
function captureMessage(message, level = 'info', context = {}) {
  if (process.env.SENTRY_DSN) {
    Sentry.captureMessage(message, {
      level,
      contexts: context,
    });
  }
}

module.exports = {
  initializeSentry,
  initializePM2Metrics,
  sentryErrorHandler,
  telemetryMiddleware,
  telemetry,
  captureException,
  captureMessage,
  TelemetryTracker,
};
