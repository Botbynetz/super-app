/**
 * Artillery Load Test Processor
 * Custom functions for load testing scenarios
 */

const jwt = require('jsonwebtoken');

/**
 * Generate a valid JWT token for load testing
 */
function generateAuthToken(context, events, done) {
  const userId = `loadtest_${Math.random().toString(36).substring(7)}`;
  
  const token = jwt.sign(
    { 
      id: userId,
      role: 'user',
      username: `loadtest_user_${userId}`,
    },
    process.env.JWT_SECRET || 'test_jwt_secret',
    { expiresIn: '1h' }
  );
  
  context.vars.authToken = token;
  context.vars.userId = userId;
  
  return done();
}

/**
 * Get a random creator ID for testing
 */
function getRandomCreator(context, events, done) {
  // In a real test, you'd query the API
  // For load testing, we use pre-seeded creator IDs
  const creatorIds = [
    '507f1f77bcf86cd799439011',
    '507f1f77bcf86cd799439012',
    '507f1f77bcf86cd799439013',
  ];
  
  context.vars.recipientId = creatorIds[Math.floor(Math.random() * creatorIds.length)];
  
  return done();
}

/**
 * Log custom metrics
 */
function logMetrics(context, events, done) {
  console.log('Custom metrics:', {
    duration: context.vars.$loopCount,
    userId: context.vars.userId,
  });
  
  return done();
}

module.exports = {
  generateAuthToken,
  getRandomCreator,
  logMetrics,
};
