const FraudGuard = require('../../services/FraudGuard');
const PremiumUnlock = require('../../models/PremiumUnlock');
const Subscription = require('../../models/Subscription');
const Wallet = require('../../models/Wallet');
const mongoose = require('mongoose');

const mockUserId = new mongoose.Types.ObjectId();
const mockContentId = new mongoose.Types.ObjectId();
const mockCreatorId = new mongoose.Types.ObjectId();

describe('FraudGuard', () => {
  beforeAll(async () => {
    await mongoose.connect(process.env.MONGODB_TEST_URI || 'mongodb://localhost:27017/superapp_test');
  });

  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    await PremiumUnlock.deleteMany({});
    await Subscription.deleteMany({});
    await Wallet.deleteMany({});
    
    // Clear rate limit cache
    FraudGuard.clearUserCache(mockUserId.toString());
  });

  describe('checkUnlockAllowed', () => {
    test('should allow normal unlock request', async () => {
      // Create wallet with normal history
      await Wallet.create({
        userId: mockUserId,
        balance_cents: 1000000,
        statistics: {
          total_spent_cents: 100000,
          purchase_count: 5
        }
      });

      const result = await FraudGuard.checkUnlockAllowed(mockUserId.toString(), mockContentId.toString(), 100);

      expect(result.allowed).toBe(true);
      expect(result.riskScore).toBeLessThan(80);
      expect(result.action).toBe('approved');
    });

    test('should block rapid unlock attempts (velocity limit)', async () => {
      await Wallet.create({
        userId: mockUserId,
        balance_cents: 10000000
      });

      // Simulate 11 rapid unlocks (exceeds limit of 10 per minute)
      const unlockPromises = [];
      for (let i = 0; i < 11; i++) {
        unlockPromises.push(
          FraudGuard.checkUnlockAllowed(mockUserId.toString(), mockContentId.toString(), 10)
        );
      }

      const results = await Promise.all(unlockPromises);

      // First 10 should be allowed
      const allowedCount = results.filter(r => r.allowed).length;
      expect(allowedCount).toBe(10);

      // 11th should be blocked
      const blocked = results.find(r => !r.allowed);
      expect(blocked).toBeTruthy();
      expect(blocked.reason).toContain('Too many unlocks per minute');
    });

    test('should flag high-value transactions', async () => {
      await Wallet.create({
        userId: mockUserId,
        balance_cents: 100000000 // 10000 coins
      });

      // High value unlock (10000 coins = threshold)
      const result = await FraudGuard.checkUnlockAllowed(
        mockUserId.toString(),
        mockContentId.toString(),
        10000
      );

      // Should still be allowed but have elevated risk score
      expect(result.riskScore).toBeGreaterThan(10);
      expect(result.checks.find(c => c.name === 'high_value')).toBeTruthy();
    });

    test('should detect duplicate unlock attempts', async () => {
      await Wallet.create({
        userId: mockUserId,
        balance_cents: 1000000
      });

      // Create recent unlock attempt (within 1 minute)
      await PremiumUnlock.create({
        userId: mockUserId,
        contentId: mockContentId,
        creatorId: mockCreatorId,
        amount_coins: 100,
        platform_share: 25,
        creator_share: 70,
        processing_fee: 5,
        txStatus: 'pending',
        createdAt: new Date()
      });

      // Attempt duplicate unlock
      const result = await FraudGuard.checkUnlockAllowed(
        mockUserId.toString(),
        mockContentId.toString(),
        100
      );

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Duplicate unlock attempt detected');
    });

    test('should auto-freeze account with very high risk score', async () => {
      // Create suspicious wallet (new account, high spending)
      await Wallet.create({
        userId: mockUserId,
        balance_cents: 10000000,
        statistics: {
          total_spent_cents: 5000000, // 500 coins spent
          purchase_count: 50
        },
        createdAt: new Date() // Brand new account
      });

      // Simulate multiple rapid high-value unlocks
      for (let i = 0; i < 15; i++) {
        await FraudGuard.checkUnlockAllowed(
          mockUserId.toString(),
          new mongoose.Types.ObjectId().toString(),
          5000
        );
      }

      // Next unlock should trigger freeze
      const result = await FraudGuard.checkUnlockAllowed(
        mockUserId.toString(),
        mockContentId.toString(),
        5000
      );

      // Expect very high risk score
      expect(result.riskScore).toBeGreaterThan(70);
    });
  });

  describe('checkSubscriptionAbuse', () => {
    test('should allow normal subscription', async () => {
      const result = await FraudGuard.checkSubscriptionAbuse(
        mockUserId.toString(),
        mockCreatorId.toString()
      );

      expect(result.allowed).toBe(true);
      expect(result.riskScore).toBe(0);
    });

    test('should block rapid subscription attempts', async () => {
      // Simulate 6 rapid subscriptions (exceeds limit of 5 per day)
      const subPromises = [];
      for (let i = 0; i < 6; i++) {
        subPromises.push(
          FraudGuard.checkSubscriptionAbuse(mockUserId.toString(), mockCreatorId.toString())
        );
      }

      const results = await Promise.all(subPromises);

      // First 5 should be allowed
      const allowedCount = results.filter(r => r.allowed).length;
      expect(allowedCount).toBe(5);

      // 6th should be blocked
      const blocked = results.find(r => !r.allowed);
      expect(blocked).toBeTruthy();
      expect(blocked.reason).toContain('Daily subscription limit reached');
    });

    test('should detect rapid subscribe/cancel pattern', async () => {
      // Create multiple cancelled subscriptions in last 7 days
      for (let i = 0; i < 3; i++) {
        await Subscription.create({
          subscriberId: mockUserId,
          creatorId: new mongoose.Types.ObjectId(),
          tier: 'monthly',
          price_coins: 50,
          startedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
          expiresAt: new Date(),
          status: 'cancelled',
          metadata: {
            cancelledAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
          }
        });
      }

      const result = await FraudGuard.checkSubscriptionAbuse(
        mockUserId.toString(),
        mockCreatorId.toString()
      );

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Suspicious subscription pattern detected');
    });

    test('should block duplicate subscription to same creator', async () => {
      // Create active subscription
      await Subscription.create({
        subscriberId: mockUserId,
        creatorId: mockCreatorId,
        tier: 'monthly',
        price_coins: 50,
        startedAt: new Date(),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        status: 'active'
      });

      const result = await FraudGuard.checkSubscriptionAbuse(
        mockUserId.toString(),
        mockCreatorId.toString()
      );

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Already subscribed to this creator');
    });
  });

  describe('getUserRiskProfile', () => {
    test('should calculate user risk profile', async () => {
      await Wallet.create({
        userId: mockUserId,
        balance_cents: 1000000,
        statistics: {
          total_spent_cents: 500000,
          purchase_count: 10
        }
      });

      // Create some unlock history
      for (let i = 0; i < 5; i++) {
        await PremiumUnlock.create({
          userId: mockUserId,
          contentId: new mongoose.Types.ObjectId(),
          creatorId: mockCreatorId,
          amount_coins: 50,
          platform_share: 12,
          creator_share: 35,
          processing_fee: 2,
          txStatus: 'completed',
          createdAt: new Date()
        });
      }

      const profile = await FraudGuard.getUserRiskProfile(mockUserId.toString());

      expect(profile.userId).toBe(mockUserId.toString());
      expect(profile.activity.unlocks_24h).toBe(5);
      expect(profile.risk_score).toBeDefined();
    });
  });
});
