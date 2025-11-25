/**
 * Jest Setup File
 * Runs before each test file
 */

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.MONGODB_URI_TEST = process.env.MONGODB_URI_TEST || 'mongodb://localhost:27017/super-app-test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key-123';
process.env.TEST_PORT = process.env.TEST_PORT || '5001';

// Increase timeout for integration tests
jest.setTimeout(10000);

// Suppress console logs during tests (optional)
if (process.env.TEST_SILENT === 'true') {
  global.console = {
    ...console,
    log: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
}

// Global test helpers
global.wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Mock external services (if needed)
// jest.mock('../services/TwilioService');
// jest.mock('../services/EmailService');

console.log('[JEST] Test environment configured');
console.log(`[JEST] MongoDB: ${process.env.MONGODB_URI_TEST}`);
console.log(`[JEST] JWT Secret: ${process.env.JWT_SECRET ? '✅ Set' : '❌ Not set'}`);
console.log(`[JEST] Test Port: ${process.env.TEST_PORT}`);
