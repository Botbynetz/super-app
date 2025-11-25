const mongoose = require('mongoose');
const PremiumContentService = require('../../services/PremiumContentService');
const PremiumContent = require('../../models/PremiumContent');
const PremiumUnlock = require('../../models/PremiumUnlock');
const Wallet = require('../../models/Wallet');
const WalletTransaction = require('../../models/WalletTransaction');

// Mock data
const mockUserId = new mongoose.Types.ObjectId();
const mockCreatorId = new mongoose.Types.ObjectId();
const mockContentId = new mongoose.Types.ObjectId();

describe('PremiumContentService', () => {
  beforeAll(async () => {
    // Connect to test database
    await mongoose.connect(process.env.MONGODB_TEST_URI || 'mongodb://localhost:27017/superapp_test');
  });

  afterAll(async () => {
    // Cleanup and disconnect
    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    // Clear collections before each test
    await PremiumContent.deleteMany({});
    await PremiumUnlock.deleteMany({});
    await Wallet.deleteMany({});
    await WalletTransaction.deleteMany({});
  });

  describe('unlockContent', () => {
    test('should successfully unlock content with revenue split', async () => {
      // Setup: Create content
      const content = await PremiumContent.create({
        creatorId: mockCreatorId,
        title: 'Test Content',
        description: 'Test description for premium content',
        category: 'education',
        price_coins: 100,
        mediaType: 'video',
        is_published: true
      });

      // Setup: Create wallets with sufficient balance
      const buyerWallet = await Wallet.create({
        userId: mockUserId,
        balance_cents: 1000000 // 100 coins
      });

      const creatorWallet = await Wallet.create({
        userId: mockCreatorId,
        balance_cents: 0
      });

      // Execute unlock
      const result = await PremiumContentService.unlockContent(
        mockUserId,
        content._id,
        'test-idempotency-key-1',
        { ip: '127.0.0.1', userAgent: 'Jest Test' }
      );

      // Assertions
      expect(result.accessGranted).toBe(true);
      expect(result.unlockRecord.amount_coins).toBe(100);
      expect(result.revenue_split.creator).toBe(70); // 70%
      expect(result.revenue_split.platform).toBe(25); // 25%
      expect(result.revenue_split.processing).toBe(5); // 5%

      // Verify buyer wallet deducted
      const updatedBuyerWallet = await Wallet.findById(buyerWallet._id);
      expect(updatedBuyerWallet.getBalanceCents()).toBe(0); // 1000000 - 1000000 = 0

      // Verify creator wallet credited (70%)
      const updatedCreatorWallet = await Wallet.findById(creatorWallet._id);
      expect(updatedCreatorWallet.getBalanceCents()).toBe(700000); // 70 coins = 700000 cents

      // Verify unlock record created
      const unlockRecord = await PremiumUnlock.findOne({ userId: mockUserId, contentId: content._id });
      expect(unlockRecord).toBeTruthy();
      expect(unlockRecord.txStatus).toBe('completed');
    });

    test('should prevent duplicate unlock (idempotency)', async () => {
      // Setup content and wallets
      const content = await PremiumContent.create({
        creatorId: mockCreatorId,
        title: 'Test Content',
        description: 'Test description',
        category: 'education',
        price_coins: 50,
        mediaType: 'video',
        is_published: true
      });

      await Wallet.create({
        userId: mockUserId,
        balance_cents: 1000000
      });

      await Wallet.create({
        userId: mockCreatorId,
        balance_cents: 0
      });

      const idempotencyKey = 'test-duplicate-key';

      // First unlock - should succeed
      const result1 = await PremiumContentService.unlockContent(
        mockUserId,
        content._id,
        idempotencyKey,
        {}
      );

      expect(result1.accessGranted).toBe(true);

      // Second unlock with same idempotency key - should return existing unlock
      const result2 = await PremiumContentService.unlockContent(
        mockUserId,
        content._id,
        idempotencyKey,
        {}
      );

      expect(result2.idempotent).toBe(true);
      expect(result2.unlockRecord.unlockId).toBe(result1.unlockRecord.unlockId);

      // Verify only one unlock record exists
      const unlockCount = await PremiumUnlock.countDocuments({ userId: mockUserId, contentId: content._id });
      expect(unlockCount).toBe(1);
    });

    test('should fail unlock with insufficient balance', async () => {
      // Setup content
      const content = await PremiumContent.create({
        creatorId: mockCreatorId,
        title: 'Expensive Content',
        description: 'Test description',
        category: 'education',
        price_coins: 1000,
        mediaType: 'video',
        is_published: true
      });

      // Create wallet with insufficient balance
      await Wallet.create({
        userId: mockUserId,
        balance_cents: 10000 // Only 1 coin, need 1000
      });

      await Wallet.create({
        userId: mockCreatorId,
        balance_cents: 0
      });

      // Attempt unlock - should fail
      await expect(
        PremiumContentService.unlockContent(mockUserId, content._id, null, {})
      ).rejects.toMatchObject({
        code: 'INSUFFICIENT_BALANCE'
      });

      // Verify no unlock record created
      const unlockCount = await PremiumUnlock.countDocuments({ userId: mockUserId, contentId: content._id });
      expect(unlockCount).toBe(0);
    });

    test('should fail unlock for unpublished content', async () => {
      // Setup unpublished content
      const content = await PremiumContent.create({
        creatorId: mockCreatorId,
        title: 'Draft Content',
        description: 'Test description',
        category: 'education',
        price_coins: 50,
        mediaType: 'video',
        is_published: false // Not published
      });

      await Wallet.create({
        userId: mockUserId,
        balance_cents: 1000000
      });

      // Attempt unlock - should fail
      await expect(
        PremiumContentService.unlockContent(mockUserId, content._id, null, {})
      ).rejects.toMatchObject({
        code: 'CONTENT_NOT_PUBLISHED'
      });
    });

    test('should allow creator free access to own content', async () => {
      // Setup content owned by creator
      const content = await PremiumContent.create({
        creatorId: mockCreatorId,
        title: 'My Content',
        description: 'Test description',
        category: 'education',
        price_coins: 100,
        mediaType: 'video',
        is_published: true
      });

      // Creator tries to unlock own content - should fail with CREATOR_OWNS_CONTENT
      await expect(
        PremiumContentService.unlockContent(mockCreatorId, content._id, null, {})
      ).rejects.toMatchObject({
        code: 'CREATOR_OWNS_CONTENT'
      });

      // But hasAccess should return true for creator
      const accessCheck = await PremiumContentService.hasAccess(mockCreatorId, content._id);
      expect(accessCheck.hasAccess).toBe(true);
      expect(accessCheck.accessType).toBe('creator');
    });
  });

  describe('hasAccess', () => {
    test('should return true for content owner', async () => {
      const content = await PremiumContent.create({
        creatorId: mockCreatorId,
        title: 'Test Content',
        description: 'Test description',
        category: 'education',
        price_coins: 100,
        mediaType: 'video',
        is_published: true
      });

      const result = await PremiumContentService.hasAccess(mockCreatorId, content._id);

      expect(result.hasAccess).toBe(true);
      expect(result.accessType).toBe('creator');
    });

    test('should return false for locked content without unlock', async () => {
      const content = await PremiumContent.create({
        creatorId: mockCreatorId,
        title: 'Locked Content',
        description: 'Test description',
        category: 'education',
        price_coins: 100,
        mediaType: 'video',
        is_published: true
      });

      const result = await PremiumContentService.hasAccess(mockUserId, content._id);

      expect(result.hasAccess).toBe(false);
      expect(result.reason).toBe('Payment required');
    });

    test('should return true for unlocked content', async () => {
      const content = await PremiumContent.create({
        creatorId: mockCreatorId,
        title: 'Test Content',
        description: 'Test description',
        category: 'education',
        price_coins: 100,
        mediaType: 'video',
        is_published: true
      });

      // Create completed unlock
      await PremiumUnlock.create({
        userId: mockUserId,
        contentId: content._id,
        creatorId: mockCreatorId,
        amount_coins: 100,
        platform_share: 25,
        creator_share: 70,
        processing_fee: 5,
        txStatus: 'completed'
      });

      const result = await PremiumContentService.hasAccess(mockUserId, content._id);

      expect(result.hasAccess).toBe(true);
      expect(result.accessType).toBe('paid-unlocked');
    });
  });

  describe('getPremiumContentDetails', () => {
    test('should return content details with access status', async () => {
      const content = await PremiumContent.create({
        creatorId: mockCreatorId,
        title: 'Test Content',
        description: 'Full description of test content',
        category: 'education',
        price_coins: 150,
        mediaType: 'video',
        is_published: true,
        tags: ['test', 'education']
      });

      const result = await PremiumContentService.getPremiumContentDetails(content._id, mockUserId);

      expect(result.title).toBe('Test Content');
      expect(result.price_coins).toBe(150);
      expect(result.price_rupiah).toBe(15000);
      expect(result.accessStatus).toBe('locked-pay-per-view');
      expect(result.canAccess).toBe(false);
      expect(result.fullMediaUrl).toBeNull(); // Hidden without access
    });

    test('should show full media URL for unlocked content', async () => {
      const content = await PremiumContent.create({
        creatorId: mockCreatorId,
        title: 'Unlocked Content',
        description: 'Test description',
        category: 'education',
        price_coins: 100,
        mediaType: 'video',
        fullMediaUrl: '/uploads/premium/creator123/video.mp4',
        is_published: true
      });

      // Create unlock
      await PremiumUnlock.create({
        userId: mockUserId,
        contentId: content._id,
        creatorId: mockCreatorId,
        amount_coins: 100,
        platform_share: 25,
        creator_share: 70,
        processing_fee: 5,
        txStatus: 'completed'
      });

      const result = await PremiumContentService.getPremiumContentDetails(content._id, mockUserId);

      expect(result.canAccess).toBe(true);
      expect(result.fullMediaUrl).toBe('/uploads/premium/creator123/video.mp4');
    });
  });
});
