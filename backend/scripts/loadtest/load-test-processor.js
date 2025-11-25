/**
 * Artillery Load Test Processor
 * Custom functions for load testing
 */

const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');

/**
 * Generate random user data
 */
function generateUser(requestParams, context, ee, next) {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 1000000);
  
  context.vars.username = `loadtest_user_${timestamp}_${random}`;
  context.vars.email = `loadtest_${timestamp}_${random}@test.com`;
  context.vars.phoneNumber = `+628${String(random).padStart(10, '0')}`;
  
  return next();
}

/**
 * Generate idempotency key
 */
function generateIdempotencyKey(requestParams, context, ee, next) {
  context.vars.idempotencyKey = uuidv4();
  return next();
}

/**
 * Generate random content data
 */
function generateContent(requestParams, context, ee, next) {
  const titles = [
    'Premium Tutorial',
    'Exclusive Content',
    'VIP Material',
    'Special Lesson',
    'Pro Tips'
  ];
  
  const categories = ['tutorial', 'video', 'article', 'course', 'guide'];
  
  context.vars.contentTitle = titles[Math.floor(Math.random() * titles.length)];
  context.vars.contentCategory = categories[Math.floor(Math.random() * categories.length)];
  context.vars.contentPrice = Math.floor(Math.random() * 5000) + 500; // 500-5500 coins
  
  return next();
}

/**
 * Log custom metrics
 */
function logMetrics(requestParams, response, context, ee, next) {
  if (response.headers['x-response-time']) {
    ee.emit('customStat', {
      stat: 'response_time_from_header',
      value: parseInt(response.headers['x-response-time'])
    });
  }
  
  if (response.headers['x-ratelimit-remaining']) {
    ee.emit('customStat', {
      stat: 'rate_limit_remaining',
      value: parseInt(response.headers['x-ratelimit-remaining'])
    });
  }
  
  return next();
}

/**
 * Generate JWT for testing (if needed)
 */
function generateAuthToken(userId, secret = 'test_secret') {
  const payload = {
    userId,
    role: 'user',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600 // 1 hour
  };
  
  // Simple JWT generation (for testing only)
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payloadEncoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', secret)
    .update(`${header}.${payloadEncoded}`)
    .digest('base64url');
  
  return `${header}.${payloadEncoded}.${signature}`;
}

/**
 * Get random element from array
 */
function getRandomElement(requestParams, context, ee, next) {
  if (context.vars.array && Array.isArray(context.vars.array)) {
    context.vars.randomElement = context.vars.array[
      Math.floor(Math.random() * context.vars.array.length)
    ];
  }
  return next();
}

/**
 * Sleep/delay function
 */
function sleep(requestParams, context, ee, next) {
  const duration = context.vars.sleepDuration || 1000;
  setTimeout(next, duration);
}

module.exports = {
  generateUser,
  generateIdempotencyKey,
  generateContent,
  logMetrics,
  generateAuthToken,
  getRandomElement,
  sleep
};
