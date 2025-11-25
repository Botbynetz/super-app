/**
 * Integration Tests - Premium Content Unlock Flow
 * Tests end-to-end unlock functionality with revenue splits, idempotency, and concurrency
 */

const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

// Test utilities
const { startTestServer, stopTestServer, getIO } = require('../utils/testServer');
const ApiClient = require('../utils/apiClient');
const SocketClient = require('../utils/socketClient');
const { cleanupAllCollections } = require('../utils/cleanupDB');
const { seedUsers } = require('../fixtures/seedUsers');
const { seedContent } = require('../fixtures/seedContent');

// Models
const Wallet = require('../../models/Wallet');
const PremiumUnlock = require('../../models/PremiumUnlock');
const CreatorRevenue = require('../../models/CreatorRevenue');
const WalletTransaction = require('../../models/WalletTransaction');
const AuditLog = require('../../models/AuditLog');

describe('Premium Content Unlock Flow - Integration Tests', () => {
  let app, server, io;
  let apiClient;
  let testUsers, testContent;
  const TEST_PORT = 5001;
  const SOCKET_URL = `http://localhost:${TEST_PORT}`;

  beforeAll(async () => {
    // Start test server
    ({ app, server, io } = await startTestServer(TEST_PORT));
    apiClient = new ApiClient(app);
  });

  afterAll(async () => {
    await stopTestServer();
  });

  beforeEach(async () => {
    // Clean database and seed test data
    await cleanupAllCollections();
    testUsers = await seedUsers();
    
    testContent = await seedContent({
      creator1: testUsers.creator1.userId,
      creator2: testUsers.creator2.userId,
    });
  });

  describe('Successful Unlock Flow', () => {
    it('should successfully unlock premium content with correct revenue split', async () => {
      const buyer = testUsers.buyer1; // 10,000 coins
      const content = testContent.premium_tutorial; // 500 coins, creator1
      const idempotencyKey = uuidv4();

      // Authenticate as buyer
      apiClient.authenticateAs(buyer.userId);

      // Get initial balances
      const initialBuyerWallet = await Wallet.findOne({ userId: buyer.userId });
      const initialCreatorRevenue = await CreatorRevenue.findOne({ 
        creatorId: content.creatorId 
      });
      const initialPlatformWallet = await Wallet.findOne({ 
        userId: testUsers.platform.userId 
      });

      // Unlock content
      const response = await apiClient.post(
        `/api/premium/${content.contentId}/unlock`,
        { idempotencyKey }
      );

      // Assert HTTP response
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.unlock).toBeDefined();
      expect(response.body.unlock.contentId).toBe(content.contentId);
      expect(response.body.unlock.amount_coins).toBe(500);

      // Assert buyer wallet deducted
      const finalBuyerWallet = await Wallet.findOne({ userId: buyer.userId });
      expect(finalBuyerWallet.balance_coins).toBe(
        initialBuyerWallet.balance_coins - 500
      );

      // Assert revenue split (70% creator, 25% platform, 5% processing)
      const creatorShare = Math.floor(500 * 0.70); // 350
      const platformShare = Math.floor(500 * 0.25); // 125
      const processingFee = Math.floor(500 * 0.05); // 25

      // Check creator revenue
      const finalCreatorRevenue = await CreatorRevenue.findOne({ 
        creatorId: content.creatorId 
      });
      expect(finalCreatorRevenue.pending_coins).toBe(
        initialCreatorRevenue.pending_coins + creatorShare
      );

      // Check platform wallet
      const finalPlatformWallet = await Wallet.findOne({ 
        userId: testUsers.platform.userId 
      });
      expect(finalPlatformWallet.balance_coins).toBe(
        initialPlatformWallet.balance_coins + platformShare
      );

      // Check PremiumUnlock record created
      const unlock = await PremiumUnlock.findOne({
        userId: buyer.userId,
        contentId: content.contentId,
      });
      expect(unlock).toBeDefined();
      expect(unlock.amount_coins).toBe(500);
      expect(unlock.creator_share_coins).toBe(creatorShare);
      expect(unlock.platform_share_coins).toBe(platformShare);
      expect(unlock.processing_fee_coins).toBe(processingFee);
      expect(unlock.idempotencyKey).toBe(idempotencyKey);

      // Check WalletTransaction records
      const transactions = await WalletTransaction.find({
        $or: [
          { userId: buyer.userId },
          { userId: testUsers.platform.userId },
        ],
      });
      expect(transactions.length).toBeGreaterThanOrEqual(2); // Buyer debit + platform credit

      // Check AuditLog created
      const auditLogs = await AuditLog.find({
        action: 'PREMIUM_UNLOCK',
        userId: buyer.userId,
      });
      expect(auditLogs.length).toBeGreaterThan(0);
    });

    it('should emit Socket.io events to buyer and creator on unlock', async () => {
      const buyer = testUsers.buyer1;
      const creator = testUsers.creator1;
      const content = testContent.premium_tutorial;
      const idempotencyKey = uuidv4();

      // Setup Socket.IO clients
      const buyerToken = apiClient.generateToken(buyer.userId);
      const creatorToken = apiClient.generateToken(creator.userId);

      const buyerSocket = new SocketClient(SOCKET_URL, buyerToken);
      const creatorSocket = new SocketClient(SOCKET_URL, creatorToken);

      await buyerSocket.connect();
      await creatorSocket.connect();

      // Setup event listeners
      const buyerEventPromise = buyerSocket.waitForEvent('PREMIUM_UNLOCKED', 5000);
      const creatorEventPromise = creatorSocket.waitForEvent('PREMIUM_UNLOCKED', 5000);

      // Authenticate API client and unlock
      apiClient.authenticateAs(buyer.userId);
      await apiClient.post(`/api/premium/${content.contentId}/unlock`, {
        idempotencyKey,
      });

      // Wait for Socket.io events
      const [buyerEvent, creatorEvent] = await Promise.all([
        buyerEventPromise,
        creatorEventPromise,
      ]);

      // Assert buyer event
      expect(buyerEvent).toBeDefined();
      expect(buyerEvent.contentId).toBe(content.contentId);
      expect(buyerEvent.amount_coins).toBe(500);
      expect(buyerEvent.title).toBe(content.title);

      // Assert creator event
      expect(creatorEvent).toBeDefined();
      expect(creatorEvent.contentId).toBe(content.contentId);
      expect(creatorEvent.amount_coins).toBe(350); // Creator's 70% share

      // Cleanup
      buyerSocket.disconnect();
      creatorSocket.disconnect();
    });
  });

  describe('Idempotency Tests', () => {
    it('should not double-charge on duplicate unlock with same idempotencyKey', async () => {
      const buyer = testUsers.buyer2; // 2,000 coins
      const content = testContent.exclusive; // 300 coins
      const idempotencyKey = uuidv4();

      apiClient.authenticateAs(buyer.userId);

      // Get initial balance
      const initialWallet = await Wallet.findOne({ userId: buyer.userId });

      // First unlock - should succeed
      const response1 = await apiClient.post(
        `/api/premium/${content.contentId}/unlock`,
        { idempotencyKey }
      );
      expect(response1.status).toBe(200);

      // Check balance after first unlock
      const walletAfterFirst = await Wallet.findOne({ userId: buyer.userId });
      expect(walletAfterFirst.balance_coins).toBe(
        initialWallet.balance_coins - 300
      );

      // Second unlock - same idempotency key, should return success but not charge
      const response2 = await apiClient.post(
        `/api/premium/${content.contentId}/unlock`,
        { idempotencyKey }
      );
      expect(response2.status).toBe(200);
      expect(response2.body.message).toContain('already unlocked');

      // Balance should remain unchanged
      const walletAfterSecond = await Wallet.findOne({ userId: buyer.userId });
      expect(walletAfterSecond.balance_coins).toBe(walletAfterFirst.balance_coins);

      // Verify only ONE PremiumUnlock record exists
      const unlocks = await PremiumUnlock.find({
        userId: buyer.userId,
        contentId: content.contentId,
      });
      expect(unlocks.length).toBe(1);
    });

    it('should allow unlock with different idempotencyKey (but block duplicate content)', async () => {
      const buyer = testUsers.buyer1;
      const content = testContent.premium_tutorial;
      const idempotencyKey1 = uuidv4();
      const idempotencyKey2 = uuidv4();

      apiClient.authenticateAs(buyer.userId);

      // First unlock
      const response1 = await apiClient.post(
        `/api/premium/${content.contentId}/unlock`,
        { idempotencyKey: idempotencyKey1 }
      );
      expect(response1.status).toBe(200);

      // Second unlock - different key but same content
      const response2 = await apiClient.post(
        `/api/premium/${content.contentId}/unlock`,
        { idempotencyKey: idempotencyKey2 }
      );
      
      // Should return 400 or success with "already unlocked" message
      expect([200, 400]).toContain(response2.status);
      if (response2.status === 200) {
        expect(response2.body.message).toContain('already unlocked');
      }
    });
  });

  describe('Concurrent Unlock Tests', () => {
    it('should handle concurrent unlock attempts correctly (no negative balance)', async () => {
      const buyer = testUsers.buyer3; // 500 coins
      const content = testContent.premium_tutorial; // 500 coins
      
      apiClient.authenticateAs(buyer.userId);

      // Launch 10 concurrent unlock requests with SAME idempotencyKey
      const idempotencyKey = uuidv4();
      const requests = Array.from({ length: 10 }, () =>
        apiClient.post(`/api/premium/${content.contentId}/unlock`, {
          idempotencyKey,
        }).catch(err => err.response || err)
      );

      const responses = await Promise.all(requests);

      // Count successful unlocks (should be exactly 1)
      const successfulResponses = responses.filter(
        r => r.status === 200 || r.statusCode === 200
      );

      // At least one should succeed
      expect(successfulResponses.length).toBeGreaterThan(0);

      // Check final balance (should be exactly 0 if one unlock succeeded)
      const finalWallet = await Wallet.findOne({ userId: buyer.userId });
      expect(finalWallet.balance_coins).toBe(0);
      expect(finalWallet.balance_coins).toBeGreaterThanOrEqual(0); // Never negative

      // Verify only ONE PremiumUnlock record
      const unlocks = await PremiumUnlock.find({
        userId: buyer.userId,
        contentId: content.contentId,
      });
      expect(unlocks.length).toBe(1);
    });

    it('should handle concurrent unlocks of different content correctly', async () => {
      const buyer = testUsers.buyer1; // 10,000 coins
      const contents = [
        testContent.premium_tutorial, // 500 coins
        testContent.exclusive, // 300 coins
        testContent.react_hooks_masterclass, // 400 coins
      ];

      apiClient.authenticateAs(buyer.userId);

      const initialWallet = await Wallet.findOne({ userId: buyer.userId });
      const totalCost = 500 + 300 + 400; // 1200 coins

      // Launch concurrent unlocks for different content
      const requests = contents.map(content =>
        apiClient.post(`/api/premium/${content.contentId}/unlock`, {
          idempotencyKey: uuidv4(),
        })
      );

      const responses = await Promise.all(requests);

      // All should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });

      // Check final balance
      const finalWallet = await Wallet.findOne({ userId: buyer.userId });
      expect(finalWallet.balance_coins).toBe(
        initialWallet.balance_coins - totalCost
      );

      // Verify 3 PremiumUnlock records
      const unlocks = await PremiumUnlock.find({ userId: buyer.userId });
      expect(unlocks.length).toBe(3);
    });
  });

  describe('Insufficient Balance Tests', () => {
    it('should reject unlock when buyer has insufficient balance', async () => {
      const buyer = testUsers.poorbuyer; // 10 coins
      const content = testContent.premium_tutorial; // 500 coins

      apiClient.authenticateAs(buyer.userId);

      const initialWallet = await Wallet.findOne({ userId: buyer.userId });

      const response = await apiClient.post(
        `/api/premium/${content.contentId}/unlock`,
        { idempotencyKey: uuidv4() }
      );

      // Should return 400 error
      expect(response.status).toBe(400);
      expect(response.body.code).toBe('INSUFFICIENT_BALANCE');

      // Balance should remain unchanged
      const finalWallet = await Wallet.findOne({ userId: buyer.userId });
      expect(finalWallet.balance_coins).toBe(initialWallet.balance_coins);

      // No PremiumUnlock record created
      const unlocks = await PremiumUnlock.find({
        userId: buyer.userId,
        contentId: content.contentId,
      });
      expect(unlocks.length).toBe(0);

      // No WalletTransaction created
      const transactions = await WalletTransaction.find({
        userId: buyer.userId,
        type: 'debit',
      });
      expect(transactions.length).toBe(0);
    });
  });

  describe('Access Control Tests', () => {
    it('should grant access after successful unlock', async () => {
      const buyer = testUsers.buyer1;
      const content = testContent.premium_tutorial;

      apiClient.authenticateAs(buyer.userId);

      // Unlock content
      await apiClient.post(`/api/premium/${content.contentId}/unlock`, {
        idempotencyKey: uuidv4(),
      });

      // Check access
      const response = await apiClient.get(`/api/premium/${content.contentId}`);
      expect(response.status).toBe(200);
      expect(response.body.access_granted).toBe(true);
      expect(response.body.content.fullMediaUrl).toBeDefined();
    });

    it('should deny access without unlock', async () => {
      const buyer = testUsers.buyer1;
      const content = testContent.premium_tutorial;

      apiClient.authenticateAs(buyer.userId);

      // Try to access without unlocking
      const response = await apiClient.get(`/api/premium/${content.contentId}`);
      
      // Should return preview only or 403
      expect([200, 403]).toContain(response.status);
      if (response.status === 200) {
        expect(response.body.access_granted).toBe(false);
        expect(response.body.content.fullMediaUrl).toBeUndefined();
        expect(response.body.content.previewMediaUrl).toBeDefined();
      }
    });

    it('should grant creator automatic access to own content', async () => {
      const creator = testUsers.creator1;
      const content = testContent.premium_tutorial;

      apiClient.authenticateAs(creator.userId);

      const response = await apiClient.get(`/api/premium/${content.contentId}`);
      expect(response.status).toBe(200);
      expect(response.body.access_granted).toBe(true);
      expect(response.body.content.fullMediaUrl).toBeDefined();
    });
  });

  describe('Free Content Tests', () => {
    it('should allow access to free content without unlock', async () => {
      const buyer = testUsers.buyer1;
      const content = testContent.free_sample; // 0 coins

      apiClient.authenticateAs(buyer.userId);

      const response = await apiClient.get(`/api/premium/${content.contentId}`);
      expect(response.status).toBe(200);
      expect(response.body.access_granted).toBe(true);
      expect(response.body.content.fullMediaUrl).toBeDefined();
    });
  });
});
