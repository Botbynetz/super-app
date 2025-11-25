/**
 * Rate Limiter Middleware
 * Tier-based rate limiting with memory store and Redis-ready architecture
 * 
 * Features:
 * - Memory-based store (default)
 * - Redis support (optional, graceful fallback)
 * - Tier-based limits (free, premium, admin)
 * - Per-endpoint custom limits
 * - Request tracking and analytics
 */

const { createClient } = require('redis');

/**
 * Memory store for rate limiting (default, no external dependencies)
 */
class MemoryStore {
  constructor() {
    this.store = new Map();
    this.cleanup();
  }

  async increment(key, windowMs) {
    const now = Date.now();
    const windowStart = now - windowMs;

    // Get or create entry
    let entry = this.store.get(key);
    if (!entry) {
      entry = { requests: [], expiresAt: now + windowMs };
      this.store.set(key, entry);
    }

    // Remove expired requests from this key's window
    entry.requests = entry.requests.filter(timestamp => timestamp > windowStart);
    
    // Add current request
    entry.requests.push(now);
    entry.expiresAt = now + windowMs;

    return entry.requests.length;
  }

  async reset(key) {
    this.store.delete(key);
  }

  async resetAll() {
    this.store.clear();
  }

  // Cleanup expired entries every 60 seconds
  cleanup() {
    setInterval(() => {
      const now = Date.now();
      for (const [key, entry] of this.store.entries()) {
        if (entry.expiresAt < now) {
          this.store.delete(key);
        }
      }
    }, 60000);
  }

  getStats() {
    return {
      keys: this.store.size,
      totalRequests: Array.from(this.store.values())
        .reduce((sum, entry) => sum + entry.requests.length, 0)
    };
  }
}

/**
 * Redis store for rate limiting (optional, for distributed systems)
 */
class RedisStore {
  constructor(redisClient) {
    this.client = redisClient;
    this.connected = false;
  }

  static async create(redisUrl) {
    try {
      const client = createClient({ url: redisUrl });
      
      client.on('error', (err) => {
        console.error('Redis Rate Limiter Error:', err);
      });

      await client.connect();
      const store = new RedisStore(client);
      store.connected = true;
      console.log('✅ Redis Rate Limiter connected');
      return store;
    } catch (error) {
      console.warn('⚠️  Redis unavailable, falling back to memory store:', error.message);
      return null;
    }
  }

  async increment(key, windowMs) {
    if (!this.connected) {
      throw new Error('Redis not connected');
    }

    const now = Date.now();
    const windowStart = now - windowMs;

    // Use Redis sorted set with timestamp as score
    const pipeline = this.client.multi();
    
    // Remove expired entries
    pipeline.zRemRangeByScore(key, 0, windowStart);
    
    // Add current request
    pipeline.zAdd(key, { score: now, value: `${now}:${Math.random()}` });
    
    // Count requests in window
    pipeline.zCard(key);
    
    // Set expiry
    pipeline.expire(key, Math.ceil(windowMs / 1000));

    const results = await pipeline.exec();
    
    // Return count (3rd command result)
    return results[2];
  }

  async reset(key) {
    if (this.connected) {
      await this.client.del(key);
    }
  }

  async resetAll() {
    if (this.connected) {
      await this.client.flushDb();
    }
  }

  async close() {
    if (this.connected) {
      await this.client.quit();
    }
  }
}

/**
 * Rate limit configuration by user tier
 */
const RATE_LIMITS = {
  free: {
    general: { windowMs: 15 * 60 * 1000, max: 100 },      // 100 req per 15 min
    wallet: { windowMs: 60 * 1000, max: 10 },              // 10 req per minute
    premium: { windowMs: 60 * 1000, max: 5 },              // 5 req per minute
    transfer: { windowMs: 60 * 1000, max: 3 },             // 3 req per minute
    auth: { windowMs: 15 * 60 * 1000, max: 20 },          // 20 req per 15 min
    search: { windowMs: 60 * 1000, max: 30 }               // 30 req per minute
  },
  premium: {
    general: { windowMs: 15 * 60 * 1000, max: 300 },      // 300 req per 15 min
    wallet: { windowMs: 60 * 1000, max: 30 },              // 30 req per minute
    premium: { windowMs: 60 * 1000, max: 20 },             // 20 req per minute
    transfer: { windowMs: 60 * 1000, max: 10 },            // 10 req per minute
    auth: { windowMs: 15 * 60 * 1000, max: 50 },          // 50 req per 15 min
    search: { windowMs: 60 * 1000, max: 100 }              // 100 req per minute
  },
  admin: {
    general: { windowMs: 15 * 60 * 1000, max: 1000 },     // 1000 req per 15 min
    wallet: { windowMs: 60 * 1000, max: 100 },             // 100 req per minute
    premium: { windowMs: 60 * 1000, max: 100 },            // 100 req per minute
    transfer: { windowMs: 60 * 1000, max: 50 },            // 50 req per minute
    auth: { windowMs: 15 * 60 * 1000, max: 200 },         // 200 req per 15 min
    search: { windowMs: 60 * 1000, max: 500 }              // 500 req per minute
  }
};

/**
 * Rate limiter class
 */
class RateLimiter {
  constructor(store) {
    this.store = store;
  }

  /**
   * Initialize rate limiter with optional Redis
   */
  static async initialize(redisUrl = null) {
    let store;

    if (redisUrl) {
      store = await RedisStore.create(redisUrl);
    }

    // Fallback to memory store if Redis unavailable
    if (!store) {
      store = new MemoryStore();
      console.log('✅ Memory-based rate limiter initialized');
    }

    return new RateLimiter(store);
  }

  /**
   * Get rate limit for user tier and endpoint
   */
  getLimit(userTier, endpoint = 'general') {
    const tier = RATE_LIMITS[userTier] || RATE_LIMITS.free;
    return tier[endpoint] || tier.general;
  }

  /**
   * Check if request is allowed
   */
  async checkLimit(identifier, userTier, endpoint = 'general') {
    const limit = this.getLimit(userTier, endpoint);
    const key = `ratelimit:${endpoint}:${identifier}`;

    try {
      const count = await this.store.increment(key, limit.windowMs);
      
      const allowed = count <= limit.max;
      const remaining = Math.max(0, limit.max - count);
      const resetAt = Date.now() + limit.windowMs;

      return {
        allowed,
        limit: limit.max,
        remaining,
        resetAt,
        resetIn: limit.windowMs / 1000, // seconds
        identifier,
        endpoint
      };
    } catch (error) {
      // On error, allow the request (fail open)
      console.error('Rate limiter error:', error);
      return {
        allowed: true,
        limit: limit.max,
        remaining: limit.max,
        resetAt: Date.now() + limit.windowMs,
        resetIn: limit.windowMs / 1000,
        identifier,
        endpoint,
        error: error.message
      };
    }
  }

  /**
   * Reset rate limit for a specific identifier
   */
  async reset(identifier, endpoint = 'general') {
    const key = `ratelimit:${endpoint}:${identifier}`;
    await this.store.reset(key);
  }

  /**
   * Get store statistics (for monitoring)
   */
  getStats() {
    if (this.store.getStats) {
      return this.store.getStats();
    }
    return { type: 'redis', connected: this.store.connected };
  }
}

// Global instance
let rateLimiterInstance = null;

/**
 * Initialize global rate limiter
 */
async function initializeRateLimiter(redisUrl = null) {
  if (!rateLimiterInstance) {
    rateLimiterInstance = await RateLimiter.initialize(redisUrl);
  }
  return rateLimiterInstance;
}

/**
 * Express middleware factory
 */
function createRateLimitMiddleware(endpoint = 'general', options = {}) {
  return async (req, res, next) => {
    try {
      // Initialize rate limiter if not already done
      if (!rateLimiterInstance) {
        await initializeRateLimiter(process.env.REDIS_URL);
      }

      // Determine identifier (user ID or IP)
      const identifier = req.user?.userId || req.ip || 'anonymous';
      
      // Determine user tier
      const userTier = req.user?.role === 'admin' ? 'admin' 
        : (req.user?.isPremium ? 'premium' : 'free');

      // Check rate limit
      const result = await rateLimiterInstance.checkLimit(identifier, userTier, endpoint);

      // Add rate limit headers
      res.setHeader('X-RateLimit-Limit', result.limit);
      res.setHeader('X-RateLimit-Remaining', result.remaining);
      res.setHeader('X-RateLimit-Reset', result.resetAt);

      if (!result.allowed) {
        // Rate limit exceeded
        const retryAfter = Math.ceil(result.resetIn);
        res.setHeader('Retry-After', retryAfter);

        return res.status(429).json({
          error: 'Too many requests',
          message: `Rate limit exceeded. Please try again in ${retryAfter} seconds.`,
          limit: result.limit,
          resetAt: new Date(result.resetAt).toISOString(),
          retryAfter
        });
      }

      // Attach rate limit info to request
      req.rateLimit = result;

      next();
    } catch (error) {
      // On error, log but allow request (fail open)
      console.error('Rate limit middleware error:', error);
      next();
    }
  };
}

/**
 * Admin endpoint to reset rate limits
 */
function createResetRateLimitHandler() {
  return async (req, res) => {
    try {
      const { identifier, endpoint } = req.body;

      if (!identifier) {
        return res.status(400).json({ error: 'Identifier required' });
      }

      await rateLimiterInstance.reset(identifier, endpoint);

      res.json({
        success: true,
        message: 'Rate limit reset successfully',
        identifier,
        endpoint: endpoint || 'all'
      });
    } catch (error) {
      res.status(500).json({
        error: 'Failed to reset rate limit',
        message: error.message
      });
    }
  };
}

/**
 * Admin endpoint to get rate limit stats
 */
function getRateLimitStats() {
  return (req, res) => {
    try {
      const stats = rateLimiterInstance.getStats();
      res.json({
        success: true,
        stats,
        endpoints: Object.keys(RATE_LIMITS.free),
        tiers: Object.keys(RATE_LIMITS)
      });
    } catch (error) {
      res.status(500).json({
        error: 'Failed to get stats',
        message: error.message
      });
    }
  };
}

module.exports = {
  RateLimiter,
  MemoryStore,
  RedisStore,
  initializeRateLimiter,
  createRateLimitMiddleware,
  createResetRateLimitHandler,
  getRateLimitStats,
  RATE_LIMITS
};
