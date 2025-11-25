const mongoose = require('mongoose');
const Subscription = require('../models/Subscription');
const PremiumContent = require('../models/PremiumContent');
const CreatorRevenue = require('../models/CreatorRevenue');
const Wallet = require('../models/Wallet');
const WalletTransaction = require('../models/WalletTransaction');
const AuditLog = require('../models/AuditLog');

/**
 * SubscriptionService - Manages creator subscriptions with atomic operations
 * 
 * Features:
 * - Tier-based pricing (monthly, quarterly, yearly)
 * - Atomic wallet deduction
 * - Auto-renewal support
 * - Batch expiry processing
 * - Revenue tracking
 */
class SubscriptionService {
  /**
   * Subscribe to a creator - Atomic transaction
   * 
   * @param {string} subscriberId - User subscribing
   * @param {string} creatorId - Creator to subscribe to
   * @param {string} tier - "monthly" | "quarterly" | "yearly"
   * @param {number} priceCoins - Subscription price in coins
   * @param {string} idempotencyKey - Unique request identifier
   * @param {object} metadata - Optional metadata (ip, userAgent)
   * @returns {object} { subscription, walletTransaction, accessGranted: true }
   */
  async subscribe(subscriberId, creatorId, tier, priceCoins, idempotencyKey, metadata = {}) {
    // Input validation
    if (!subscriberId || !creatorId || !tier || !priceCoins) {
      throw {
        code: 'INVALID_INPUT',
        reason: 'subscriberId, creatorId, tier, and priceCoins are required',
        status: 400
      };
    }

    if (!['monthly', 'quarterly', 'yearly'].includes(tier)) {
      throw {
        code: 'INVALID_TIER',
        reason: 'Tier must be monthly, quarterly, or yearly',
        status: 400
      };
    }

    if (subscriberId === creatorId) {
      throw {
        code: 'CANNOT_SUBSCRIBE_TO_SELF',
        reason: 'Cannot subscribe to yourself',
        status: 400
      };
    }

    // Check for existing active subscription
    const existingSubscription = await Subscription.getActiveSubscription(subscriberId, creatorId);
    if (existingSubscription) {
      throw {
        code: 'ALREADY_SUBSCRIBED',
        reason: 'Already have an active subscription to this creator',
        status: 400
      };
    }

    // Fetch subscriber wallet
    const subscriberWallet = await Wallet.findOne({ userId: subscriberId });
    if (!subscriberWallet) {
      throw {
        code: 'WALLET_NOT_FOUND',
        reason: 'Subscriber wallet does not exist',
        status: 404
      };
    }

    // Check balance
    const balanceCents = subscriberWallet.getBalanceCents();
    const requiredCents = priceCoins * 10000; // 1 coin = 10000 cents

    if (balanceCents < requiredCents) {
      throw {
        code: 'INSUFFICIENT_BALANCE',
        reason: `Insufficient balance. Required: ${priceCoins} coins, Available: ${balanceCents / 10000} coins`,
        status: 400
      };
    }

    // Calculate expiry date based on tier
    const startedAt = new Date();
    const expiresAt = new Date(startedAt);
    
    switch (tier) {
      case 'monthly':
        expiresAt.setDate(expiresAt.getDate() + 30);
        break;
      case 'quarterly':
        expiresAt.setDate(expiresAt.getDate() + 90);
        break;
      case 'yearly':
        expiresAt.setDate(expiresAt.getDate() + 365);
        break;
    }

    // Start MongoDB transaction
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // 1. Deduct from subscriber wallet
      const subscriberTx = await WalletTransaction.create([{
        walletId: subscriberWallet._id,
        userId: subscriberWallet.userId,
        type: 'subscription',
        amount_cents: -requiredCents,
        balance_after_cents: balanceCents - requiredCents,
        description: `Subscription: ${tier} tier for creator`,
        metadata: {
          creatorId,
          tier,
          expiresAt
        }
      }], { session });

      await Wallet.updateOne(
        { _id: subscriberWallet._id },
        { 
          $inc: { 
            balance_cents: -requiredCents,
            'statistics.total_spent_cents': requiredCents,
            'statistics.subscription_count': 1
          },
          $set: { lastActivity: new Date() }
        },
        { session }
      );

      // 2. Credit creator wallet (70% of subscription revenue)
      const creatorShare = Math.floor(priceCoins * 0.70);
      const platformShare = Math.floor(priceCoins * 0.25);
      const processingFee = Math.floor(priceCoins * 0.05);

      const creatorWallet = await Wallet.findOne({ userId: creatorId }).session(session);
      if (!creatorWallet) {
        throw new Error('Creator wallet not found');
      }

      const creatorAmountCents = creatorShare * 10000;
      const creatorBalanceAfter = creatorWallet.getBalanceCents() + creatorAmountCents;

      const creatorTx = await WalletTransaction.create([{
        walletId: creatorWallet._id,
        userId: creatorWallet.userId,
        type: 'earnings',
        amount_cents: creatorAmountCents,
        balance_after_cents: creatorBalanceAfter,
        description: `Subscription revenue: ${tier}`,
        metadata: {
          subscriberId,
          tier,
          expiresAt
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

      // 3. Credit platform wallet (25%)
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

      // 4. Create subscription record
      const subscription = await Subscription.create([{
        subscriberId,
        creatorId,
        tier,
        price_coins: priceCoins,
        startedAt,
        expiresAt,
        status: 'active',
        autoRenew: true, // Default to auto-renew
        metadata: {
          renewalCount: 0,
          totalSpent_coins: priceCoins
        }
      }], { session });

      // 5. Add subscriber to all creator's subscriber-only content
      await PremiumContent.updateMany(
        { 
          creatorId,
          subscriber_only: true,
          is_published: true,
          is_deleted: false
        },
        { 
          $addToSet: { allowed_subscribers: subscriberId }
        },
        { session }
      );

      // 6. Update creator revenue tracking
      const creatorRevenue = await CreatorRevenue.getOrCreate(creatorId);
      await creatorRevenue.addEarnings(creatorShare, false);
      creatorRevenue.lifetime.total_subscribers += 1;
      await creatorRevenue.save({ session });

      // 7. Create audit log
      await AuditLog.create([{
        userId: subscriberId,
        action: 'SUBSCRIPTION_STARTED',
        resource: 'Subscription',
        resourceId: subscription[0]._id,
        changes: {
          creatorId,
          tier,
          price_coins: priceCoins,
          expiresAt
        },
        ipAddress: metadata.ip,
        userAgent: metadata.userAgent
      }], { session });

      // Commit transaction
      await session.commitTransaction();

      return {
        subscription: subscription[0],
        walletTransaction: {
          subscriber_tx: subscriberTx[0]._id.toString(),
          creator_tx: creatorTx[0]._id.toString()
        },
        accessGranted: true,
        expiresAt,
        revenue_split: {
          creator: creatorShare,
          platform: platformShare,
          processing: processingFee
        }
      };

    } catch (error) {
      // Rollback transaction
      await session.abortTransaction();
      
      throw {
        code: error.code || 'SUBSCRIPTION_TRANSACTION_FAILED',
        reason: error.reason || error.message || 'Failed to process subscription',
        status: error.status || 500,
        details: error
      };
    } finally {
      session.endSession();
    }
  }

  /**
   * Cancel subscription
   * 
   * @param {string} subscriptionId - Subscription ID
   * @param {string} subscriberId - User canceling (for authorization)
   * @param {string} reason - Cancellation reason
   * @returns {object} Cancelled subscription
   */
  async cancelSubscription(subscriptionId, subscriberId, reason = null) {
    const subscription = await Subscription.findById(subscriptionId);
    
    if (!subscription) {
      throw {
        code: 'SUBSCRIPTION_NOT_FOUND',
        reason: 'Subscription does not exist',
        status: 404
      };
    }

    if (subscription.subscriberId.toString() !== subscriberId.toString()) {
      throw {
        code: 'UNAUTHORIZED',
        reason: 'Not authorized to cancel this subscription',
        status: 403
      };
    }

    if (subscription.status === 'cancelled') {
      throw {
        code: 'ALREADY_CANCELLED',
        reason: 'Subscription is already cancelled',
        status: 400
      };
    }

    await subscription.cancel(reason);

    // Create audit log
    await AuditLog.create({
      userId: subscriberId,
      action: 'SUBSCRIPTION_CANCELLED',
      resource: 'Subscription',
      resourceId: subscriptionId,
      changes: {
        reason,
        cancelledAt: new Date()
      }
    });

    return subscription;
  }

  /**
   * Renew subscription (manual or auto-renewal)
   * 
   * @param {string} subscriptionId - Subscription to renew
   * @param {string} idempotencyKey - Optional for manual renewals
   * @returns {object} Renewed subscription with transaction
   */
  async renewSubscription(subscriptionId, idempotencyKey = null) {
    const subscription = await Subscription.findById(subscriptionId);
    
    if (!subscription) {
      throw {
        code: 'SUBSCRIPTION_NOT_FOUND',
        reason: 'Subscription does not exist',
        status: 404
      };
    }

    if (subscription.status !== 'active') {
      throw {
        code: 'SUBSCRIPTION_NOT_ACTIVE',
        reason: 'Cannot renew inactive subscription',
        status: 400
      };
    }

    if (!subscription.autoRenew) {
      throw {
        code: 'AUTO_RENEW_DISABLED',
        reason: 'Auto-renewal is disabled for this subscription',
        status: 400
      };
    }

    // Check if already renewed recently (prevent double renewal)
    const hoursSinceLastRenewal = (Date.now() - subscription.startedAt.getTime()) / (1000 * 60 * 60);
    if (hoursSinceLastRenewal < 1) {
      throw {
        code: 'RECENTLY_RENEWED',
        reason: 'Subscription was recently renewed',
        status: 400
      };
    }

    // Fetch subscriber wallet
    const subscriberWallet = await Wallet.findOne({ userId: subscription.subscriberId });
    if (!subscriberWallet) {
      throw {
        code: 'WALLET_NOT_FOUND',
        reason: 'Subscriber wallet does not exist',
        status: 404
      };
    }

    // Check balance
    const balanceCents = subscriberWallet.getBalanceCents();
    const requiredCents = subscription.price_coins * 10000;

    if (balanceCents < requiredCents) {
      // Disable auto-renewal if insufficient balance
      subscription.autoRenew = false;
      await subscription.save();
      
      throw {
        code: 'INSUFFICIENT_BALANCE_AUTO_RENEW_DISABLED',
        reason: `Insufficient balance for renewal. Auto-renewal disabled.`,
        status: 400
      };
    }

    // Start MongoDB transaction
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // 1. Deduct from subscriber wallet
      await WalletTransaction.create([{
        walletId: subscriberWallet._id,
        userId: subscriberWallet.userId,
        type: 'subscription',
        amount_cents: -requiredCents,
        balance_after_cents: balanceCents - requiredCents,
        description: `Subscription renewal: ${subscription.tier}`,
        metadata: {
          subscriptionId,
          creatorId: subscription.creatorId,
          tier: subscription.tier
        }
      }], { session });

      await Wallet.updateOne(
        { _id: subscriberWallet._id },
        { 
          $inc: { 
            balance_cents: -requiredCents,
            'statistics.total_spent_cents': requiredCents
          }
        },
        { session }
      );

      // 2. Credit creator wallet
      const creatorShare = Math.floor(subscription.price_coins * 0.70);
      const creatorWallet = await Wallet.findOne({ userId: subscription.creatorId }).session(session);
      
      await Wallet.updateOne(
        { _id: creatorWallet._id },
        { 
          $inc: { 
            balance_cents: creatorShare * 10000,
            'statistics.total_earned_cents': creatorShare * 10000
          }
        },
        { session }
      );

      // 3. Renew subscription (extends expiresAt)
      await subscription.renew();
      subscription.metadata.totalSpent_coins += subscription.price_coins;
      await subscription.save({ session });

      // 4. Update creator revenue
      const creatorRevenue = await CreatorRevenue.getOrCreate(subscription.creatorId);
      await creatorRevenue.addEarnings(creatorShare, false);
      await creatorRevenue.save({ session });

      // Commit transaction
      await session.commitTransaction();

      return {
        subscription,
        renewed: true,
        expiresAt: subscription.expiresAt
      };

    } catch (error) {
      await session.abortTransaction();
      
      throw {
        code: error.code || 'RENEWAL_FAILED',
        reason: error.reason || error.message || 'Failed to renew subscription',
        status: error.status || 500
      };
    } finally {
      session.endSession();
    }
  }

  /**
   * Check if user is active subscriber to creator
   * 
   * @param {string} subscriberId - User ID
   * @param {string} creatorId - Creator ID
   * @returns {boolean} True if active subscription exists
   */
  async isActiveSubscriber(subscriberId, creatorId) {
    return await Subscription.isSubscribed(subscriberId, creatorId);
  }

  /**
   * Process expired subscriptions (Cron job - idempotent batch operation)
   * 
   * @returns {object} { processedCount, removedAccessCount }
   */
  async processExpiredSubscriptions() {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // 1. Find and mark expired subscriptions
      const expiredSubscriptions = await Subscription.find({
        status: 'active',
        expiresAt: { $lt: new Date() },
        autoRenew: false // Only process non-auto-renew subscriptions
      }).session(session);

      let processedCount = 0;
      let removedAccessCount = 0;

      for (const subscription of expiredSubscriptions) {
        // Mark as expired
        subscription.status = 'expired';
        await subscription.save({ session });
        processedCount++;

        // Remove subscriber from allowed_subscribers in all creator content
        const removeResult = await PremiumContent.updateMany(
          { 
            creatorId: subscription.creatorId,
            allowed_subscribers: subscription.subscriberId
          },
          { 
            $pull: { allowed_subscribers: subscription.subscriberId }
          },
          { session }
        );

        removedAccessCount += removeResult.modifiedCount || 0;

        // Create audit log
        await AuditLog.create([{
          userId: subscription.subscriberId,
          action: 'SUBSCRIPTION_EXPIRED',
          resource: 'Subscription',
          resourceId: subscription._id,
          changes: {
            status: 'expired',
            expiresAt: subscription.expiresAt
          }
        }], { session });
      }

      // Commit transaction
      await session.commitTransaction();

      return {
        processedCount,
        removedAccessCount,
        timestamp: new Date()
      };

    } catch (error) {
      await session.abortTransaction();
      
      throw {
        code: 'BATCH_EXPIRY_FAILED',
        reason: error.message || 'Failed to process expired subscriptions',
        status: 500
      };
    } finally {
      session.endSession();
    }
  }

  /**
   * Get user's subscriptions with filters
   * 
   * @param {string} subscriberId - User ID
   * @param {object} options - { status, page, limit }
   * @returns {object} { subscriptions, pagination }
   */
  async getUserSubscriptions(subscriberId, options = {}) {
    return await Subscription.getUserSubscriptions(subscriberId, options);
  }

  /**
   * Get creator's subscribers
   * 
   * @param {string} creatorId - Creator ID
   * @param {object} options - { status, page, limit }
   * @returns {object} { subscribers, pagination, stats }
   */
  async getCreatorSubscribers(creatorId, options = {}) {
    const result = await Subscription.getCreatorSubscribers(creatorId, options);
    const stats = await Subscription.getCreatorStats(creatorId);
    
    return {
      ...result,
      stats
    };
  }
}

module.exports = new SubscriptionService();
