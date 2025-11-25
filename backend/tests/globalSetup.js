/**
 * Jest Global Setup
 * Runs once before all tests
 */

module.exports = async () => {
  // Set test environment variables
  process.env.NODE_ENV = 'test';
  process.env.MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/super-app-test';
  process.env.JWT_SECRET = 'test-jwt-secret-key-for-integration-tests';
  process.env.JWT_EXPIRES_IN = '24h';
  process.env.TEST_PORT = '4001';

  console.log('🔧 Jest Global Setup: Test environment configured');
  console.log(`   - Database: ${process.env.MONGODB_URI}`);
  console.log(`   - Port: ${process.env.TEST_PORT}`);
};
