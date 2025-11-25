const mongoose = require('mongoose');
const SubscriptionService = require('../../services/SubscriptionService');
const Subscription = require('../../models/Subscription');
const PremiumContent = require('../../models/PremiumContent');
const Wallet = require('../../models/Wallet');
const CreatorRevenue = require('../../models/CreatorRevenue');

// Mock data
const mockSubscriberId = new mongoose.Types.ObjectId();
const mockCreatorId = new mongoose.Types.ObjectId();

describe('SubscriptionService', () => {
  beforeAll(async () => {
    await mongoose.connect(process.env.MONGODB_TEST_URI || 'mongodb://localhost:27017/superapp_test');
  });

  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    await Subscription.deleteMany({});
    await PremiumContent.deleteMany({});
    await Wallet.deleteMany({});
    await CreatorRevenue.deleteMany({});
  });

  describe('subscribe', () => {
    test('should successfully create subscription with 30-day monthly tier', async () => {
      // Setup wallets
      await Wallet.create({
        userId: mockSubscriberId,
        balance_cents: 1000000 // 100 coins
      });

      await Wallet.create({
        userId: mockCreatorId,
        balance_cents: 0
      });

      // Subscribe
      const result = await SubscriptionService.subscribe(
        mockSubscriberId,
        mockCreatorId,
        'monthly',
        50, // 50 coins per month
        'sub-idempotency-1',
        {}
      );

      // Assertions
      expect(result.accessGranted).toBe(true);
      expect(result.subscription.tier).toBe('monthly');
      expect(result.subscription.price_coins).toBe(50);
      expect(result.subscription.autoRenew).toBe(true);

      // Verify expires in ~30 days
      const daysDiff = Math.round((result.expiresAt - result.subscription.startedAt) / (1000 * 60 * 60 * 24));
      expect(daysDiff).toBe(30);

      // Verify revenue split (70% to creator = 35 coins)
      expect(result.revenue_split.creator).toBe(35);
      expect(result.revenue_split.platform).toBe(12);
      expect(result.revenue_split.processing).toBe(2);

      // Verify wallet balances
      const subscriberWallet = await Wallet.findOne({ userId: mockSubscriberId });
      expect(subscriberWallet.getBalanceCents()).toBe(500000); // 100 - 50 = 50 coins

      const creatorWallet = await Wallet.findOne({ userId: mockCreatorId });
      expect(creatorWallet.getBalanceCents()).toBe(350000); // 35 coins (70%)
    });

    test('should create subscription with 90-day quarterly tier', async () => {
      await Wallet.create({
        userId: mockSubscriberId,
        balance_cents: 2000000 // 200 coins
      });

      await Wallet.create({
        userId: mockCreatorId,
        balance_cents: 0
      });

      const result = await SubscriptionService.subscribe(
        mockSubscriberId,
        mockCreatorId,
        'quarterly',
        120,
        null,
        {}
      );

      // Verify 90-day duration
      const daysDiff = Math.round((result.expiresAt - result.subscription.startedAt) / (1000 * 60 * 60 * 24));
      expect(daysDiff).toBe(90);
    });

    test('should create subscription with 365-day yearly tier', async () => {
      await Wallet.create({
        userId: mockSubscriberId,
        balance_cents: 5000000 // 500 coins
      });

      await Wallet.create({
        userId: mockCreatorId,
        balance_cents: 0
      });

      const result = await SubscriptionService.subscribe(
        mockSubscriberId,
        mockCreatorId,
        'yearly',
        400,
        null,
        {}
      );

      // Verify 365-day duration
      const daysDiff = Math.round((result.expiresAt - result.subscription.startedAt) / (1000 * 60 * 60 * 24));
      expect(daysDiff).toBe(365);
    });

    test('should fail subscription with insufficient balance', async () => {
      await Wallet.create({
        userId: mockSubscriberId,
        balance_cents: 100000 // Only 10 coins
      });

      await Wallet.create({
        userId: mockCreatorId,
        balance_cents: 0
      });

      await expect(
        SubscriptionService.subscribe(mockSubscriberId, mockCreatorId, 'monthly', 50, null, {})
      ).rejects.toMatchObject({
        code: 'INSUFFICIENT_BALANCE'
      });
    });

    test('should fail when already subscribed', async () => {
      await Wallet.create({
        userId: mockSubscriberId,
        balance_cents: 2000000
      });

      await Wallet.create({
        userId: mockCreatorId,
        balance_cents: 0
      });

      // First subscription
      await SubscriptionService.subscribe(mockSubscriberId, mockCreatorId, 'monthly', 50, null, {});

      // Second subscription attempt - should fail
      await expect(
        SubscriptionService.subscribe(mockSubscriberId, mockCreatorId, 'monthly', 50, null, {})
      ).rejects.toMatchObject({
        code: 'ALREADY_SUBSCRIBED'
      });
    });

    test('should add subscriber to creator content allowed_subscribers', async () => {
      await Wallet.create({
        userId: mockSubscriberId,
        balance_cents: 1000000
      });

      await Wallet.create({
        userId: mockCreatorId,
        balance_cents: 0
      });

      // Create subscriber-only content
      const content = await PremiumContent.create({
        creatorId: mockCreatorId,
        title: 'Subscriber Only Content',
        description: 'Test description',
        category: 'education',
        price_coins: 0,
        mediaType: 'video',
        subscriber_only: true,
        is_published: true
      });

      // Subscribe
      await SubscriptionService.subscribe(mockSubscriberId, mockCreatorId, 'monthly', 50, null, {});

      // Verify subscriber added to content
      const updatedContent = await PremiumContent.findById(content._id);
      expect(updatedContent.allowed_subscribers).toContainEqual(mockSubscriberId);
    });
  });

  describe('cancelSubscription', () => {
    test('should successfully cancel subscription', async () => {
      // Create subscription
      const subscription = await Subscription.create({
        subscriberId: mockSubscriberId,
        creatorId: mockCreatorId,
        tier: 'monthly',
        price_coins: 50,
        startedAt: new Date(),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        status: 'active',
        autoRenew: true
      });

      // Cancel
      const result = await SubscriptionService.cancelSubscription(
        subscription._id,
        mockSubscriberId,
        'Changed my mind'
      );

      expect(result.status).toBe('cancelled');
      expect(result.autoRenew).toBe(false);
      expect(result.metadata.cancelReason).toBe('Changed my mind');
    });

    test('should fail cancel if not owner', async () => {
      const subscription = await Subscription.create({
        subscriberId: mockSubscriberId,
        creatorId: mockCreatorId,
        tier: 'monthly',
        price_coins: 50,
        startedAt: new Date(),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        status: 'active'
      });

      const otherUserId = new mongoose.Types.ObjectId();

      await expect(
        SubscriptionService.cancelSubscription(subscription._id, otherUserId, 'Test')
      ).rejects.toMatchObject({
        code: 'UNAUTHORIZED'
      });
    });
  });

  describe('processExpiredSubscriptions', () => {
    test('should mark expired subscriptions and remove access', async () => {
      // Create expired subscription
      const expiredDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // Yesterday
      
      const subscription = await Subscription.create({
        subscriberId: mockSubscriberId,
        creatorId: mockCreatorId,
        tier: 'monthly',
        price_coins: 50,
        startedAt: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000),
        expiresAt: expiredDate,
        status: 'active',
        autoRenew: false
      });

      // Create content with subscriber access
      const content = await PremiumContent.create({
        creatorId: mockCreatorId,
        title: 'Content',
        description: 'Test',
        category: 'education',
        price_coins: 0,
        mediaType: 'video',
        subscriber_only: true,
        is_published: true,
        allowed_subscribers: [mockSubscriberId]
      });

      // Process expired subscriptions
      const result = await SubscriptionService.processExpiredSubscriptions();

      expect(result.processedCount).toBe(1);
      expect(result.removedAccessCount).toBeGreaterThanOrEqual(1);

      // Verify subscription marked expired
      const updatedSub = await Subscription.findById(subscription._id);
      expect(updatedSub.status).toBe('expired');

      // Verify subscriber removed from content
      const updatedContent = await PremiumContent.findById(content._id);
      expect(updatedContent.allowed_subscribers).not.toContainEqual(mockSubscriberId);
    });

    test('should not process subscriptions with auto-renewal enabled', async () => {
      // Create expired subscription with autoRenew
      const expiredDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
      
      await Subscription.create({
        subscriberId: mockSubscriberId,
        creatorId: mockCreatorId,
        tier: 'monthly',
        price_coins: 50,
        startedAt: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000),
        expiresAt: expiredDate,
        status: 'active',
        autoRenew: true // Auto-renewal enabled
      });

      const result = await SubscriptionService.processExpiredSubscriptions();

      // Should not process subscriptions with autoRenew
      expect(result.processedCount).toBe(0);
    });
  });

  describe('isActiveSubscriber', () => {
    test('should return true for active subscription', async () => {
      await Subscription.create({
        subscriberId: mockSubscriberId,
        creatorId: mockCreatorId,
        tier: 'monthly',
        price_coins: 50,
        startedAt: new Date(),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        status: 'active'
      });

      const result = await SubscriptionService.isActiveSubscriber(mockSubscriberId, mockCreatorId);

      expect(result).toBe(true);
    });

    test('should return false for expired subscription', async () => {
      await Subscription.create({
        subscriberId: mockSubscriberId,
        creatorId: mockCreatorId,
        tier: 'monthly',
        price_coins: 50,
        startedAt: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000),
        expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
        status: 'expired'
      });

      const result = await SubscriptionService.isActiveSubscriber(mockSubscriberId, mockCreatorId);

      expect(result).toBe(false);
    });
  });
});
