/**
 * Integration Tests - Socket.IO Real-Time Events
 * Tests WebSocket events for premium features
 */

const { v4: uuidv4 } = require('uuid');

// Test utilities
const { startTestServer, stopTestServer } = require('../utils/testServer');
const ApiClient = require('../utils/apiClient');
const SocketClient = require('../utils/socketClient');
const { cleanupAllCollections } = require('../utils/cleanupDB');
const { seedUsers } = require('../fixtures/seedUsers');
const { seedContent } = require('../fixtures/seedContent');

describe('Socket.IO Events - Integration Tests', () => {
  let app, server, io;
  let apiClient;
  let testUsers, testContent;
  const TEST_PORT = 5004;
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

  describe('PREMIUM_UNLOCKED Event', () => {
    it('should emit PREMIUM_UNLOCKED to buyer on successful unlock', async () => {
      const buyer = testUsers.buyer1;
      const content = testContent.premium_tutorial;

      const buyerToken = apiClient.generateToken(buyer.userId);
      const buyerSocket = new SocketClient(SOCKET_URL, buyerToken);
      await buyerSocket.connect();

      const eventPromise = buyerSocket.waitForEvent('PREMIUM_UNLOCKED', 5000);

      // Unlock content
      apiClient.authenticateAs(buyer.userId);
      await apiClient.post(`/api/premium/${content.contentId}/unlock`, {
        idempotencyKey: uuidv4(),
      });

      const event = await eventPromise;

      expect(event).toBeDefined();
      expect(event.contentId).toBe(content.contentId);
      expect(event.title).toBe(content.title);
      expect(event.amount_coins).toBe(content.price_coins);
      expect(event.unlockId).toBeDefined();
      expect(event.timestamp).toBeDefined();

      buyerSocket.disconnect();
    });

    it('should emit PREMIUM_UNLOCKED to creator with revenue info', async () => {
      const buyer = testUsers.buyer1;
      const creator = testUsers.creator1;
      const content = testContent.premium_tutorial; // 500 coins

      const creatorToken = apiClient.generateToken(creator.userId);
      const creatorSocket = new SocketClient(SOCKET_URL, creatorToken);
      await creatorSocket.connect();

      const eventPromise = creatorSocket.waitForEvent('PREMIUM_UNLOCKED', 5000);

      // Unlock content
      apiClient.authenticateAs(buyer.userId);
      await apiClient.post(`/api/premium/${content.contentId}/unlock`, {
        idempotencyKey: uuidv4(),
      });

      const event = await eventPromise;

      expect(event).toBeDefined();
      expect(event.contentId).toBe(content.contentId);
      expect(event.amount_coins).toBe(350); // Creator's 70% share
      expect(event.buyerId).toBe(buyer.userId);

      creatorSocket.disconnect();
    });
  });

  describe('SUBSCRIPTION_STARTED Event', () => {
    it('should emit SUBSCRIPTION_STARTED to subscriber', async () => {
      const subscriber = testUsers.buyer1;
      const creator = testUsers.creator1;

      const subscriberToken = apiClient.generateToken(subscriber.userId);
      const subscriberSocket = new SocketClient(SOCKET_URL, subscriberToken);
      await subscriberSocket.connect();

      const eventPromise = subscriberSocket.waitForEvent('SUBSCRIPTION_STARTED', 5000);

      // Subscribe
      apiClient.authenticateAs(subscriber.userId);
      await apiClient.post('/api/subscription/subscribe', {
        creatorId: creator.userId,
        tierId: 'monthly',
        idempotencyKey: uuidv4(),
      });

      const event = await eventPromise;

      expect(event).toBeDefined();
      expect(event.subscriptionId).toBeDefined();
      expect(event.creatorId).toBe(creator.userId);
      expect(event.tier).toBe('monthly');
      expect(event.expiresAt).toBeDefined();

      subscriberSocket.disconnect();
    });

    it('should emit SUBSCRIPTION_STARTED to creator', async () => {
      const subscriber = testUsers.buyer1;
      const creator = testUsers.creator1;

      const creatorToken = apiClient.generateToken(creator.userId);
      const creatorSocket = new SocketClient(SOCKET_URL, creatorToken);
      await creatorSocket.connect();

      const eventPromise = creatorSocket.waitForEvent('SUBSCRIPTION_STARTED', 5000);

      // Subscribe
      apiClient.authenticateAs(subscriber.userId);
      await apiClient.post('/api/subscription/subscribe', {
        creatorId: creator.userId,
        tierId: 'monthly',
        idempotencyKey: uuidv4(),
      });

      const event = await eventPromise;

      expect(event).toBeDefined();
      expect(event.subscriberId).toBe(subscriber.userId);

      creatorSocket.disconnect();
    });
  });

  describe('SUBSCRIPTION_CANCELLED Event', () => {
    it('should emit SUBSCRIPTION_CANCELLED on cancel', async () => {
      const subscriber = testUsers.buyer1;
      const creator = testUsers.creator1;

      // Subscribe first
      apiClient.authenticateAs(subscriber.userId);
      const subscribeResponse = await apiClient.post('/api/subscription/subscribe', {
        creatorId: creator.userId,
        tierId: 'monthly',
        idempotencyKey: uuidv4(),
      });

      const subscriptionId = subscribeResponse.body.subscription._id;

      // Setup socket
      const subscriberToken = apiClient.generateToken(subscriber.userId);
      const subscriberSocket = new SocketClient(SOCKET_URL, subscriberToken);
      await subscriberSocket.connect();

      const eventPromise = subscriberSocket.waitForEvent('SUBSCRIPTION_CANCELLED', 5000);

      // Cancel
      await apiClient.post(`/api/subscription/${subscriptionId}/cancel`, {
        reason: 'Testing cancellation event',
      });

      const event = await eventPromise;

      expect(event).toBeDefined();
      expect(event.subscriptionId).toBe(subscriptionId);
      expect(event.timestamp).toBeDefined();

      subscriberSocket.disconnect();
    });
  });

  describe('REVENUE_UPDATED Event', () => {
    it('should emit REVENUE_UPDATED to creator after unlock', async () => {
      const buyer = testUsers.buyer1;
      const creator = testUsers.creator1;
      const content = testContent.premium_tutorial;

      const creatorToken = apiClient.generateToken(creator.userId);
      const creatorSocket = new SocketClient(SOCKET_URL, creatorToken);
      await creatorSocket.connect();

      const eventPromise = creatorSocket.waitForEvent('REVENUE_UPDATED', 5000);

      // Unlock content
      apiClient.authenticateAs(buyer.userId);
      await apiClient.post(`/api/premium/${content.contentId}/unlock`, {
        idempotencyKey: uuidv4(),
      });

      const event = await eventPromise;

      expect(event).toBeDefined();
      expect(event.type).toBe('unlock');
      expect(event.contentId).toBe(content.contentId);
      expect(event.amount_coins).toBe(350); // 70% of 500
      expect(event.totalRevenue_coins).toBeDefined();

      creatorSocket.disconnect();
    });

    it('should emit REVENUE_UPDATED to creator after subscription', async () => {
      const subscriber = testUsers.buyer1;
      const creator = testUsers.creator1;

      const creatorToken = apiClient.generateToken(creator.userId);
      const creatorSocket = new SocketClient(SOCKET_URL, creatorToken);
      await creatorSocket.connect();

      const eventPromise = creatorSocket.waitForEvent('REVENUE_UPDATED', 5000);

      // Subscribe
      apiClient.authenticateAs(subscriber.userId);
      await apiClient.post('/api/subscription/subscribe', {
        creatorId: creator.userId,
        tierId: 'monthly',
        idempotencyKey: uuidv4(),
      });

      const event = await eventPromise;

      expect(event).toBeDefined();
      expect(event.type).toBe('subscription');
      expect(event.amount_coins).toBeGreaterThan(0);

      creatorSocket.disconnect();
    });
  });

  describe('BALANCE_UPDATED Event', () => {
    it('should emit BALANCE_UPDATED to buyer after unlock', async () => {
      const buyer = testUsers.buyer1;
      const content = testContent.premium_tutorial;

      const buyerToken = apiClient.generateToken(buyer.userId);
      const buyerSocket = new SocketClient(SOCKET_URL, buyerToken);
      await buyerSocket.connect();

      const eventPromise = buyerSocket.waitForEvent('BALANCE_UPDATED', 5000);

      // Unlock content
      apiClient.authenticateAs(buyer.userId);
      await apiClient.post(`/api/premium/${content.contentId}/unlock`, {
        idempotencyKey: uuidv4(),
      });

      const event = await eventPromise;

      expect(event).toBeDefined();
      expect(event.balance_coins).toBeDefined();
      expect(event.change_coins).toBe(-500);

      buyerSocket.disconnect();
    });
  });

  describe('Multiple Clients Per User', () => {
    it('should emit events to all connected clients of same user', async () => {
      const buyer = testUsers.buyer1;
      const content = testContent.premium_tutorial;

      const buyerToken = apiClient.generateToken(buyer.userId);

      // Connect 3 clients for same user
      const socket1 = new SocketClient(SOCKET_URL, buyerToken);
      const socket2 = new SocketClient(SOCKET_URL, buyerToken);
      const socket3 = new SocketClient(SOCKET_URL, buyerToken);

      await Promise.all([
        socket1.connect(),
        socket2.connect(),
        socket3.connect(),
      ]);

      const event1Promise = socket1.waitForEvent('PREMIUM_UNLOCKED', 5000);
      const event2Promise = socket2.waitForEvent('PREMIUM_UNLOCKED', 5000);
      const event3Promise = socket3.waitForEvent('PREMIUM_UNLOCKED', 5000);

      // Unlock content
      apiClient.authenticateAs(buyer.userId);
      await apiClient.post(`/api/premium/${content.contentId}/unlock`, {
        idempotencyKey: uuidv4(),
      });

      // All clients should receive event
      const [event1, event2, event3] = await Promise.all([
        event1Promise,
        event2Promise,
        event3Promise,
      ]);

      expect(event1).toBeDefined();
      expect(event2).toBeDefined();
      expect(event3).toBeDefined();

      socket1.disconnect();
      socket2.disconnect();
      socket3.disconnect();
    });
  });

  describe('Connection Authentication', () => {
    it('should reject connection without valid token', async () => {
      const socket = new SocketClient(SOCKET_URL, 'invalid-token');

      await expect(socket.connect()).rejects.toThrow();
    });

    it('should accept connection with valid token', async () => {
      const buyer = testUsers.buyer1;
      const buyerToken = apiClient.generateToken(buyer.userId);
      const socket = new SocketClient(SOCKET_URL, buyerToken);

      await expect(socket.connect()).resolves.not.toThrow();
      expect(socket.isConnected()).toBe(true);

      socket.disconnect();
    });
  });

  describe('Reconnection Handling', () => {
    it('should handle disconnection and reconnection', async () => {
      const buyer = testUsers.buyer1;
      const buyerToken = apiClient.generateToken(buyer.userId);
      const socket = new SocketClient(SOCKET_URL, buyerToken);

      await socket.connect();
      expect(socket.isConnected()).toBe(true);

      socket.disconnect();
      expect(socket.isConnected()).toBe(false);

      // Reconnect
      await socket.connect();
      expect(socket.isConnected()).toBe(true);

      socket.disconnect();
    });
  });
});
