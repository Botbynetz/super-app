/**
 * PHASE 6 - Staging-Specific Features
 * Coin faucet, disabled payouts, test payment flags
 */

const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { logger } = require('../logger');
const telegramBot = require('../telegramBot');

/**
 * @route   POST /api/staging/faucet
 * @desc    Get free coins for testing (staging only)
 * @access  Authenticated
 */
router.post('/faucet', authenticate, async (req, res) => {
  try {
    // Only available in staging
    if (process.env.IS_STAGING !== 'true') {
      return res.status(403).json({
        success: false,
        message: 'Faucet only available in staging environment',
      });
    }

    const Wallet = require('../models/Wallet');
    const Transaction = require('../models/Transaction');
    const { logAudit } = require('../logger');

    const faucetAmount = parseInt(process.env.STAGING_FAUCET_AMOUNT) || 10000;
    
    // Check if user already claimed today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const alreadyClaimed = await Transaction.findOne({
      userId: req.user.id,
      type: 'FAUCET_CLAIM',
      createdAt: { $gte: today },
    });

    if (alreadyClaimed) {
      return res.status(400).json({
        success: false,
        message: 'Faucet already claimed today. Come back tomorrow!',
        nextClaim: new Date(today.getTime() + 24 * 60 * 60 * 1000),
      });
    }

    // Find or create wallet
    let wallet = await Wallet.findOne({ userId: req.user.id });
    
    if (!wallet) {
      wallet = await Wallet.create({
        userId: req.user.id,
        balance: 0,
      });
    }

    // Add coins
    wallet.balance += faucetAmount;
    await wallet.save();

    // Create transaction record
    await Transaction.create({
      userId: req.user.id,
      type: 'FAUCET_CLAIM',
      amount: faucetAmount,
      status: 'COMPLETED',
      description: 'Staging faucet claim',
    });

    // Log audit
    logAudit('FAUCET_CLAIM', {
      userId: req.user.id,
      amount: faucetAmount,
      newBalance: wallet.balance,
    });

    logger.info(`Faucet claimed by user ${req.user.id}: ${faucetAmount} coins`);

    res.json({
      success: true,
      message: `${faucetAmount} coins added to your wallet!`,
      data: {
        amount: faucetAmount,
        newBalance: wallet.balance,
        nextClaim: new Date(today.getTime() + 24 * 60 * 60 * 1000),
      },
    });
  } catch (error) {
    logger.error('Error processing faucet claim:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process faucet claim',
    });
  }
});

/**
 * @route   GET /api/staging/info
 * @desc    Get staging environment info
 * @access  Public
 */
router.get('/info', (req, res) => {
  res.json({
    success: true,
    data: {
      environment: 'staging',
      features: {
        faucet: process.env.ENABLE_COIN_FAUCET === 'true',
        realPayouts: process.env.DISABLE_REAL_PAYOUTS !== 'true',
        testMode: true,
      },
      limits: {
        faucetAmount: parseInt(process.env.STAGING_FAUCET_AMOUNT) || 10000,
        faucetCooldown: '24 hours',
      },
      warnings: [
        'This is a staging environment',
        'All transactions are for testing only',
        'Data may be reset periodically',
        'Real money payouts are disabled',
      ],
    },
  });
});

/**
 * @route   POST /api/staging/reset-wallet
 * @desc    Reset user wallet (for testing)
 * @access  Authenticated
 */
router.post('/reset-wallet', authenticate, async (req, res) => {
  try {
    if (process.env.IS_STAGING !== 'true') {
      return res.status(403).json({
        success: false,
        message: 'Wallet reset only available in staging',
      });
    }

    const Wallet = require('../models/Wallet');
    
    const wallet = await Wallet.findOne({ userId: req.user.id });
    
    if (!wallet) {
      return res.status(404).json({
        success: false,
        message: 'Wallet not found',
      });
    }

    const oldBalance = wallet.balance;
    wallet.balance = 0;
    await wallet.save();

    logger.info(`Wallet reset for user ${req.user.id}: ${oldBalance} -> 0`);

    res.json({
      success: true,
      message: 'Wallet reset successfully',
      data: {
        oldBalance,
        newBalance: 0,
      },
    });
  } catch (error) {
    logger.error('Error resetting wallet:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reset wallet',
    });
  }
});

/**
 * @route   POST /api/staging/simulate-error
 * @desc    Trigger test error for monitoring (admin only)
 * @access  Authenticated
 */
router.post('/simulate-error', authenticate, async (req, res) => {
  try {
    if (process.env.IS_STAGING !== 'true') {
      return res.status(403).json({
        success: false,
        message: 'Error simulation only available in staging',
      });
    }

    const { requireAdmin } = require('../middleware/auth');
    
    // Check admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required',
      });
    }

    const { errorType = 'generic' } = req.body;

    switch (errorType) {
      case 'generic':
        throw new Error('Simulated generic error for testing');
      
      case 'database':
        await require('mongoose').connection.db.admin().command({ invalid: true });
        break;
      
      case 'telegram':
        await telegramBot.sendCustomAlert(
          'Test Alert',
          'This is a test alert from staging',
          'high'
        );
        break;
      
      case 'memory':
        const bigArray = new Array(10000000).fill('memory-test');
        logger.info(`Created array with ${bigArray.length} elements`);
        break;
      
      default:
        throw new Error(`Unknown error type: ${errorType}`);
    }

    res.json({
      success: true,
      message: `${errorType} error simulated successfully`,
    });
  } catch (error) {
    logger.error('Simulated error:', error);
    
    // This should trigger Sentry and Telegram alerts
    const { captureException } = require('../monitoring');
    captureException(error, { simulation: true, errorType: req.body.errorType });
    
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

module.exports = router;
