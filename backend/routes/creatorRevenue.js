const express = require('express');
const router = express.Router();
const { body, query, validationResult } = require('express-validator');
const CreatorRevenue = require('../models/CreatorRevenue');
const RevenueAnalyticsService = require('../services/RevenueAnalyticsService');
const WalletService = require('../services/walletService');

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

/**
 * GET /api/creator/revenue
 * Get creator's revenue summary and analytics
 */
router.get('/revenue',
  requireAuth,
  async (req, res) => {
    try {
      const creatorId = req.user.id;
      const summary = await RevenueAnalyticsService.getCreatorRevenueSummary(creatorId);

      res.json({
        success: true,
        revenue: summary
      });

    } catch (error) {
      console.error('Get revenue summary error:', error);
      res.status(error.status || 500).json({
        code: error.code || 'GET_REVENUE_FAILED',
        reason: error.reason || error.message
      });
    }
  }
);

/**
 * GET /api/creator/revenue/history
 * Get creator's revenue history (unlocks + subscriptions) with pagination
 */
router.get('/revenue/history',
  requireAuth,
  [
    query('startDate').optional().isISO8601().withMessage('Invalid start date'),
    query('endDate').optional().isISO8601().withMessage('Invalid end date'),
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

      const creatorId = req.user.id;
      const options = {
        startDate: req.query.startDate ? new Date(req.query.startDate) : null,
        endDate: req.query.endDate ? new Date(req.query.endDate) : null
      };

      const PremiumUnlock = require('../models/PremiumUnlock');
      const Subscription = require('../models/Subscription');

      // Get unlock transactions
      const unlockHistory = await PremiumUnlock.getCreatorUnlocks(creatorId, {
        ...options,
        page: parseInt(req.query.page) || 1,
        limit: parseInt(req.query.limit) || 50
      });

      // Get subscription transactions
      const subscriptionHistory = await Subscription.getCreatorSubscribers(creatorId, {
        page: parseInt(req.query.page) || 1,
        limit: parseInt(req.query.limit) || 50
      });

      res.json({
        success: true,
        history: {
          unlocks: unlockHistory.unlocks.map(u => ({
            type: 'unlock',
            id: u.unlockId,
            contentId: u.contentId,
            amount_coins: u.creator_share,
            amount_rupiah: u.creator_share * 100,
            date: u.createdAt
          })),
          subscriptions: subscriptionHistory.subscriptions.map(s => ({
            type: 'subscription',
            id: s._id,
            tier: s.tier,
            amount_coins: Math.floor(s.price_coins * 0.70), // Creator share
            amount_rupiah: Math.floor(s.price_coins * 0.70) * 100,
            date: s.createdAt
          }))
        },
        pagination: unlockHistory.pagination
      });

    } catch (error) {
      console.error('Get revenue history error:', error);
      res.status(error.status || 500).json({
        code: error.code || 'GET_HISTORY_FAILED',
        reason: error.reason || error.message
      });
    }
  }
);

/**
 * GET /api/creator/revenue/chart
 * Get revenue growth chart data (monthly breakdown)
 */
router.get('/revenue/chart',
  requireAuth,
  [
    query('months').optional().isInt({ min: 1, max: 24 }).withMessage('Months must be 1-24')
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

      const creatorId = req.user.id;
      const months = parseInt(req.query.months) || 6;

      const chartData = await RevenueAnalyticsService.getRevenueGrowthChart(creatorId, months);

      res.json({
        success: true,
        chart: chartData
      });

    } catch (error) {
      console.error('Get revenue chart error:', error);
      res.status(error.status || 500).json({
        code: error.code || 'GET_CHART_FAILED',
        reason: error.reason || error.message
      });
    }
  }
);

/**
 * POST /api/creator/revenue/withdraw
 * Request withdrawal (KYC verified creators only)
 */
router.post('/revenue/withdraw',
  requireAuth,
  [
    body('amount_coins').isInt({ min: 1 }).withMessage('Amount must be positive integer'),
    body('bankDetails').optional().isObject().withMessage('Bank details must be object')
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

      const creatorId = req.user.id;
      const amountCoins = parseInt(req.body.amount_coins);

      // Get creator revenue account
      const creatorRevenue = await CreatorRevenue.getOrCreate(creatorId);

      // Check if payment info verified
      if (!creatorRevenue.paymentInfo.verified) {
        return res.status(403).json({
          code: 'PAYMENT_INFO_NOT_VERIFIED',
          reason: 'Please complete KYC verification before withdrawing',
          kyc_status: 'pending'
        });
      }

      // Check available balance
      if (creatorRevenue.balance.available_coins < amountCoins) {
        return res.status(400).json({
          code: 'INSUFFICIENT_BALANCE',
          reason: `Insufficient available balance. Available: ${creatorRevenue.balance.available_coins} coins`,
          available_coins: creatorRevenue.balance.available_coins
        });
      }

      // TODO: Implement actual withdrawal via WalletService
      // For now, use initWithdraw from WalletService (Phase 4.1)
      
      const Wallet = require('../models/Wallet');
      const creatorWallet = await Wallet.findOne({ userId: creatorId });
      
      if (!creatorWallet) {
        return res.status(404).json({
          code: 'WALLET_NOT_FOUND',
          reason: 'Creator wallet does not exist'
        });
      }

      // Convert coins to cents for wallet operation
      const amountCents = amountCoins * 10000;

      // Create withdrawal transaction via WalletService
      const withdrawalTx = await WalletService.initWithdraw(
        creatorWallet._id,
        amountCents,
        {
          bankName: creatorRevenue.paymentInfo.bankName,
          accountNumber: creatorRevenue.paymentInfo.accountNumber,
          accountName: creatorRevenue.paymentInfo.accountName
        }
      );

      // Record withdrawal in CreatorRevenue
      const withdrawal = await creatorRevenue.withdraw(amountCoins, withdrawalTx._id.toString());

      // TODO: Emit Socket.io event WITHDRAWAL_INITIATED

      res.json({
        success: true,
        message: 'Withdrawal initiated successfully',
        withdrawal: {
          id: withdrawal._id,
          amount_coins: amountCoins,
          amount_rupiah: amountCoins * 100,
          status: withdrawal.status,
          withdrawnAt: withdrawal.withdrawnAt,
          bankDetails: {
            bankName: creatorRevenue.paymentInfo.bankName,
            accountNumber: '***' + creatorRevenue.paymentInfo.accountNumber.slice(-4) // Masked
          }
        },
        remainingBalance: {
          available_coins: creatorRevenue.balance.available_coins,
          available_rupiah: creatorRevenue.balance.available_coins * 100
        }
      });

    } catch (error) {
      console.error('Withdrawal error:', error);
      res.status(error.status || 500).json({
        code: error.code || 'WITHDRAWAL_FAILED',
        reason: error.reason || error.message
      });
    }
  }
);

/**
 * PUT /api/creator/revenue/payment-info
 * Set or update payment information (bank details)
 */
router.put('/revenue/payment-info',
  requireAuth,
  [
    body('bankName').isString().withMessage('Bank name required'),
    body('accountNumber').isString().withMessage('Account number required'),
    body('accountName').isString().withMessage('Account name required'),
    body('taxId').optional().isString().withMessage('Tax ID must be string')
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

      const creatorId = req.user.id;
      const { bankName, accountNumber, accountName, taxId } = req.body;

      const creatorRevenue = await CreatorRevenue.getOrCreate(creatorId);
      
      await creatorRevenue.setPaymentInfo({
        bankName,
        accountNumber,
        accountName,
        taxId
      });

      res.json({
        success: true,
        message: 'Payment information submitted. Pending admin verification.',
        paymentInfo: {
          bankName,
          accountNumber: '***' + accountNumber.slice(-4), // Masked
          verified: creatorRevenue.paymentInfo.verified
        }
      });

    } catch (error) {
      console.error('Set payment info error:', error);
      res.status(error.status || 500).json({
        code: error.code || 'SET_PAYMENT_INFO_FAILED',
        reason: error.reason || error.message
      });
    }
  }
);

/**
 * GET /api/creator/revenue/payment-info
 * Get current payment information status
 */
router.get('/revenue/payment-info',
  requireAuth,
  async (req, res) => {
    try {
      const creatorId = req.user.id;
      const creatorRevenue = await CreatorRevenue.getOrCreate(creatorId);

      res.json({
        success: true,
        paymentInfo: {
          hasPaymentInfo: !!(creatorRevenue.paymentInfo?.bankName),
          verified: creatorRevenue.paymentInfo?.verified || false,
          bankName: creatorRevenue.paymentInfo?.bankName || null,
          accountNumber: creatorRevenue.paymentInfo?.accountNumber 
            ? '***' + creatorRevenue.paymentInfo.accountNumber.slice(-4)
            : null
        }
      });

    } catch (error) {
      console.error('Get payment info error:', error);
      res.status(error.status || 500).json({
        code: error.code || 'GET_PAYMENT_INFO_FAILED',
        reason: error.reason || error.message
      });
    }
  }
);

/**
 * GET /api/creator/revenue/top-content
 * Get creator's top performing content by revenue
 */
router.get('/revenue/top-content',
  requireAuth,
  [
    query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be 1-50'),
    query('days').optional().isInt({ min: 1, max: 365 }).withMessage('Days must be 1-365')
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

      const creatorId = req.user.id;
      const limit = parseInt(req.query.limit) || 10;
      const days = parseInt(req.query.days) || 30;

      const topContent = await RevenueAnalyticsService.getTopContent(creatorId, limit, days);

      res.json({
        success: true,
        topContent
      });

    } catch (error) {
      console.error('Get top content error:', error);
      res.status(error.status || 500).json({
        code: error.code || 'GET_TOP_CONTENT_FAILED',
        reason: error.reason || error.message
      });
    }
  }
);

/**
 * PUT /api/creator/revenue/settings
 * Update revenue settings (auto-withdrawal threshold, etc.)
 */
router.put('/revenue/settings',
  requireAuth,
  [
    body('autoWithdrawEnabled').optional().isBoolean().withMessage('autoWithdrawEnabled must be boolean'),
    body('autoWithdrawThreshold_coins').optional().isInt({ min: 100 }).withMessage('Threshold must be at least 100 coins')
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

      const creatorId = req.user.id;
      const creatorRevenue = await CreatorRevenue.getOrCreate(creatorId);

      // Update settings
      if (req.body.autoWithdrawEnabled !== undefined) {
        creatorRevenue.settings.autoWithdrawEnabled = req.body.autoWithdrawEnabled;
      }
      if (req.body.autoWithdrawThreshold_coins !== undefined) {
        creatorRevenue.settings.autoWithdrawThreshold_coins = parseInt(req.body.autoWithdrawThreshold_coins);
      }

      await creatorRevenue.save();

      res.json({
        success: true,
        message: 'Revenue settings updated',
        settings: creatorRevenue.settings
      });

    } catch (error) {
      console.error('Update settings error:', error);
      res.status(error.status || 500).json({
        code: error.code || 'UPDATE_SETTINGS_FAILED',
        reason: error.reason || error.message
      });
    }
  }
);

module.exports = router;
