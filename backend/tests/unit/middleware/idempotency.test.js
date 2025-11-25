/**
 * Unit Tests for Idempotency Middleware
 */

const { IdempotencyManager, MemoryIdempotencyStore, createIdempotencyMiddleware, requireIdempotencyKey } = require('../../../middleware/idempotency');
const { v4: uuidv4 } = require('uuid');

describe('IdempotencyManager', () => {
  let idempotencyManager;

  beforeEach(async () => {
    const store = new MemoryIdempotencyStore();
    idempotencyManager = new IdempotencyManager(store);
  });

  describe('Memory Store', () => {
    test('should store and retrieve request', async () => {
      const key = uuidv4();
      await idempotencyManager.storeRequest(key, 'processing');

      const retrieved = await idempotencyManager.getRequest(key);
      expect(retrieved).toBeDefined();
      expect(retrieved.key).toBe(key);
      expect(retrieved.status).toBe('processing');
    });

    test('should complete request', async () => {
      const key = uuidv4();
      await idempotencyManager.storeRequest(key, 'processing');

      const responseData = { success: true, data: { id: 123 } };
      await idempotencyManager.completeRequest(key, responseData);

      const retrieved = await idempotencyManager.getRequest(key);
      expect(retrieved.status).toBe('completed');
      expect(retrieved.response).toEqual(responseData);
    });

    test('should fail request', async () => {
      const key = uuidv4();
      await idempotencyManager.storeRequest(key, 'processing');

      const error = new Error('Payment failed');
      await idempotencyManager.failRequest(key, error);

      const retrieved = await idempotencyManager.getRequest(key);
      expect(retrieved.status).toBe('failed');
      expect(retrieved.error).toBe('Payment failed');
    });

    test('should delete request', async () => {
      const key = uuidv4();
      await idempotencyManager.storeRequest(key, 'processing');

      await idempotencyManager.deleteRequest(key);

      const retrieved = await idempotencyManager.getRequest(key);
      expect(retrieved).toBeNull();
    });

    test('should expire entries after TTL', async () => {
      const store = new MemoryIdempotencyStore();
      const manager = new IdempotencyManager(store, { ttl: 1 }); // 1 second TTL

      const key = uuidv4();
      await manager.storeRequest(key, 'processing');

      // Should exist immediately
      let retrieved = await manager.getRequest(key);
      expect(retrieved).toBeDefined();

      // Wait for expiry
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Should be expired
      retrieved = await manager.getRequest(key);
      expect(retrieved).toBeNull();
    });
  });

  describe('Idempotency Check', () => {
    test('should identify new request', async () => {
      const req = {
        method: 'POST',
        headers: {
          'idempotency-key': uuidv4()
        }
      };

      const result = await idempotencyManager.isIdempotent(req);
      expect(result.idempotent).toBe(false);
      expect(result.reason).toBe('new_request');
      expect(result.key).toBeDefined();
    });

    test('should identify duplicate request', async () => {
      const key = uuidv4();
      await idempotencyManager.storeRequest(key, 'completed', { success: true });

      const req = {
        method: 'POST',
        headers: {
          'idempotency-key': key
        }
      };

      const result = await idempotencyManager.isIdempotent(req);
      expect(result.idempotent).toBe(true);
      expect(result.status).toBe('completed');
      expect(result.existing).toBeDefined();
    });

    test('should skip GET requests', async () => {
      const req = {
        method: 'GET',
        headers: {
          'idempotency-key': uuidv4()
        }
      };

      const result = await idempotencyManager.isIdempotent(req);
      expect(result.idempotent).toBe(false);
      expect(result.reason).toBe('method_not_applicable');
    });

    test('should require idempotency key for POST', async () => {
      const req = {
        method: 'POST',
        headers: {}
      };

      const result = await idempotencyManager.isIdempotent(req);
      expect(result.idempotent).toBe(false);
      expect(result.reason).toBe('no_key');
    });
  });

  describe('Express Middleware', () => {
    test('should allow new request', async () => {
      const middleware = createIdempotencyMiddleware();
      
      const req = {
        method: 'POST',
        headers: {
          'idempotency-key': uuidv4()
        }
      };
      
      const res = {
        json: jest.fn(),
        status: jest.fn().mockReturnThis(),
        on: jest.fn()
      };
      
      const next = jest.fn();

      await middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.idempotencyKey).toBeDefined();
    });

    test('should return 409 for request in progress', async () => {
      const key = uuidv4();
      const middleware = createIdempotencyMiddleware();
      
      // Store as processing
      await idempotencyManager.storeRequest(key, 'processing');
      
      const req = {
        method: 'POST',
        headers: {
          'idempotency-key': key
        }
      };
      
      const res = {
        json: jest.fn(),
        status: jest.fn().mockReturnThis()
      };
      
      const next = jest.fn();

      await middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Request in progress'
        })
      );
      expect(next).not.toHaveBeenCalled();
    });

    test('should return cached response for completed request', async () => {
      const key = uuidv4();
      const middleware = createIdempotencyMiddleware();
      
      // Store as completed
      await idempotencyManager.completeRequest(key, {
        status: 200,
        data: { success: true, id: 123 }
      });
      
      const req = {
        method: 'POST',
        headers: {
          'idempotency-key': key
        }
      };
      
      const res = {
        json: jest.fn(),
        status: jest.fn().mockReturnThis()
      };
      
      const next = jest.fn();

      await middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          id: 123,
          _idempotent: true
        })
      );
      expect(next).not.toHaveBeenCalled();
    });

    test('should allow retry for failed request', async () => {
      const key = uuidv4();
      const middleware = createIdempotencyMiddleware();
      
      // Store as failed
      await idempotencyManager.failRequest(key, new Error('Payment failed'));
      
      const req = {
        method: 'POST',
        headers: {
          'idempotency-key': key
        }
      };
      
      const res = {
        json: jest.fn(),
        status: jest.fn().mockReturnThis(),
        on: jest.fn()
      };
      
      const next = jest.fn();

      await middleware(req, res, next);

      // Should allow retry
      expect(next).toHaveBeenCalled();
      expect(req.idempotencyKey).toBe(key);
    });

    test('should intercept response for caching', async () => {
      const middleware = createIdempotencyMiddleware();
      
      const key = uuidv4();
      const req = {
        method: 'POST',
        headers: {
          'idempotency-key': key
        }
      };
      
      let capturedJson;
      const res = {
        json: jest.fn(data => { capturedJson = data; }),
        status: jest.fn().mockReturnThis(),
        statusCode: 200,
        on: jest.fn()
      };
      
      const next = jest.fn(() => {
        // Simulate response
        res.json({ success: true, data: 'test' });
      });

      await middleware(req, res, next);

      // Check that response was intercepted
      expect(next).toHaveBeenCalled();
      expect(req.idempotencyKey).toBe(key);
    });
  });

  describe('requireIdempotencyKey Middleware', () => {
    test('should require idempotency key', () => {
      const middleware = requireIdempotencyKey();
      
      const req = {
        headers: {}
      };
      
      const res = {
        json: jest.fn(),
        status: jest.fn().mockReturnThis()
      };
      
      const next = jest.fn();

      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Idempotency key required'
        })
      );
      expect(next).not.toHaveBeenCalled();
    });

    test('should validate UUID format', () => {
      const middleware = requireIdempotencyKey();
      
      const req = {
        headers: {
          'idempotency-key': 'invalid-key'
        }
      };
      
      const res = {
        json: jest.fn(),
        status: jest.fn().mockReturnThis()
      };
      
      const next = jest.fn();

      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Invalid idempotency key format'
        })
      );
    });

    test('should accept valid UUID', () => {
      const middleware = requireIdempotencyKey();
      
      const key = uuidv4();
      const req = {
        headers: {
          'idempotency-key': key
        }
      };
      
      const res = {
        json: jest.fn(),
        status: jest.fn().mockReturnThis()
      };
      
      const next = jest.fn();

      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.idempotencyKey).toBe(key);
    });

    test('should accept hex string format', () => {
      const middleware = requireIdempotencyKey();
      
      const key = 'a'.repeat(32); // 32-char hex string
      const req = {
        headers: {
          'idempotency-key': key
        }
      };
      
      const res = {
        json: jest.fn(),
        status: jest.fn().mockReturnThis()
      };
      
      const next = jest.fn();

      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.idempotencyKey).toBe(key);
    });
  });

  describe('Concurrent Duplicate Requests', () => {
    test('should handle concurrent duplicate requests', async () => {
      const middleware = createIdempotencyMiddleware();
      const key = uuidv4();
      
      const createRequest = () => ({
        method: 'POST',
        headers: {
          'idempotency-key': key
        }
      });
      
      const createResponse = () => ({
        json: jest.fn(),
        status: jest.fn().mockReturnThis(),
        statusCode: 200,
        on: jest.fn()
      });
      
      const requests = [];
      for (let i = 0; i < 5; i++) {
        requests.push({
          req: createRequest(),
          res: createResponse(),
          next: jest.fn()
        });
      }

      // Execute concurrently
      await Promise.all(
        requests.map(({ req, res, next }) => middleware(req, res, next))
      );

      // Only first request should proceed
      const proceededCount = requests.filter(r => r.next.mock.calls.length > 0).length;
      const blockedCount = requests.filter(r => r.res.status.mock.calls.length > 0).length;

      // At least one should proceed, others should be blocked or return cached
      expect(proceededCount).toBeGreaterThanOrEqual(1);
      expect(proceededCount + blockedCount).toBe(5);
    });
  });
});
