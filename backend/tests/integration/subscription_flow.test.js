/**
 * Integration Tests - Subscription Flow
 * Tests subscription purchase, renewal, expiry, and access control
 */

const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

// Test utilities
const { startTestServer, stopTestServer } = require('../utils/testServer');
const ApiClient = require('../utils/apiClient');
const SocketClient = require('../utils/socketClient');
const { cleanupAllCollections } = require('../utils/cleanupDB');
const { seedUsers } = require('../fixtures/seedUsers');
const { seedContent } = require('../fixtures/seedContent');

// Models
const Wallet = require('../../models/Wallet');
const Subscription = require('../../models/Subscription');
const CreatorRevenue = require('../../models/CreatorRevenue');
const PremiumContent = require('../../models/PremiumContent');

// Services
const SubscriptionService = require('../../services/SubscriptionService');

describe('Subscription Flow - Integration Tests', () => {
  let app, server, io;
  let apiClient;
  let testUsers, testContent;
  const TEST_PORT = 5002;
  const SOCKET_URL = `http://localhost:${TEST_PORT}`;

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

  describe('Subscribe Success Flow', () => {
    it('should successfully create monthly subscription', async () => {
      const subscriber = testUsers.buyer1; // 10,000 coins
      const creator = testUsers.creator1;
      const tierId = 'monthly'; // 1000 coins, 30 days
      const idempotencyKey = uuidv4();

      apiClient.authenticateAs(subscriber.userId);

      const initialWallet = await Wallet.findOne({ userId: subscriber.userId });
      const initialRevenue = await CreatorRevenue.findOne({ 
        creatorId: creator.userId 
      });

      // Subscribe
      const response = await apiClient.post('/api/subscription/subscribe', {
        creatorId: creator.userId,
        tierId,
        idempotencyKey,
      });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.subscription).toBeDefined();
      expect(response.body.subscription.tier).toBe('monthly');
      expect(response.body.subscription.status).toBe('active');

      // Check wallet deducted 1000 coins
      const finalWallet = await Wallet.findOne({ userId: subscriber.userId });
      expect(finalWallet.balance_coins).toBe(initialWallet.balance_coins - 1000);

      // Check subscription record created
      const subscription = await Subscription.findOne({
        subscriberId: subscriber.userId,
        creatorId: creator.userId,
      });
      expect(subscription).toBeDefined();
      expect(subscription.tier).toBe('monthly');
      expect(subscription.price_coins).toBe(1000);
      expect(subscription.status).toBe('active');

      // Check expiresAt is ~30 days from now
      const daysUntilExpiry = Math.floor(
        (subscription.expiresAt - new Date()) / (1000 * 60 * 60 * 24)
      );
      expect(daysUntilExpiry).toBeGreaterThanOrEqual(29);
      expect(daysUntilExpiry).toBeLessThanOrEqual(31);

      // Check creator revenue updated
      const finalRevenue = await CreatorRevenue.findOne({ 
        creatorId: creator.userId 
      });
      expect(finalRevenue.pending_coins).toBeGreaterThan(
        initialRevenue.pending_coins
      );
    });

    it('should successfully create quarterly subscription', async () => {
      const subscriber = testUsers.buyer1;
      const creator = testUsers.creator1;
      const tierId = 'quarterly'; // 2700 coins, 90 days

      apiClient.authenticateAs(subscriber.userId);

      const response = await apiClient.post('/api/subscription/subscribe', {
        creatorId: creator.userId,
        tierId,
        idempotencyKey: uuidv4(),
      });

      expect(response.status).toBe(200);

      const subscription = await Subscription.findOne({
        subscriberId: subscriber.userId,
        creatorId: creator.userId,
      });

      const daysUntilExpiry = Math.floor(
        (subscription.expiresAt - new Date()) / (1000 * 60 * 60 * 24)
      );
      expect(daysUntilExpiry).toBeGreaterThanOrEqual(89);
      expect(daysUntilExpiry).toBeLessThanOrEqual(91);
    });

    it('should successfully create yearly subscription', async () => {
      const subscriber = testUsers.buyer1;
      const creator = testUsers.creator1;
      const tierId = 'yearly'; // 9600 coins, 365 days

      apiClient.authenticateAs(subscriber.userId);

      const response = await apiClient.post('/api/subscription/subscribe', {
        creatorId: creator.userId,
        tierId,
        idempotencyKey: uuidv4(),
      });

      expect(response.status).toBe(200);

      const subscription = await Subscription.findOne({
        subscriberId: subscriber.userId,
        creatorId: creator.userId,
      });

      const daysUntilExpiry = Math.floor(
        (subscription.expiresAt - new Date()) / (1000 * 60 * 60 * 24)
      );
      expect(daysUntilExpiry).toBeGreaterThanOrEqual(364);
      expect(daysUntilExpiry).toBeLessThanOrEqual(366);
    });

    it('should emit Socket.io events on successful subscription', async () => {
      const subscriber = testUsers.buyer1;
      const creator = testUsers.creator1;

      const subscriberToken = apiClient.generateToken(subscriber.userId);
      const creatorToken = apiClient.generateToken(creator.userId);

      const subscriberSocket = new SocketClient(SOCKET_URL, subscriberToken);
      const creatorSocket = new SocketClient(SOCKET_URL, creatorToken);

      await subscriberSocket.connect();
      await creatorSocket.connect();

      const subscriberEventPromise = subscriberSocket.waitForEvent(
        'SUBSCRIPTION_STARTED', 
        5000
      );
      const creatorEventPromise = creatorSocket.waitForEvent(
        'SUBSCRIPTION_STARTED',
        5000
      );

      // Subscribe
      apiClient.authenticateAs(subscriber.userId);
      await apiClient.post('/api/subscription/subscribe', {
        creatorId: creator.userId,
        tierId: 'monthly',
        idempotencyKey: uuidv4(),
      });

      const [subscriberEvent, creatorEvent] = await Promise.all([
        subscriberEventPromise,
        creatorEventPromise,
      ]);

      expect(subscriberEvent).toBeDefined();
      expect(subscriberEvent.tier).toBe('monthly');
      expect(creatorEvent).toBeDefined();

      subscriberSocket.disconnect();
      creatorSocket.disconnect();
    });
  });

  describe('Access Control After Subscription', () => {
    it('should grant access to all creator content after subscribing', async () => {
      const subscriber = testUsers.buyer1;
      const creator = testUsers.creator1;

      apiClient.authenticateAs(subscriber.userId);

      // Subscribe
      await apiClient.post('/api/subscription/subscribe', {
        creatorId: creator.userId,
        tierId: 'monthly',
        idempotencyKey: uuidv4(),
      });

      // Get all creator1 content
      const creatorContent = Object.values(testContent).filter(
        c => c.creatorId === creator.userId && c.is_published
      );

      // Check access to each content
      for (const content of creatorContent) {
        const response = await apiClient.get(
          `/api/premium/${content.contentId}`
        );
        
        expect(response.status).toBe(200);
        expect(response.body.access_granted).toBe(true);
      }
    });

    it('should grant access to subscriber-only content', async () => {
      const subscriber = testUsers.buyer1;
      const creator = testUsers.creator1;
      const subscriberOnlyContent = testContent.vip_only; // subscriber_only: true

      apiClient.authenticateAs(subscriber.userId);

      // Try access before subscription (should fail)
      let response = await apiClient.get(
        `/api/premium/${subscriberOnlyContent.contentId}`
      );
      expect(response.body.access_granted).toBe(false);

      // Subscribe
      await apiClient.post('/api/subscription/subscribe', {
        creatorId: creator.userId,
        tierId: 'monthly',
        idempotencyKey: uuidv4(),
      });

      // Try access after subscription (should succeed)
      response = await apiClient.get(
        `/api/premium/${subscriberOnlyContent.contentId}`
      );
      expect(response.status).toBe(200);
      expect(response.body.access_granted).toBe(true);
    });
  });

  describe('Subscription Expiry Flow', () => {
    it('should remove access when subscription expires', async () => {
      const subscriber = testUsers.buyer1;
      const creator = testUsers.creator1;

      apiClient.authenticateAs(subscriber.userId);

      // Subscribe
      await apiClient.post('/api/subscription/subscribe', {
        creatorId: creator.userId,
        tierId: 'monthly',
        idempotencyKey: uuidv4(),
      });

      // Verify subscription active
      let subscription = await Subscription.findOne({
        subscriberId: subscriber.userId,
        creatorId: creator.userId,
      });
      expect(subscription.status).toBe('active');

      // Manually expire subscription
      subscription.expiresAt = new Date(Date.now() - 1000); // 1 second ago
      subscription.status = 'expired';
      await subscription.save();

      // Run batch expiry job
      await SubscriptionService.processExpiredSubscriptions();

      // Check subscription marked as expired
      subscription = await Subscription.findOne({
        subscriberId: subscriber.userId,
        creatorId: creator.userId,
      });
      expect(subscription.status).toBe('expired');

      // Check access removed from content
      const content = testContent.premium_tutorial;
      const premiumContent = await PremiumContent.findById(content.contentId);
      expect(premiumContent.allowed_subscribers).not.toContain(
        subscriber.userId
      );

      // Try accessing content (should fail)
      const response = await apiClient.get(
        `/api/premium/${content.contentId}`
      );
      expect(response.body.access_granted).toBe(false);
    });

    it('should process multiple expired subscriptions in batch', async () => {
      const subscribers = [testUsers.buyer1, testUsers.buyer2, testUsers.buyer3];
      const creator = testUsers.creator1;

      // Create 3 subscriptions
      for (const subscriber of subscribers) {
        apiClient.authenticateAs(subscriber.userId);
        await apiClient.post('/api/subscription/subscribe', {
          creatorId: creator.userId,
          tierId: 'monthly',
          idempotencyKey: uuidv4(),
        });
      }

      // Expire all subscriptions
      await Subscription.updateMany(
        { creatorId: creator.userId },
        { 
          expiresAt: new Date(Date.now() - 1000),
          status: 'active', // Mark as active for expiry job to process
        }
      );

      // Run batch expiry
      const result = await SubscriptionService.processExpiredSubscriptions();
      expect(result.expired_count).toBe(3);

      // Verify all marked expired
      const expiredSubs = await Subscription.find({
        creatorId: creator.userId,
        status: 'expired',
      });
      expect(expiredSubs.length).toBe(3);
    });
  });

  describe('Cancel Subscription Flow', () => {
    it('should successfully cancel active subscription', async () => {
      const subscriber = testUsers.buyer1;
      const creator = testUsers.creator1;

      apiClient.authenticateAs(subscriber.userId);

      // Subscribe
      const subscribeResponse = await apiClient.post(
        '/api/subscription/subscribe',
        {
          creatorId: creator.userId,
          tierId: 'monthly',
          idempotencyKey: uuidv4(),
        }
      );

      const subscriptionId = subscribeResponse.body.subscription._id;

      // Cancel
      const cancelResponse = await apiClient.post(
        `/api/subscription/${subscriptionId}/cancel`,
        { reason: 'Testing cancel flow' }
      );

      expect(cancelResponse.status).toBe(200);
      expect(cancelResponse.body.success).toBe(true);

      // Verify subscription cancelled
      const subscription = await Subscription.findById(subscriptionId);
      expect(subscription.status).toBe('cancelled');
      expect(subscription.cancelledAt).toBeDefined();

      // Verify access removed
      const content = testContent.premium_tutorial;
      const response = await apiClient.get(
        `/api/premium/${content.contentId}`
      );
      expect(response.body.access_granted).toBe(false);
    });

    it('should emit SUBSCRIPTION_CANCELLED event on cancel', async () => {
      const subscriber = testUsers.buyer1;
      const creator = testUsers.creator1;

      // Subscribe first
      apiClient.authenticateAs(subscriber.userId);
      const subscribeResponse = await apiClient.post(
        '/api/subscription/subscribe',
        {
          creatorId: creator.userId,
          tierId: 'monthly',
          idempotencyKey: uuidv4(),
        }
      );

      const subscriptionId = subscribeResponse.body.subscription._id;

      // Setup socket
      const subscriberToken = apiClient.generateToken(subscriber.userId);
      const subscriberSocket = new SocketClient(SOCKET_URL, subscriberToken);
      await subscriberSocket.connect();

      const cancelEventPromise = subscriberSocket.waitForEvent(
        'SUBSCRIPTION_CANCELLED',
        5000
      );

      // Cancel
      await apiClient.post(`/api/subscription/${subscriptionId}/cancel`, {
        reason: 'Testing socket events',
      });

      const cancelEvent = await cancelEventPromise;
      expect(cancelEvent).toBeDefined();
      expect(cancelEvent.subscriptionId).toBe(subscriptionId);

      subscriberSocket.disconnect();
    });
  });

  describe('Auto-Renewal Tests', () => {
    it('should auto-renew subscription if balance sufficient', async () => {
      const subscriber = testUsers.buyer1; // 10,000 coins
      const creator = testUsers.creator1;

      apiClient.authenticateAs(subscriber.userId);

      // Subscribe with auto-renew enabled
      const response = await apiClient.post('/api/subscription/subscribe', {
        creatorId: creator.userId,
        tierId: 'monthly',
        idempotencyKey: uuidv4(),
        autoRenew: true,
      });

      const subscriptionId = response.body.subscription._id;

      // Simulate subscription expiring (set expiresAt to now)
      let subscription = await Subscription.findById(subscriptionId);
      subscription.expiresAt = new Date();
      await subscription.save();

      const initialWallet = await Wallet.findOne({ userId: subscriber.userId });

      // Manually trigger renewal (would be done by cron)
      await SubscriptionService.processRenewals();

      // Check wallet charged again
      const finalWallet = await Wallet.findOne({ userId: subscriber.userId });
      expect(finalWallet.balance_coins).toBeLessThan(
        initialWallet.balance_coins
      );

      // Check subscription renewed
      subscription = await Subscription.findById(subscriptionId);
      expect(subscription.status).toBe('active');
      expect(subscription.expiresAt).toBeInstanceOf(Date);
      expect(subscription.expiresAt.getTime()).toBeGreaterThan(Date.now());
    });

    it('should expire subscription if auto-renew fails (insufficient balance)', async () => {
      const subscriber = testUsers.poorbuyer; // 10 coins
      const creator = testUsers.creator2; // Monthly: 800 coins

      // Manually give poor buyer enough for first subscription
      await Wallet.findOneAndUpdate(
        { userId: subscriber.userId },
        { balance_coins: 800 }
      );

      apiClient.authenticateAs(subscriber.userId);

      // Subscribe with auto-renew
      const response = await apiClient.post('/api/subscription/subscribe', {
        creatorId: creator.userId,
        tierId: 'monthly',
        idempotencyKey: uuidv4(),
        autoRenew: true,
      });

      const subscriptionId = response.body.subscription._id;

      // Now balance is 0, set expiry
      let subscription = await Subscription.findById(subscriptionId);
      subscription.expiresAt = new Date();
      await subscription.save();

      // Try to renew (should fail due to insufficient balance)
      await SubscriptionService.processRenewals();

      // Check subscription expired
      subscription = await Subscription.findById(subscriptionId);
      expect(subscription.status).toBe('expired');
    });
  });

  describe('Idempotency Tests', () => {
    it('should not double-charge on duplicate subscription request', async () => {
      const subscriber = testUsers.buyer1;
      const creator = testUsers.creator1;
      const idempotencyKey = uuidv4();

      apiClient.authenticateAs(subscriber.userId);

      const initialWallet = await Wallet.findOne({ userId: subscriber.userId });

      // First subscription
      const response1 = await apiClient.post('/api/subscription/subscribe', {
        creatorId: creator.userId,
        tierId: 'monthly',
        idempotencyKey,
      });
      expect(response1.status).toBe(200);

      // Second subscription - same key
      const response2 = await apiClient.post('/api/subscription/subscribe', {
        creatorId: creator.userId,
        tierId: 'monthly',
        idempotencyKey,
      });
      expect(response2.status).toBe(200);

      // Balance should only be charged once
      const finalWallet = await Wallet.findOne({ userId: subscriber.userId });
      expect(finalWallet.balance_coins).toBe(
        initialWallet.balance_coins - 1000
      );

      // Only one subscription record
      const subscriptions = await Subscription.find({
        subscriberId: subscriber.userId,
        creatorId: creator.userId,
      });
      expect(subscriptions.length).toBe(1);
    });
  });

  describe('Insufficient Balance Tests', () => {
    it('should reject subscription with insufficient balance', async () => {
      const subscriber = testUsers.poorbuyer; // 10 coins
      const creator = testUsers.creator1; // Monthly: 1000 coins

      apiClient.authenticateAs(subscriber.userId);

      const response = await apiClient.post('/api/subscription/subscribe', {
        creatorId: creator.userId,
        tierId: 'monthly',
        idempotencyKey: uuidv4(),
      });

      expect(response.status).toBe(400);
      expect(response.body.code).toBe('INSUFFICIENT_BALANCE');

      // No subscription created
      const subscription = await Subscription.findOne({
        subscriberId: subscriber.userId,
        creatorId: creator.userId,
      });
      expect(subscription).toBeNull();
    });
  });

  describe('My Subscriptions API', () => {
    it('should list user subscriptions correctly', async () => {
      const subscriber = testUsers.buyer1;
      const creators = [testUsers.creator1, testUsers.creator2];

      apiClient.authenticateAs(subscriber.userId);

      // Subscribe to both creators
      for (const creator of creators) {
        await apiClient.post('/api/subscription/subscribe', {
          creatorId: creator.userId,
          tierId: 'monthly',
          idempotencyKey: uuidv4(),
        });
      }

      // Get my subscriptions
      const response = await apiClient.get('/api/subscription/my-subscriptions');
      expect(response.status).toBe(200);
      expect(response.body.subscriptions).toBeDefined();
      expect(response.body.subscriptions.length).toBe(2);
    });
  });
});
