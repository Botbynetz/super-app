/**
 * Unit Tests for Rate Limiter Middleware
 */

const { RateLimiter, MemoryStore, createRateLimitMiddleware } = require('../../../middleware/rateLimiter');

describe('RateLimiter', () => {
  let rateLimiter;

  beforeEach(async () => {
    const store = new MemoryStore();
    rateLimiter = new RateLimiter(store);
  });

  describe('Memory Store', () => {
    test('should increment request count', async () => {
      const result = await rateLimiter.checkLimit('user1', 'free', 'general');
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(99); // 100 - 1
    });

    test('should enforce rate limit', async () => {
      // Make 100 requests (the limit)
      for (let i = 0; i < 100; i++) {
        await rateLimiter.checkLimit('user1', 'free', 'general');
      }

      // 101st request should be blocked
      const result = await rateLimiter.checkLimit('user1', 'free', 'general');
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });

    test('should apply tier-based limits', async () => {
      // Free tier: 100 requests per 15 min
      const freeResult = await rateLimiter.checkLimit('user1', 'free', 'general');
      expect(freeResult.limit).toBe(100);

      // Premium tier: 300 requests per 15 min
      const premiumResult = await rateLimiter.checkLimit('user2', 'premium', 'general');
      expect(premiumResult.limit).toBe(300);

      // Admin tier: 1000 requests per 15 min
      const adminResult = await rateLimiter.checkLimit('user3', 'admin', 'general');
      expect(adminResult.limit).toBe(1000);
    });

    test('should apply endpoint-specific limits', async () => {
      // General endpoint: 100 req/15min
      const generalResult = await rateLimiter.checkLimit('user1', 'free', 'general');
      expect(generalResult.limit).toBe(100);

      // Wallet endpoint: 10 req/min
      const walletResult = await rateLimiter.checkLimit('user1', 'free', 'wallet');
      expect(walletResult.limit).toBe(10);

      // Transfer endpoint: 3 req/min
      const transferResult = await rateLimiter.checkLimit('user1', 'free', 'transfer');
      expect(transferResult.limit).toBe(3);
    });

    test('should reset count after reset call', async () => {
      // Make some requests
      await rateLimiter.checkLimit('user1', 'free', 'general');
      await rateLimiter.checkLimit('user1', 'free', 'general');
      await rateLimiter.checkLimit('user1', 'free', 'general');

      let result = await rateLimiter.checkLimit('user1', 'free', 'general');
      expect(result.remaining).toBe(96); // 100 - 4

      // Reset
      await rateLimiter.reset('user1', 'general');

      // Check again - should be reset
      result = await rateLimiter.checkLimit('user1', 'free', 'general');
      expect(result.remaining).toBe(99); // Back to 100 - 1
    });

    test('should track separate counters per endpoint', async () => {
      // Request to general endpoint
      await rateLimiter.checkLimit('user1', 'free', 'general');
      const generalResult = await rateLimiter.checkLimit('user1', 'free', 'general');
      expect(generalResult.remaining).toBe(98);

      // Request to wallet endpoint - should have separate counter
      const walletResult = await rateLimiter.checkLimit('user1', 'free', 'wallet');
      expect(walletResult.remaining).toBe(9); // Fresh counter
    });

    test('should provide accurate reset time', async () => {
      const beforeTime = Date.now();
      const result = await rateLimiter.checkLimit('user1', 'free', 'general');
      const afterTime = Date.now();

      // Reset time should be in the future (within window)
      expect(result.resetAt).toBeGreaterThan(beforeTime);
      expect(result.resetAt).toBeLessThan(afterTime + (15 * 60 * 1000)); // Within 15 min
    });
  });

  describe('Express Middleware', () => {
    test('should add rate limit headers', async () => {
      const middleware = createRateLimitMiddleware('general');
      
      const req = {
        user: { userId: 'test123', role: 'user' },
        ip: '127.0.0.1'
      };
      
      const res = {
        setHeader: jest.fn(),
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      
      const next = jest.fn();

      await middleware(req, res, next);

      expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', expect.any(Number));
      expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', expect.any(Number));
      expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Reset', expect.any(Number));
      expect(next).toHaveBeenCalled();
    });

    test('should block when rate limit exceeded', async () => {
      const middleware = createRateLimitMiddleware('transfer'); // Only 3 req/min for free tier
      
      const req = {
        user: { userId: 'test123', role: 'user' },
        ip: '127.0.0.1'
      };
      
      const res = {
        setHeader: jest.fn(),
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      
      const next = jest.fn();

      // Make 3 requests (the limit)
      await middleware(req, res, next);
      await middleware(req, res, next);
      await middleware(req, res, next);

      // 4th request should be blocked
      await middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(429);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Too many requests'
        })
      );
    });

    test('should use IP address when user not authenticated', async () => {
      const middleware = createRateLimitMiddleware('general');
      
      const req = {
        ip: '192.168.1.1'
      };
      
      const res = {
        setHeader: jest.fn(),
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      
      const next = jest.fn();

      await middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.rateLimit).toBeDefined();
    });

    test('should fail open on error', async () => {
      // Create middleware with invalid store
      const middleware = createRateLimitMiddleware('general');
      
      const req = {
        user: null,
        ip: null // Will cause error
      };
      
      const res = {
        setHeader: jest.fn(),
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      
      const next = jest.fn();

      // Should not throw and should call next
      await middleware(req, res, next);
      expect(next).toHaveBeenCalled();
    });
  });

  describe('Store Statistics', () => {
    test('should provide store statistics', () => {
      const stats = rateLimiter.getStats();
      
      expect(stats).toHaveProperty('type');
      expect(stats).toHaveProperty('keys');
      expect(stats).toHaveProperty('totalRequests');
    });
  });

  describe('Concurrent Requests', () => {
    test('should handle concurrent requests correctly', async () => {
      const promises = [];
      
      // Make 10 concurrent requests
      for (let i = 0; i < 10; i++) {
        promises.push(rateLimiter.checkLimit('user1', 'free', 'general'));
      }

      const results = await Promise.all(promises);

      // All should be allowed (under limit)
      expect(results.every(r => r.allowed)).toBe(true);

      // Check final count
      const finalResult = await rateLimiter.checkLimit('user1', 'free', 'general');
      expect(finalResult.remaining).toBe(89); // 100 - 11 (10 + 1)
    });
  });
});
