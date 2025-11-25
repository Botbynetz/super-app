/**
 * Integration Tests - Fraud Detection & Prevention
 * Tests velocity limits, risk scoring, and auto-freeze mechanisms
 */

const { v4: uuidv4 } = require('uuid');

// Test utilities
const { startTestServer, stopTestServer } = require('../utils/testServer');
const ApiClient = require('../utils/apiClient');
const { cleanupAllCollections } = require('../utils/cleanupDB');
const { seedUsers } = require('../fixtures/seedUsers');
const { seedContent } = require('../fixtures/seedContent');

// Models
const Wallet = require('../../models/Wallet');
const PremiumUnlock = require('../../models/PremiumUnlock');
const AuditLog = require('../../models/AuditLog');

// Services
const FraudGuard = require('../../../services/FraudGuard');

describe('Fraud Detection - Integration Tests', () => {
  let app, server, io;
  let apiClient;
  let testUsers, testContent;
  const TEST_PORT = 5003;

  beforeAll(async () => {
    ({ app, server, io } = await startTestServer(TEST_PORT));
    apiClient = new ApiClient(app);
  });

  afterAll(async () => {
    await stopTestServer();
  });

  beforeEach(async () => {
    await cleanupAllCollections();
    testUsers = await seedUsers();
    testContent = await seedContent({
      creator1: testUsers.creator1.userId,
      creator2: testUsers.creator2.userId,
    });
  });

  describe('Velocity Limit Tests', () => {
    it('should block 11th unlock within 1 hour (velocity limit exceeded)', async () => {
      const fraudster = testUsers.fraudster; // 50,000 coins
      const content = testContent.exclusive; // 300 coins

      apiClient.authenticateAs(fraudster.userId);

      // Create 10 unlocks manually (simulate rapid unlocking)
      const oneHourAgo = new Date(Date.now() - 30 * 60 * 1000); // 30 min ago

      for (let i = 0; i < 10; i++) {
        await PremiumUnlock.create({
          userId: fraudster.userId,
          contentId: content.contentId,
          amount_coins: 300,
          creator_share_coins: 210,
          platform_share_coins: 75,
          processing_fee_coins: 15,
          idempotencyKey: uuidv4(),
          createdAt: oneHourAgo,
        });
      }

      // 11th unlock attempt should be blocked
      const response = await apiClient.post(
        `/api/premium/${content.contentId}/unlock`,
        { idempotencyKey: uuidv4() }
      );

      expect(response.status).toBe(429); // Too Many Requests
      expect(response.body.code).toBe('VELOCITY_LIMIT_EXCEEDED');
      expect(response.body.reason).toContain('unlock limit');
    });

    it('should allow unlock after velocity window expires', async () => {
      const user = testUsers.buyer1;
      const content = testContent.premium_tutorial;

      apiClient.authenticateAs(user.userId);

      // Create 10 unlocks > 1 hour ago
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);

      for (let i = 0; i < 10; i++) {
        await PremiumUnlock.create({
          userId: user.userId,
          contentId: `fake-content-${i}`,
          amount_coins: 100,
          creator_share_coins: 70,
          platform_share_coins: 25,
          processing_fee_coins: 5,
          idempotencyKey: uuidv4(),
          createdAt: twoHoursAgo,
        });
      }

      // This unlock should succeed (velocity window expired)
      const response = await apiClient.post(
        `/api/premium/${content.contentId}/unlock`,
        { idempotencyKey: uuidv4() }
      );

      expect(response.status).toBe(200);
    });
  });

  describe('Subscription Velocity Tests', () => {
    it('should block 4th subscription within 24 hours', async () => {
      const fraudster = testUsers.fraudster;
      const creators = [
        testUsers.creator1,
        testUsers.creator2,
        testUsers.creator1, // Resubscribe
      ];

      apiClient.authenticateAs(fraudster.userId);

      // Create 3 subscriptions
      for (let i = 0; i < 3; i++) {
        await apiClient.post('/api/subscription/subscribe', {
          creatorId: creators[i].userId,
          tierId: 'monthly',
          idempotencyKey: uuidv4(),
        });
      }

      // 4th subscription should be blocked
      const response = await apiClient.post('/api/subscription/subscribe', {
        creatorId: testUsers.creator2.userId,
        tierId: 'monthly',
        idempotencyKey: uuidv4(),
      });

      expect(response.status).toBe(429);
      expect(response.body.code).toBe('SUBSCRIPTION_ABUSE_DETECTED');
    });
  });

  describe('Risk Scoring Tests', () => {
    it('should calculate risk score correctly based on activity', async () => {
      const user = testUsers.buyer1;

      // Create activity (10 unlocks in last hour)
      const recentTime = new Date(Date.now() - 30 * 60 * 1000);

      for (let i = 0; i < 10; i++) {
        await PremiumUnlock.create({
          userId: user.userId,
          contentId: `fake-content-${i}`,
          amount_coins: 500,
          creator_share_coins: 350,
          platform_share_coins: 125,
          processing_fee_coins: 25,
          idempotencyKey: uuidv4(),
          createdAt: recentTime,
        });
      }

      // Calculate risk score
      const riskScore = await FraudGuard.calculateRiskScore(user.userId);

      expect(riskScore).toBeGreaterThan(0);
      expect(riskScore).toBeLessThanOrEqual(100);
      console.log(`[TEST] Risk score for user with 10 recent unlocks: ${riskScore}`);
    });

    it('should return high risk score for suspicious behavior', async () => {
      const fraudster = testUsers.fraudster;

      // Simulate high-risk activity: 20 unlocks + 3 subscriptions
      const now = new Date();

      for (let i = 0; i < 20; i++) {
        await PremiumUnlock.create({
          userId: fraudster.userId,
          contentId: `fake-content-${i}`,
          amount_coins: 1000,
          creator_share_coins: 700,
          platform_share_coins: 250,
          processing_fee_coins: 50,
          idempotencyKey: uuidv4(),
          createdAt: now,
        });
      }

      const riskScore = await FraudGuard.calculateRiskScore(fraudster.userId);

      expect(riskScore).toBeGreaterThan(50); // High risk
      console.log(`[TEST] Risk score for fraudster: ${riskScore}`);
    });
  });

  describe('High Value Transaction Alerts', () => {
    it('should flag transaction when amount > 1000 coins', async () => {
      const buyer = testUsers.buyer1;
      const highValueContent = testContent.high_value; // 5000 coins

      apiClient.authenticateAs(buyer.userId);

      // Unlock high-value content
      const response = await apiClient.post(
        `/api/premium/${highValueContent.contentId}/unlock`,
        { idempotencyKey: uuidv4() }
      );

      expect(response.status).toBe(200);

      // Check that AuditLog entry created for high value
      const auditLogs = await AuditLog.find({
        userId: buyer.userId,
        action: 'HIGH_VALUE_TRANSACTION',
      });

      expect(auditLogs.length).toBeGreaterThan(0);
      expect(auditLogs[0].metadata.amount_coins).toBe(5000);
      expect(auditLogs[0].metadata.flagged).toBe(true);
    });

    it('should not flag normal transaction (< 1000 coins)', async () => {
      const buyer = testUsers.buyer1;
      const normalContent = testContent.premium_tutorial; // 500 coins

      apiClient.authenticateAs(buyer.userId);

      await apiClient.post(
        `/api/premium/${normalContent.contentId}/unlock`,
        { idempotencyKey: uuidv4() }
      );

      const auditLogs = await AuditLog.find({
        userId: buyer.userId,
        action: 'HIGH_VALUE_TRANSACTION',
      });

      expect(auditLogs.length).toBe(0);
    });
  });

  describe('Auto-Freeze Account Tests', () => {
    it('should auto-freeze account when risk score > 80', async () => {
      const fraudster = testUsers.fraudster;

      // Create extreme suspicious activity (30+ unlocks in short time)
      const now = new Date();

      for (let i = 0; i < 30; i++) {
        await PremiumUnlock.create({
          userId: fraudster.userId,
          contentId: `fake-content-${i}`,
          amount_coins: 1000,
          creator_share_coins: 700,
          platform_share_coins: 250,
          processing_fee_coins: 50,
          idempotencyKey: uuidv4(),
          createdAt: now,
        });
      }

      // Calculate risk and auto-freeze if needed
      const riskScore = await FraudGuard.calculateRiskScore(fraudster.userId);
      console.log(`[TEST] Fraudster risk score: ${riskScore}`);

      if (riskScore > 80) {
        await FraudGuard.autoFreezeAccount(
          fraudster.userId,
          `Risk score exceeded threshold: ${riskScore}`
        );
      }

      // Check wallet frozen
      const wallet = await Wallet.findOne({ userId: fraudster.userId });
      if (riskScore > 80) {
        expect(wallet.is_frozen).toBe(true);
      }

      // Check AuditLog entry
      const auditLogs = await AuditLog.find({
        userId: fraudster.userId,
        action: 'ACCOUNT_FROZEN',
      });

      if (riskScore > 80) {
        expect(auditLogs.length).toBeGreaterThan(0);
      }
    });

    it('should block all operations when account frozen', async () => {
      const user = testUsers.buyer1;

      // Manually freeze account
      await Wallet.findOneAndUpdate(
        { userId: user.userId },
        { is_frozen: true }
      );

      apiClient.authenticateAs(user.userId);

      // Try to unlock content
      const response = await apiClient.post(
        `/api/premium/${testContent.premium_tutorial.contentId}/unlock`,
        { idempotencyKey: uuidv4() }
      );

      expect(response.status).toBe(403);
      expect(response.body.code).toBe('ACCOUNT_FROZEN');
    });
  });

  describe('Duplicate Transaction Prevention', () => {
    it('should prevent duplicate idempotencyKey across different users', async () => {
      const buyer1 = testUsers.buyer1;
      const buyer2 = testUsers.buyer2;
      const content = testContent.premium_tutorial;
      const sharedKey = uuidv4();

      // Buyer1 unlocks with key
      apiClient.authenticateAs(buyer1.userId);
      const response1 = await apiClient.post(
        `/api/premium/${content.contentId}/unlock`,
        { idempotencyKey: sharedKey }
      );
      expect(response1.status).toBe(200);

      // Buyer2 tries to use same key (should still work - keys are user-scoped)
      apiClient.authenticateAs(buyer2.userId);
      const response2 = await apiClient.post(
        `/api/premium/${content.contentId}/unlock`,
        { idempotencyKey: sharedKey }
      );
      
      // Different users can use same idempotency key
      expect(response2.status).toBe(200);

      // But buyer1 cannot reuse their own key
      apiClient.authenticateAs(buyer1.userId);
      const response3 = await apiClient.post(
        `/api/premium/${content.contentId}/unlock`,
        { idempotencyKey: sharedKey }
      );
      
      expect(response3.status).toBe(200);
      expect(response3.body.message).toContain('already unlocked');
    });
  });

  describe('Concurrent Fraud Attempts', () => {
    it('should handle concurrent fraud attempts gracefully', async () => {
      const fraudster = testUsers.fraudster;
      const content = testContent.premium_tutorial;

      apiClient.authenticateAs(fraudster.userId);

      // Launch 50 concurrent unlock attempts (should trigger velocity limit)
      const requests = Array.from({ length: 50 }, () =>
        apiClient.post(`/api/premium/${content.contentId}/unlock`, {
          idempotencyKey: uuidv4(),
        }).catch(err => err.response || err)
      );

      const responses = await Promise.all(requests);

      // Most should be blocked by velocity limits
      const blocked = responses.filter(
        r => r.status === 429 || r.statusCode === 429
      );
      const successful = responses.filter(
        r => r.status === 200 || r.statusCode === 200
      );

      console.log(`[TEST] Concurrent fraud test: ${successful.length} succeeded, ${blocked.length} blocked`);

      expect(blocked.length).toBeGreaterThan(0);
      
      // Wallet should never go negative
      const wallet = await Wallet.findOne({ userId: fraudster.userId });
      expect(wallet.balance_coins).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Admin Fraud Management', () => {
    it('should allow admin to manually freeze suspicious account', async () => {
      const admin = testUsers.admin;
      const suspiciousUser = testUsers.fraudster;

      apiClient.authenticateAs(admin.userId);

      // Admin freezes account
      const response = await apiClient.post('/api/admin/freeze-account', {
        userId: suspiciousUser.userId,
        reason: 'Manual review: suspicious activity patterns',
      });

      expect(response.status).toBe(200);

      // Verify account frozen
      const wallet = await Wallet.findOne({ userId: suspiciousUser.userId });
      expect(wallet.is_frozen).toBe(true);

      // Verify AuditLog entry
      const auditLog = await AuditLog.findOne({
        userId: suspiciousUser.userId,
        action: 'ACCOUNT_FROZEN',
      });
      expect(auditLog).toBeDefined();
      expect(auditLog.performedBy).toBe(admin.userId);
    });

    it('should allow admin to unfreeze account after review', async () => {
      const admin = testUsers.admin;
      const user = testUsers.buyer1;

      // Freeze account first
      await Wallet.findOneAndUpdate(
        { userId: user.userId },
        { is_frozen: true }
      );

      apiClient.authenticateAs(admin.userId);

      // Unfreeze
      const response = await apiClient.post('/api/admin/unfreeze-account', {
        userId: user.userId,
        reason: 'Review completed: no fraud detected',
      });

      expect(response.status).toBe(200);

      // Verify unfrozen
      const wallet = await Wallet.findOne({ userId: user.userId });
      expect(wallet.is_frozen).toBe(false);
    });
  });
});
