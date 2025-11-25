/**
 * Concurrency Stress Test for Wallet Unlock Flow
 * Simulates 200 concurrent users attempting to unlock premium content
 * 
 * Tests:
 * - No double-spend vulnerabilities
 * - Proper balance tracking
 * - Transaction integrity
 * - Database consistency
 */

const axios = require('axios');
const { performance } = require('perf_hooks');

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:5000';
const NUM_CONCURRENT_USERS = parseInt(process.env.CONCURRENT_USERS) || 200;
const CONTENT_ID = process.env.TEST_CONTENT_ID || '507f1f77bcf86cd799439011';

// Test results tracking
const results = {
  total: 0,
  success: 0,
  failed: 0,
  duplicates: 0,
  errors: [],
  durations: [],
  balanceIssues: 0
};

/**
 * Create a test user and get auth token
 */
async function createTestUser(index) {
  try {
    const username = `concurrency_user_${Date.now()}_${index}`;
    const response = await axios.post(`${BASE_URL}/api/auth/register`, {
      username,
      email: `${username}@test.com`,
      phoneNumber: `+628${String(index).padStart(10, '0')}`,
      password: 'Test1234!',
      role: 'user'
    });

    return {
      userId: response.data.user._id,
      token: response.data.token,
      username
    };
  } catch (error) {
    throw new Error(`Failed to create user ${index}: ${error.message}`);
  }
}

/**
 * Add coins to user wallet via faucet
 */
async function fundWallet(token, amount = 10000) {
  try {
    await axios.post(
      `${BASE_URL}/api/staging/faucet`,
      {},
      { headers: { Authorization: `Bearer ${token}` } }
    );
  } catch (error) {
    // Ignore faucet errors (may be on cooldown)
    console.warn('Faucet error (expected):', error.response?.data?.message);
  }
}

/**
 * Get wallet balance
 */
async function getBalance(token) {
  try {
    const response = await axios.get(
      `${BASE_URL}/api/wallet/balance`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return response.data.balance_cents;
  } catch (error) {
    throw new Error(`Failed to get balance: ${error.message}`);
  }
}

/**
 * Attempt to unlock premium content
 */
async function unlockContent(token, contentId, userId) {
  const startTime = performance.now();
  
  try {
    const response = await axios.post(
      `${BASE_URL}/api/premium/unlock`,
      {
        contentId,
        idempotencyKey: `test_${userId}_${contentId}_${Date.now()}`
      },
      { headers: { Authorization: `Bearer ${token}` } }
    );

    const duration = performance.now() - startTime;
    results.durations.push(duration);

    return {
      success: true,
      duration,
      data: response.data
    };
  } catch (error) {
    const duration = performance.now() - startTime;
    results.durations.push(duration);

    return {
      success: false,
      duration,
      error: error.response?.data || error.message
    };
  }
}

/**
 * Run test for single user
 */
async function runUserTest(index) {
  try {
    // Create user
    console.log(`[User ${index}] Creating test user...`);
    const user = await createTestUser(index);

    // Fund wallet
    console.log(`[User ${index}] Funding wallet...`);
    await fundWallet(user.token);

    // Get initial balance
    const initialBalance = await getBalance(user.token);
    console.log(`[User ${index}] Initial balance: ${initialBalance} cents`);

    // Attempt unlock
    console.log(`[User ${index}] Attempting unlock...`);
    const result = await unlockContent(user.token, CONTENT_ID, user.userId);

    // Get final balance
    const finalBalance = await getBalance(user.token);
    console.log(`[User ${index}] Final balance: ${finalBalance} cents`);

    // Validate balance change
    const expectedDeduction = result.success ? 100000 : 0; // Assuming 1000 coin content
    const actualDeduction = initialBalance - finalBalance;

    if (actualDeduction !== expectedDeduction) {
      results.balanceIssues++;
      console.error(`[User ${index}] ❌ BALANCE MISMATCH: Expected ${expectedDeduction}, Got ${actualDeduction}`);
    }

    results.total++;
    if (result.success) {
      results.success++;
      console.log(`[User ${index}] ✅ Success (${result.duration.toFixed(2)}ms)`);
    } else {
      if (result.error?.code === 'ALREADY_UNLOCKED' || result.error?.message?.includes('already')) {
        results.duplicates++;
        console.log(`[User ${index}] ⚠️  Duplicate (expected)`);
      } else {
        results.failed++;
        console.error(`[User ${index}] ❌ Failed: ${result.error?.message || result.error}`);
        results.errors.push({
          user: index,
          error: result.error
        });
      }
    }

    return result;
  } catch (error) {
    results.total++;
    results.failed++;
    console.error(`[User ${index}] ❌ Test failed: ${error.message}`);
    results.errors.push({
      user: index,
      error: error.message
    });
  }
}

/**
 * Run concurrency test
 */
async function runConcurrencyTest() {
  console.log('\n' + '='.repeat(60));
  console.log('🚀 WALLET UNLOCK CONCURRENCY STRESS TEST');
  console.log('='.repeat(60));
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Concurrent Users: ${NUM_CONCURRENT_USERS}`);
  console.log(`Content ID: ${CONTENT_ID}`);
  console.log('='.repeat(60) + '\n');

  const overallStart = performance.now();

  // Create array of promises for concurrent execution
  const promises = [];
  for (let i = 0; i < NUM_CONCURRENT_USERS; i++) {
    promises.push(runUserTest(i));
  }

  // Execute all tests concurrently
  console.log(`\n⏳ Running ${NUM_CONCURRENT_USERS} concurrent tests...\n`);
  await Promise.allSettled(promises);

  const overallDuration = performance.now() - overallStart;

  // Calculate statistics
  const avgDuration = results.durations.reduce((a, b) => a + b, 0) / results.durations.length;
  const minDuration = Math.min(...results.durations);
  const maxDuration = Math.max(...results.durations);
  const p95Duration = results.durations.sort((a, b) => a - b)[Math.floor(results.durations.length * 0.95)];
  const p99Duration = results.durations.sort((a, b) => a - b)[Math.floor(results.durations.length * 0.99)];

  // Print results
  console.log('\n' + '='.repeat(60));
  console.log('📊 TEST RESULTS');
  console.log('='.repeat(60));
  console.log(`Total Requests:      ${results.total}`);
  console.log(`✅ Successful:        ${results.success} (${(results.success / results.total * 100).toFixed(2)}%)`);
  console.log(`❌ Failed:            ${results.failed} (${(results.failed / results.total * 100).toFixed(2)}%)`);
  console.log(`⚠️  Duplicates:       ${results.duplicates}`);
  console.log(`💰 Balance Issues:   ${results.balanceIssues}`);
  console.log('');
  console.log('⏱️  PERFORMANCE METRICS:');
  console.log(`Total Time:          ${(overallDuration / 1000).toFixed(2)}s`);
  console.log(`Avg Response Time:   ${avgDuration.toFixed(2)}ms`);
  console.log(`Min Response Time:   ${minDuration.toFixed(2)}ms`);
  console.log(`Max Response Time:   ${maxDuration.toFixed(2)}ms`);
  console.log(`p95 Response Time:   ${p95Duration.toFixed(2)}ms`);
  console.log(`p99 Response Time:   ${p99Duration.toFixed(2)}ms`);
  console.log(`Throughput:          ${(results.total / (overallDuration / 1000)).toFixed(2)} req/s`);
  console.log('='.repeat(60));

  // Print errors if any
  if (results.errors.length > 0) {
    console.log('\n❌ ERRORS:');
    results.errors.slice(0, 10).forEach(err => {
      console.log(`  [User ${err.user}] ${JSON.stringify(err.error)}`);
    });
    if (results.errors.length > 10) {
      console.log(`  ... and ${results.errors.length - 10} more errors`);
    }
  }

  // Check for critical issues
  console.log('\n' + '='.repeat(60));
  console.log('🔍 CRITICAL CHECKS');
  console.log('='.repeat(60));

  const checks = {
    noDoubleSpend: results.balanceIssues === 0,
    acceptableErrorRate: (results.failed / results.total) < 0.01, // < 1% error rate
    acceptableP95: p95Duration < 1000, // p95 < 1000ms
    noServerErrors: !results.errors.some(e => e.error?.status >= 500)
  };

  console.log(`No Double-Spend:     ${checks.noDoubleSpend ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Error Rate < 1%:     ${checks.acceptableErrorRate ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`P95 < 1000ms:        ${checks.acceptableP95 ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`No Server Errors:    ${checks.noServerErrors ? '✅ PASS' : '❌ FAIL'}`);

  const allChecksPassed = Object.values(checks).every(v => v === true);
  console.log('='.repeat(60));
  console.log(allChecksPassed ? '✅ ALL CHECKS PASSED' : '❌ SOME CHECKS FAILED');
  console.log('='.repeat(60) + '\n');

  // Exit with appropriate code
  process.exit(allChecksPassed ? 0 : 1);
}

// Run the test
if (require.main === module) {
  runConcurrencyTest().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { runConcurrencyTest };
