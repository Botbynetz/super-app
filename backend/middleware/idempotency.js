/**
 * Idempotency Middleware
 * Prevents duplicate transaction processing using idempotency keys
 * 
 * Features:
 * - Idempotency key validation
 * - Request deduplication
 * - TTL-based cleanup
 * - Memory and Redis support
 * - Automatic response caching
 */

const crypto = require('crypto');
const { createClient } = require('redis');

/**
 * Memory store for idempotency (default)
 */
class MemoryIdempotencyStore {
  constructor() {
    this.store = new Map();
    this.cleanup();
  }

  async set(key, value, ttlSeconds = 86400) { // 24 hours default
    const expiresAt = Date.now() + (ttlSeconds * 1000);
    this.store.set(key, { value, expiresAt });
  }

  async get(key) {
    const entry = this.store.get(key);
    if (!entry) return null;
    
    if (entry.expiresAt < Date.now()) {
      this.store.delete(key);
      return null;
    }
    
    return entry.value;
  }

  async delete(key) {
    this.store.delete(key);
  }

  async exists(key) {
    const entry = this.store.get(key);
    if (!entry) return false;
    
    if (entry.expiresAt < Date.now()) {
      this.store.delete(key);
      return false;
    }
    
    return true;
  }

  // Cleanup expired entries every 5 minutes
  cleanup() {
    setInterval(() => {
      const now = Date.now();
      for (const [key, entry] of this.store.entries()) {
        if (entry.expiresAt < now) {
          this.store.delete(key);
        }
      }
    }, 300000); // 5 minutes
  }

  getStats() {
    return {
      type: 'memory',
      keys: this.store.size,
      activeRequests: Array.from(this.store.values())
        .filter(entry => entry.expiresAt > Date.now()).length
    };
  }
}

/**
 * Redis store for idempotency (optional, for distributed systems)
 */
class RedisIdempotencyStore {
  constructor(redisClient) {
    this.client = redisClient;
    this.connected = false;
  }

  static async create(redisUrl) {
    try {
      const client = createClient({ url: redisUrl });
      
      client.on('error', (err) => {
        console.error('Redis Idempotency Error:', err);
      });

      await client.connect();
      const store = new RedisIdempotencyStore(client);
      store.connected = true;
      console.log('✅ Redis Idempotency store connected');
      return store;
    } catch (error) {
      console.warn('⚠️  Redis unavailable for idempotency, falling back to memory:', error.message);
      return null;
    }
  }

  async set(key, value, ttlSeconds = 86400) {
    if (!this.connected) {
      throw new Error('Redis not connected');
    }
    
    const serialized = JSON.stringify(value);
    await this.client.setEx(key, ttlSeconds, serialized);
  }

  async get(key) {
    if (!this.connected) {
      throw new Error('Redis not connected');
    }
    
    const data = await this.client.get(key);
    return data ? JSON.parse(data) : null;
  }

  async delete(key) {
    if (this.connected) {
      await this.client.del(key);
    }
  }

  async exists(key) {
    if (!this.connected) return false;
    return await this.client.exists(key) === 1;
  }

  async close() {
    if (this.connected) {
      await this.client.quit();
    }
  }

  getStats() {
    return {
      type: 'redis',
      connected: this.connected
    };
  }
}

/**
 * Idempotency manager
 */
class IdempotencyManager {
  constructor(store, options = {}) {
    this.store = store;
    this.ttl = options.ttl || 86400; // 24 hours default
    this.header = options.header || 'Idempotency-Key';
    this.methods = options.methods || ['POST', 'PUT', 'PATCH', 'DELETE'];
  }

  /**
   * Initialize idempotency manager
   */
  static async initialize(redisUrl = null, options = {}) {
    let store;

    if (redisUrl) {
      store = await RedisIdempotencyStore.create(redisUrl);
    }

    // Fallback to memory store
    if (!store) {
      store = new MemoryIdempotencyStore();
      console.log('✅ Memory-based idempotency store initialized');
    }

    return new IdempotencyManager(store, options);
  }

  /**
   * Generate idempotency key from request
   */
  generateKey(req) {
    const data = JSON.stringify({
      method: req.method,
      path: req.path,
      user: req.user?.userId,
      body: req.body,
      timestamp: Date.now()
    });
    
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Store request processing status
   */
  async storeRequest(key, status, data = null) {
    const entry = {
      key,
      status, // 'processing', 'completed', 'failed'
      data,
      timestamp: Date.now()
    };
    
    await this.store.set(key, entry, this.ttl);
    return entry;
  }

  /**
   * Get stored request
   */
  async getRequest(key) {
    return await this.store.get(key);
  }

  /**
   * Complete request
   */
  async completeRequest(key, responseData) {
    const entry = {
      key,
      status: 'completed',
      response: responseData,
      completedAt: Date.now()
    };
    
    await this.store.set(key, entry, this.ttl);
    return entry;
  }

  /**
   * Fail request
   */
  async failRequest(key, error) {
    const entry = {
      key,
      status: 'failed',
      error: error.message || error,
      failedAt: Date.now()
    };
    
    await this.store.set(key, entry, this.ttl);
    return entry;
  }

  /**
   * Delete idempotency record
   */
  async deleteRequest(key) {
    await this.store.delete(key);
  }

  /**
   * Check if request is idempotent
   */
  async isIdempotent(req) {
    // Only check for specified HTTP methods
    if (!this.methods.includes(req.method)) {
      return { idempotent: false, reason: 'method_not_applicable' };
    }

    // Get idempotency key from header
    const key = req.headers[this.header.toLowerCase()];
    
    if (!key) {
      return { idempotent: false, reason: 'no_key' };
    }

    // Check if request exists
    const existing = await this.getRequest(key);
    
    if (!existing) {
      return { idempotent: false, reason: 'new_request', key };
    }

    return { 
      idempotent: true, 
      existing, 
      key,
      status: existing.status
    };
  }

  /**
   * Get store statistics
   */
  getStats() {
    return this.store.getStats();
  }
}

// Global instance
let idempotencyManagerInstance = null;

/**
 * Initialize global idempotency manager
 */
async function initializeIdempotency(redisUrl = null, options = {}) {
  if (!idempotencyManagerInstance) {
    idempotencyManagerInstance = await IdempotencyManager.initialize(redisUrl, options);
  }
  return idempotencyManagerInstance;
}

/**
 * Express middleware for idempotency
 */
function createIdempotencyMiddleware(options = {}) {
  return async (req, res, next) => {
    try {
      // Initialize if not already done
      if (!idempotencyManagerInstance) {
        await initializeIdempotency(process.env.REDIS_URL, options);
      }

      const manager = idempotencyManagerInstance;

      // Check if request should be checked for idempotency
      const check = await manager.isIdempotent(req);

      if (!check.idempotent) {
        // New request or not applicable
        if (check.key) {
          // Store as processing
          await manager.storeRequest(check.key, 'processing');
          req.idempotencyKey = check.key;
          
          // Intercept response to store result
          const originalJson = res.json.bind(res);
          res.json = async function(data) {
            await manager.completeRequest(check.key, {
              status: res.statusCode,
              data
            });
            return originalJson(data);
          };

          // Handle errors
          res.on('finish', async () => {
            if (res.statusCode >= 400 && req.idempotencyKey) {
              await manager.failRequest(req.idempotencyKey, {
                status: res.statusCode,
                message: 'Request failed'
              });
            }
          });
        }
        
        return next();
      }

      // Request is idempotent (duplicate)
      const { existing, key } = check;

      if (existing.status === 'processing') {
        // Request is currently being processed
        return res.status(409).json({
          error: 'Request in progress',
          message: 'This request is currently being processed. Please wait.',
          idempotencyKey: key,
          requestedAt: new Date(existing.timestamp).toISOString()
        });
      }

      if (existing.status === 'completed') {
        // Return cached response
        const response = existing.response || {};
        return res.status(response.status || 200).json({
          ...response.data,
          _idempotent: true,
          _cachedAt: new Date(existing.completedAt).toISOString()
        });
      }

      if (existing.status === 'failed') {
        // Previous request failed, allow retry
        await manager.storeRequest(key, 'processing');
        req.idempotencyKey = key;
        return next();
      }

      // Unknown status, allow request
      next();

    } catch (error) {
      // On error, log but allow request (fail open)
      console.error('Idempotency middleware error:', error);
      next();
    }
  };
}

/**
 * Middleware to require idempotency key
 */
function requireIdempotencyKey(options = {}) {
  const header = options.header || 'Idempotency-Key';
  
  return (req, res, next) => {
    const key = req.headers[header.toLowerCase()];
    
    if (!key) {
      return res.status(400).json({
        error: 'Idempotency key required',
        message: `Please provide an '${header}' header with a unique value.`,
        example: `${header}: ${crypto.randomUUID()}`
      });
    }

    // Validate key format (UUID or hex string)
    const isValidUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(key);
    const isValidHex = /^[0-9a-f]{32,}$/i.test(key);
    
    if (!isValidUUID && !isValidHex) {
      return res.status(400).json({
        error: 'Invalid idempotency key format',
        message: 'Key must be a UUID or hex string (min 32 characters)',
        received: key
      });
    }

    req.idempotencyKey = key;
    next();
  };
}

/**
 * Admin endpoint to delete idempotency record
 */
function createDeleteIdempotencyHandler() {
  return async (req, res) => {
    try {
      const { key } = req.params;

      if (!key) {
        return res.status(400).json({ error: 'Idempotency key required' });
      }

      await idempotencyManagerInstance.deleteRequest(key);

      res.json({
        success: true,
        message: 'Idempotency record deleted',
        key
      });
    } catch (error) {
      res.status(500).json({
        error: 'Failed to delete record',
        message: error.message
      });
    }
  };
}

/**
 * Admin endpoint to get idempotency stats
 */
function getIdempotencyStats() {
  return (req, res) => {
    try {
      const stats = idempotencyManagerInstance.getStats();
      res.json({
        success: true,
        stats,
        ttl: idempotencyManagerInstance.ttl,
        header: idempotencyManagerInstance.header
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
  IdempotencyManager,
  MemoryIdempotencyStore,
  RedisIdempotencyStore,
  initializeIdempotency,
  createIdempotencyMiddleware,
  requireIdempotencyKey,
  createDeleteIdempotencyHandler,
  getIdempotencyStats
};
