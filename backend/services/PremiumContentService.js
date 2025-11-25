const mongoose = require('mongoose');
const PremiumContent = require('../models/PremiumContent');
const PremiumUnlock = require('../models/PremiumUnlock');
const Subscription = require('../models/Subscription');
const CreatorRevenue = require('../models/CreatorRevenue');
const Wallet = require('../models/Wallet');
const WalletTransaction = require('../models/WalletTransaction');
const AuditLog = require('../models/AuditLog');

/**
 * PremiumContentService - Handles premium content unlock transactions with atomic operations
 * 
 * Architecture:
 * - MongoDB transactions for atomicity (all-or-nothing)
 * - Idempotency via unique unlock IDs
 * - Revenue split: 70% Creator, 25% Platform, 5% Processing
 * - Wallet balance validation before processing
 */
class PremiumContentService {
  /**
   * Unlock premium content - Atomic transaction with revenue split
   * 
   * @param {string} userId - Buyer user ID
   * @param {string} contentId - Content to unlock
   * @param {string} idempotencyKey - Unique request identifier (prevent double-spend)
   * @param {object} metadata - Optional metadata (ip, userAgent, device)
   * @returns {object} { unlockRecord, walletTransactions, accessGranted: true }
   * @throws {MonetizationError} With code and reason
   */
  async unlockContent(userId, contentId, idempotencyKey, metadata = {}) {
    // Input validation
    if (!userId || !contentId) {
      throw {
        code: 'INVALID_INPUT',
        reason: 'userId and contentId are required',
        status: 400
      };
    }

    // Check idempotency - prevent duplicate unlock
    if (idempotencyKey) {
      const existingUnlock = await PremiumUnlock.findByIdempotencyKey(idempotencyKey);
      if (existingUnlock) {
        if (existingUnlock.txStatus === 'completed') {
          return {
            unlockRecord: existingUnlock,
            walletTransactions: existingUnlock.walletTxIds,
            accessGranted: true,
            idempotent: true
          };
        } else if (existingUnlock.txStatus === 'pending') {
          throw {
            code: 'UNLOCK_IN_PROGRESS',
            reason: 'Unlock transaction is being processed',
            status: 409
          };
        }
      }
    }

    // Check if already unlocked (without idempotency key)
    const alreadyUnlocked = await PremiumUnlock.hasUnlocked(userId, contentId);
    if (alreadyUnlocked) {
      throw {
        code: 'ALREADY_UNLOCKED',
        reason: 'Content already unlocked by this user',
        status: 400
      };
    }

    // Fetch content
    const content = await PremiumContent.findById(contentId);
    if (!content) {
      throw {
        code: 'CONTENT_NOT_FOUND',
        reason: 'Premium content does not exist',
        status: 404
      };
    }

    // Validate content state
    if (!content.is_published) {
      throw {
        code: 'CONTENT_NOT_PUBLISHED',
        reason: 'Content is not available for purchase',
        status: 400
      };
    }

    if (content.is_deleted) {
      throw {
        code: 'CONTENT_DELETED',
        reason: 'Content has been removed',
        status: 410
      };
    }

    // Check if user is creator (creators have free access)
    if (content.creatorId.toString() === userId.toString()) {
      throw {
        code: 'CREATOR_OWNS_CONTENT',
        reason: 'Creators have automatic access to their own content',
        status: 400
      };
    }

    // Check if content requires paid unlock
    if (content.price_coins <= 0) {
      throw {
        code: 'CONTENT_IS_FREE',
        reason: 'This content does not require payment',
        status: 400
      };
    }

    // Fetch buyer wallet
    const buyerWallet = await Wallet.findOne({ userId });
    if (!buyerWallet) {
      throw {
        code: 'WALLET_NOT_FOUND',
        reason: 'User wallet does not exist',
        status: 404
      };
    }

    // Check balance
    const balanceCents = buyerWallet.getBalanceCents();
    const requiredCents = content.price_coins * 10000; // 1 coin = 10000 cents

    if (balanceCents < requiredCents) {
      throw {
        code: 'INSUFFICIENT_BALANCE',
        reason: `Insufficient balance. Required: ${content.price_coins} coins, Available: ${balanceCents / 10000} coins`,
        status: 400
      };
    }

    // Calculate revenue split
    const amountCoins = content.price_coins;
    const creatorShare = Math.floor(amountCoins * 0.70); // 70%
    const platformShare = Math.floor(amountCoins * 0.25); // 25%
    const processingFee = Math.floor(amountCoins * 0.05); // 5%

    // Ensure total matches (handle rounding)
    const splitTotal = creatorShare + platformShare + processingFee;
    const adjustment = amountCoins - splitTotal;
    const finalCreatorShare = creatorShare + adjustment;

    // Start MongoDB transaction
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // 1. Create pending unlock record
      const unlockRecord = await PremiumUnlock.create([{
        userId,
        contentId,
        creatorId: content.creatorId,
        amount_coins: amountCoins,
        platform_share: platformShare,
        creator_share: finalCreatorShare,
        processing_fee: processingFee,
        txStatus: 'pending',
        idempotencyKey,
        metadata: {
          ip: metadata.ip,
          userAgent: metadata.userAgent,
          device: metadata.device
        }
      }], { session });

      // 2. Deduct from buyer wallet
      const buyerTx = await WalletTransaction.create([{
        walletId: buyerWallet._id,
        userId: buyerWallet.userId,
        type: 'purchase',
        amount_cents: -requiredCents,
        balance_after_cents: balanceCents - requiredCents,
        description: `Unlock: ${content.title}`,
        metadata: {
          contentId,
          unlockId: unlockRecord[0].unlockId,
          creatorId: content.creatorId
        }
      }], { session });

      await Wallet.updateOne(
        { _id: buyerWallet._id },
        { 
          $inc: { 
            balance_cents: -requiredCents,
            'statistics.total_spent_cents': requiredCents,
            'statistics.purchase_count': 1
          },
          $set: { lastActivity: new Date() }
        },
        { session }
      );

      // 3. Credit creator wallet (70%)
      const creatorWallet = await Wallet.findOne({ userId: content.creatorId }).session(session);
      if (!creatorWallet) {
        throw new Error('Creator wallet not found');
      }

      const creatorAmountCents = finalCreatorShare * 10000;
      const creatorBalanceAfter = creatorWallet.getBalanceCents() + creatorAmountCents;

      const creatorTx = await WalletTransaction.create([{
        walletId: creatorWallet._id,
        userId: creatorWallet.userId,
        type: 'earnings',
        amount_cents: creatorAmountCents,
        balance_after_cents: creatorBalanceAfter,
        description: `Content unlock: ${content.title}`,
        metadata: {
          contentId,
          unlockId: unlockRecord[0].unlockId,
          buyerId: userId
        }
      }], { session });

      await Wallet.updateOne(
        { _id: creatorWallet._id },
        { 
          $inc: { 
            balance_cents: creatorAmountCents,
            'statistics.total_earned_cents': creatorAmountCents,
            'statistics.earnings_count': 1
          },
          $set: { lastActivity: new Date() }
        },
        { session }
      );

      // 4. Credit platform wallet (25%)
      const platformWallet = await Wallet.findOne({ userId: 'PLATFORM_ACCOUNT' }).session(session);
      if (!platformWallet) {
        // Create platform wallet if doesn't exist
        await Wallet.create([{
          userId: 'PLATFORM_ACCOUNT',
          balance_cents: platformShare * 10000
        }], { session });
      } else {
        await Wallet.updateOne(
          { userId: 'PLATFORM_ACCOUNT' },
          { 
            $inc: { 
              balance_cents: platformShare * 10000,
              'statistics.total_earned_cents': platformShare * 10000
            }
          },
          { session }
        );
      }

      const platformTx = await WalletTransaction.create([{
        walletId: platformWallet ? platformWallet._id : null,
        userId: 'PLATFORM_ACCOUNT',
        type: 'platform_fee',
        amount_cents: platformShare * 10000,
        description: `Platform fee: ${content.title}`,
        metadata: {
          contentId,
          unlockId: unlockRecord[0].unlockId,
          buyerId: userId,
          creatorId: content.creatorId
        }
      }], { session });

      // 5. Mark unlock as completed with transaction IDs
      await unlockRecord[0].markCompleted({
        buyer_tx: buyerTx[0]._id.toString(),
        creator_tx: creatorTx[0]._id.toString(),
        platform_tx: platformTx[0]._id.toString()
      });
      await unlockRecord[0].save({ session });

      // 6. Grant access to content
      await content.grantAccess(userId);
      await content.recordUnlock(amountCoins);
      await content.save({ session });

      // 7. Update creator revenue tracking
      const creatorRevenue = await CreatorRevenue.getOrCreate(content.creatorId);
      await creatorRevenue.addEarnings(finalCreatorShare, false); // Add to available balance
      await creatorRevenue.save({ session });

      // 8. Create audit log
      await AuditLog.create([{
        userId,
        action: 'PREMIUM_CONTENT_UNLOCK',
        resource: 'PremiumContent',
        resourceId: contentId,
        changes: {
          amount_coins: amountCoins,
          creator_share: finalCreatorShare,
          platform_share: platformShare,
          processing_fee: processingFee,
          unlockId: unlockRecord[0].unlockId
        },
        ipAddress: metadata.ip,
        userAgent: metadata.userAgent
      }], { session });

      // Commit transaction
      await session.commitTransaction();

      return {
        unlockRecord: unlockRecord[0],
        walletTransactions: {
          buyer_tx: buyerTx[0]._id.toString(),
          creator_tx: creatorTx[0]._id.toString(),
          platform_tx: platformTx[0]._id.toString()
        },
        accessGranted: true,
        revenue_split: {
          creator: finalCreatorShare,
          platform: platformShare,
          processing: processingFee
        }
      };

    } catch (error) {
      // Rollback transaction
      await session.abortTransaction();
      
      // Mark unlock as failed if it was created
      try {
        if (idempotencyKey) {
          const failedUnlock = await PremiumUnlock.findByIdempotencyKey(idempotencyKey);
          if (failedUnlock && failedUnlock.txStatus === 'pending') {
            await failedUnlock.markFailed(error.message || 'Transaction failed');
          }
        }
      } catch (markFailedError) {
        console.error('Failed to mark unlock as failed:', markFailedError);
      }

      throw {
        code: error.code || 'UNLOCK_TRANSACTION_FAILED',
        reason: error.reason || error.message || 'Failed to process unlock transaction',
        status: error.status || 500,
        details: error
      };
    } finally {
      session.endSession();
    }
  }

  /**
   * Check if user has access to premium content
   * 
   * @param {string} userId - User ID to check
   * @param {string} contentId - Content ID to check
   * @returns {object} { hasAccess: boolean, reason: string, accessType: string }
   */
  async hasAccess(userId, contentId) {
    if (!userId || !contentId) {
      return { hasAccess: false, reason: 'Invalid input', accessType: null };
    }

    const content = await PremiumContent.findById(contentId);
    if (!content) {
      return { hasAccess: false, reason: 'Content not found', accessType: null };
    }

    // Check if user is creator
    if (content.creatorId.toString() === userId.toString()) {
      return { hasAccess: true, reason: 'Content owner', accessType: 'creator' };
    }

    // Check if content is free
    if (content.price_coins <= 0 && !content.subscriber_only) {
      return { hasAccess: true, reason: 'Free content', accessType: 'free' };
    }

    // Check if already unlocked
    const unlocked = await PremiumUnlock.hasUnlocked(userId, contentId);
    if (unlocked) {
      return { hasAccess: true, reason: 'Content unlocked', accessType: 'paid-unlocked' };
    }

    // Check subscription access
    if (content.subscriber_only || content.visibility === 'subscribers_only') {
      const hasSubscription = await Subscription.isSubscribed(userId, content.creatorId);
      if (hasSubscription) {
        return { hasAccess: true, reason: 'Active subscription', accessType: 'subscription' };
      }
    }

    // Check allowed_subscribers array (manually granted access)
    if (content.allowed_subscribers && content.allowed_subscribers.includes(userId)) {
      return { hasAccess: true, reason: 'Granted access', accessType: 'granted' };
    }

    return { hasAccess: false, reason: 'Payment required', accessType: null };
  }

  /**
   * Get premium content details with access status
   * 
   * @param {string} contentId - Content ID
   * @param {string} viewerId - Optional viewer ID for access check
   * @returns {object} Content details with access status and creator info
   */
  async getPremiumContentDetails(contentId, viewerId = null) {
    const content = await PremiumContent.findById(contentId)
      .populate('creatorId', 'username profilePhoto category email')
      .lean();

    if (!content) {
      throw {
        code: 'CONTENT_NOT_FOUND',
        reason: 'Premium content does not exist',
        status: 404
      };
    }

    // Mask sensitive creator data
    const creatorInfo = {
      id: content.creatorId._id,
      username: content.creatorId.username,
      profilePhoto: content.creatorId.profilePhoto,
      category: content.creatorId.category
      // Email hidden for privacy
    };

    // Determine access status
    let accessStatus = 'free';
    let canAccess = false;

    if (viewerId) {
      const accessCheck = await this.hasAccess(viewerId, contentId);
      canAccess = accessCheck.hasAccess;
      
      if (!accessCheck.hasAccess) {
        if (content.subscriber_only) {
          accessStatus = 'subscription-only';
        } else if (content.price_coins > 0) {
          accessStatus = 'locked-pay-per-view';
        }
      } else {
        accessStatus = accessCheck.accessType;
      }
    } else {
      // Anonymous viewer
      if (content.subscriber_only) {
        accessStatus = 'subscription-only';
      } else if (content.price_coins > 0) {
        accessStatus = 'locked-pay-per-view';
      }
    }

    return {
      id: content._id,
      title: content.title,
      description: content.description,
      category: content.category,
      price_coins: content.price_coins,
      price_rupiah: content.price_coins * 100,
      mediaType: content.mediaType,
      duration_seconds: content.duration_seconds,
      fileSize_bytes: content.fileSize_bytes,
      thumbnailUrl: content.thumbnailUrl,
      previewMediaUrl: canAccess ? content.fullMediaUrl : content.previewMediaUrl, // Show full if has access
      fullMediaUrl: canAccess ? content.fullMediaUrl : null, // Hide if no access
      tags: content.tags,
      visibility: content.visibility,
      subscriber_only: content.subscriber_only,
      stats: {
        views: content.stats.views,
        unlocks: content.stats.unlocks,
        likes: content.stats.likes,
        shares: content.stats.shares
        // Revenue hidden
      },
      creator: creatorInfo,
      accessStatus, // "free" | "paid-unlocked" | "locked-pay-per-view" | "subscription-only" | "subscription" | "creator"
      canAccess,
      createdAt: content.createdAt,
      updatedAt: content.updatedAt
    };
  }

  /**
   * Browse premium content with filters, sorting, and pagination
   * 
   * @param {object} options - { category, creatorId, tags, searchQuery, sort, page, limit }
   * @returns {object} { contents, pagination }
   */
  async browseContent(options = {}) {
    const result = await PremiumContent.getBrowsable(options);
    
    // Add creator info to each content
    const contents = await PremiumContent.populate(result.contents, {
      path: 'creatorId',
      select: 'username profilePhoto category'
    });

    return {
      contents: contents.map(content => ({
        id: content._id,
        title: content.title,
        description: content.description.substring(0, 200) + '...', // Truncate
        category: content.category,
        price_coins: content.price_coins,
        price_rupiah: content.price_coins * 100,
        mediaType: content.mediaType,
        thumbnailUrl: content.thumbnailUrl,
        tags: content.tags,
        stats: {
          views: content.stats.views,
          unlocks: content.stats.unlocks,
          likes: content.stats.likes
        },
        creator: {
          id: content.creatorId._id,
          username: content.creatorId.username,
          profilePhoto: content.creatorId.profilePhoto
        },
        createdAt: content.createdAt
      })),
      pagination: result.pagination
    };
  }

  /**
   * Increment view count for content
   * 
   * @param {string} contentId - Content ID
   */
  async incrementView(contentId) {
    const content = await PremiumContent.findById(contentId);
    if (content) {
      await content.incrementViews();
    }
  }
}

module.exports = new PremiumContentService();
