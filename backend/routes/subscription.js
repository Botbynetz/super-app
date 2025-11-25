const express = require('express');
const router = express.Router();
const { body, param, query, validationResult } = require('express-validator');
const Subscription = require('../models/Subscription');
const SubscriptionService = require('../services/SubscriptionService');
const FraudGuard = require('../services/FraudGuard');

// Middleware: Require authentication
const requireAuth = (req, res, next) => {
  if (!req.user || !req.user.id) {
    return res.status(401).json({
      code: 'UNAUTHORIZED',
      reason: 'Authentication required'
    });
  }
  next();
};

// Rate limiting
const rateLimitCache = new Map();
const rateLimit = (maxRequests, windowMs) => {
  return (req, res, next) => {
    const userId = req.user?.id || req.ip;
    const now = Date.now();
    const userRequests = rateLimitCache.get(userId) || [];
    
    const validRequests = userRequests.filter(timestamp => now - timestamp < windowMs);
    
    if (validRequests.length >= maxRequests) {
      return res.status(429).json({
        code: 'RATE_LIMIT_EXCEEDED',
        reason: `Too many requests. Limit: ${maxRequests} per ${windowMs / 1000}s`,
        retryAfter: Math.ceil((validRequests[0] + windowMs - now) / 1000)
      });
    }
    
    validRequests.push(now);
    rateLimitCache.set(userId, validRequests);
    next();
  };
};

/**
 * POST /api/subscription/subscribe
 * Subscribe to a creator with tiered pricing
 */
router.post('/subscribe',
  requireAuth,
  rateLimit(3, 60000), // Max 3 subscriptions per minute
  [
    body('creatorId').isMongoId().withMessage('Invalid creator ID'),
    body('tier').isIn(['monthly', 'quarterly', 'yearly']).withMessage('Tier must be monthly, quarterly, or yearly'),
    body('price_coins').isInt({ min: 1 }).withMessage('Price must be positive integer'),
    body('idempotencyKey').optional().isString().withMessage('Idempotency key must be string')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          code: 'VALIDATION_ERROR',
          reason: 'Invalid input',
          errors: errors.array()
        });
      }

      const { creatorId, tier, price_coins, idempotencyKey } = req.body;
      const subscriberId = req.user.id;

      // Fraud check
      const fraudCheck = await FraudGuard.checkSubscriptionAbuse(subscriberId, creatorId);
      if (!fraudCheck.allowed) {
        return res.status(403).json({
          code: 'FRAUD_CHECK_FAILED',
          reason: fraudCheck.reason,
          riskScore: fraudCheck.riskScore
        });
      }

      // Process subscription
      const result = await SubscriptionService.subscribe(
        subscriberId,
        creatorId,
        tier,
        parseInt(price_coins),
        idempotencyKey,
        {
          ip: req.ip,
          userAgent: req.get('user-agent')
        }
      );

      // TODO: Emit Socket.io event SUBSCRIPTION_STARTED

      res.json({
        success: true,
        message: 'Subscription created successfully',
        subscription: {
          id: result.subscription._id,
          tier,
          price_coins,
          price_rupiah: price_coins * 100,
          startedAt: result.subscription.startedAt,
          expiresAt: result.expiresAt,
          autoRenew: result.subscription.autoRenew
        }
      });

    } catch (error) {
      console.error('Subscribe error:', error);
      res.status(error.status || 500).json({
        code: error.code || 'SUBSCRIBE_FAILED',
        reason: error.reason || error.message
      });
    }
  }
);

/**
 * POST /api/subscription/:id/cancel
 * Cancel subscription (subscriber only)
 */
router.post('/:id/cancel',
  requireAuth,
  [
    param('id').isMongoId().withMessage('Invalid subscription ID'),
    body('reason').optional().isString().withMessage('Reason must be string')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          code: 'VALIDATION_ERROR',
          errors: errors.array()
        });
      }

      const subscriptionId = req.params.id;
      const subscriberId = req.user.id;
      const reason = req.body.reason || 'User requested cancellation';

      const subscription = await SubscriptionService.cancelSubscription(
        subscriptionId,
        subscriberId,
        reason
      );

      // TODO: Emit Socket.io event SUBSCRIPTION_CANCELLED

      res.json({
        success: true,
        message: 'Subscription cancelled successfully',
        subscription: {
          id: subscription._id,
          status: subscription.status,
          cancelledAt: subscription.metadata.cancelledAt,
          expiresAt: subscription.expiresAt,
          reason: subscription.metadata.cancelReason
        }
      });

    } catch (error) {
      console.error('Cancel subscription error:', error);
      res.status(error.status || 500).json({
        code: error.code || 'CANCEL_FAILED',
        reason: error.reason || error.message
      });
    }
  }
);

/**
 * POST /api/subscription/:id/renew
 * Manually renew subscription (if autoRenew disabled)
 */
router.post('/:id/renew',
  requireAuth,
  [
    param('id').isMongoId().withMessage('Invalid subscription ID'),
    body('idempotencyKey').optional().isString().withMessage('Idempotency key must be string')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          code: 'VALIDATION_ERROR',
          errors: errors.array()
        });
      }

      const subscriptionId = req.params.id;
      const idempotencyKey = req.body.idempotencyKey;

      // Verify ownership
      const subscription = await Subscription.findById(subscriptionId);
      if (!subscription) {
        return res.status(404).json({
          code: 'SUBSCRIPTION_NOT_FOUND',
          reason: 'Subscription does not exist'
        });
      }

      if (subscription.subscriberId.toString() !== req.user.id) {
        return res.status(403).json({
          code: 'UNAUTHORIZED',
          reason: 'Not authorized to renew this subscription'
        });
      }

      const result = await SubscriptionService.renewSubscription(subscriptionId, idempotencyKey);

      // TODO: Emit Socket.io event SUBSCRIPTION_RENEWED

      res.json({
        success: true,
        message: 'Subscription renewed successfully',
        subscription: {
          id: result.subscription._id,
          expiresAt: result.expiresAt,
          renewalCount: result.subscription.metadata.renewalCount
        }
      });

    } catch (error) {
      console.error('Renew subscription error:', error);
      res.status(error.status || 500).json({
        code: error.code || 'RENEW_FAILED',
        reason: error.reason || error.message
      });
    }
  }
);

/**
 * GET /api/subscription/my-subscriptions
 * Get user's subscriptions (active, expired, cancelled)
 */
router.get('/my-subscriptions',
  requireAuth,
  [
    query('status').optional().isIn(['active', 'expired', 'cancelled', 'suspended']).withMessage('Invalid status'),
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be positive integer'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be 1-100')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          code: 'VALIDATION_ERROR',
          errors: errors.array()
        });
      }

      const options = {
        status: req.query.status,
        page: parseInt(req.query.page) || 1,
        limit: parseInt(req.query.limit) || 20
      };

      const result = await SubscriptionService.getUserSubscriptions(req.user.id, options);

      res.json({
        success: true,
        ...result
      });

    } catch (error) {
      console.error('Get my subscriptions error:', error);
      res.status(error.status || 500).json({
        code: error.code || 'GET_SUBSCRIPTIONS_FAILED',
        reason: error.reason || error.message
      });
    }
  }
);

/**
 * GET /api/subscription/creator/:id/subscribers
 * Get creator's subscribers (creator only or public stats)
 */
router.get('/creator/:id/subscribers',
  [
    param('id').isMongoId().withMessage('Invalid creator ID'),
    query('status').optional().isIn(['active', 'expired', 'cancelled', 'suspended']).withMessage('Invalid status'),
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be positive integer'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be 1-100')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          code: 'VALIDATION_ERROR',
          errors: errors.array()
        });
      }

      const creatorId = req.params.id;
      const isOwner = req.user?.id === creatorId;

      const options = {
        status: req.query.status,
        page: parseInt(req.query.page) || 1,
        limit: parseInt(req.query.limit) || 20
      };

      const result = await SubscriptionService.getCreatorSubscribers(creatorId, options);

      // If not owner, only return stats (not subscriber list for privacy)
      if (!isOwner) {
        return res.json({
          success: true,
          stats: result.stats,
          message: 'Full subscriber list only available to creator'
        });
      }

      res.json({
        success: true,
        ...result
      });

    } catch (error) {
      console.error('Get creator subscribers error:', error);
      res.status(error.status || 500).json({
        code: error.code || 'GET_SUBSCRIBERS_FAILED',
        reason: error.reason || error.message
      });
    }
  }
);

/**
 * GET /api/subscription/creator/:id/stats
 * Get public subscription stats for a creator
 */
router.get('/creator/:id/stats',
  [
    param('id').isMongoId().withMessage('Invalid creator ID')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          code: 'VALIDATION_ERROR',
          errors: errors.array()
        });
      }

      const stats = await Subscription.getCreatorStats(req.params.id);

      res.json({
        success: true,
        stats: {
          activeSubscribers: stats.activeSubscribers,
          totalSubscribers: stats.totalSubscribers,
          // Revenue hidden for privacy unless creator
          ...(req.user?.id === req.params.id && {
            totalRevenue_coins: stats.totalRevenue_coins,
            totalRevenue_rupiah: stats.totalRevenue_coins * 100,
            averagePrice_coins: stats.averagePrice_coins
          })
        }
      });

    } catch (error) {
      console.error('Get creator stats error:', error);
      res.status(error.status || 500).json({
        code: error.code || 'GET_STATS_FAILED',
        reason: error.reason || error.message
      });
    }
  }
);

/**
 * GET /api/subscription/check/:creatorId
 * Check if user has active subscription to creator
 */
router.get('/check/:creatorId',
  requireAuth,
  [
    param('creatorId').isMongoId().withMessage('Invalid creator ID')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          code: 'VALIDATION_ERROR',
          errors: errors.array()
        });
      }

      const subscriberId = req.user.id;
      const creatorId = req.params.creatorId;

      const isSubscribed = await SubscriptionService.isActiveSubscriber(subscriberId, creatorId);
      const subscription = isSubscribed 
        ? await Subscription.getActiveSubscription(subscriberId, creatorId)
        : null;

      res.json({
        success: true,
        isSubscribed,
        subscription: subscription ? {
          id: subscription._id,
          tier: subscription.tier,
          expiresAt: subscription.expiresAt,
          autoRenew: subscription.autoRenew,
          daysRemaining: subscription.daysRemaining
        } : null
      });

    } catch (error) {
      console.error('Check subscription error:', error);
      res.status(error.status || 500).json({
        code: error.code || 'CHECK_SUBSCRIPTION_FAILED',
        reason: error.reason || error.message
      });
    }
  }
);

/**
 * PUT /api/subscription/:id/auto-renew
 * Toggle auto-renewal setting
 */
router.put('/:id/auto-renew',
  requireAuth,
  [
    param('id').isMongoId().withMessage('Invalid subscription ID'),
    body('autoRenew').isBoolean().withMessage('autoRenew must be boolean')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          code: 'VALIDATION_ERROR',
          errors: errors.array()
        });
      }

      const subscription = await Subscription.findById(req.params.id);
      
      if (!subscription) {
        return res.status(404).json({
          code: 'SUBSCRIPTION_NOT_FOUND',
          reason: 'Subscription does not exist'
        });
      }

      // Authorization
      if (subscription.subscriberId.toString() !== req.user.id) {
        return res.status(403).json({
          code: 'UNAUTHORIZED',
          reason: 'Not authorized to modify this subscription'
        });
      }

      subscription.autoRenew = req.body.autoRenew;
      await subscription.save();

      res.json({
        success: true,
        message: `Auto-renewal ${req.body.autoRenew ? 'enabled' : 'disabled'}`,
        subscription: {
          id: subscription._id,
          autoRenew: subscription.autoRenew
        }
      });

    } catch (error) {
      console.error('Toggle auto-renew error:', error);
      res.status(error.status || 500).json({
        code: error.code || 'TOGGLE_AUTO_RENEW_FAILED',
        reason: error.reason || error.message
      });
    }
  }
);

module.exports = router;
