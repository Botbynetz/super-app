const express = require('express');
const router = express.Router();
const { body, query, validationResult } = require('express-validator');
const rateLimit = require('express-rate-limit');
const WalletService = require('../services/walletService');
const { authenticateToken } = require('../middleware/auth');

// Rate limiters
const transferLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10,
  message: 'Too many transfer requests, please try again later'
});

const withdrawLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 3,
  message: 'Too many withdrawal requests, please try again later'
});

const depositLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: 'Too many deposit requests, please try again later'
});

// Validation middleware
const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ 
      success: false,
      errors: errors.array() 
    });
  }
  next();
};

/**
 * GET /api/wallet/balance
 * Get wallet balance for authenticated user
 */
router.get('/balance', authenticateToken, async (req, res) => {
  try {
    const balance = await WalletService.getBalance(req.user.id);
    res.json({
      success: true,
      data: balance
    });
  } catch (error) {
    console.error('Get balance error:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

/**
 * GET /api/wallet/balance/:userId
 * Get wallet balance for specific user (admin or self)
 */
router.get('/balance/:userId', authenticateToken, async (req, res) => {
  try {
    // Check permission
    if (req.user.id !== req.params.userId && req.user.role !== 'admin') {
      return res.status(403).json({ 
        success: false,
        error: 'Forbidden' 
      });
    }

    const balance = await WalletService.getBalance(req.params.userId);
    res.json({
      success: true,
      data: balance
    });
  } catch (error) {
    console.error('Get balance error:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

/**
 * POST /api/wallet/deposit/init
 * Initialize deposit (create pending transaction)
 */
router.post('/deposit/init',
  authenticateToken,
  depositLimiter,
  [
    body('amount').isInt({ min: 10000 }).withMessage('Amount must be at least 100 cents (Rp 1)'),
    body('provider').optional().isIn(['midtrans', 'xendit', 'manual']).withMessage('Invalid provider')
  ],
  validateRequest,
  async (req, res) => {
    try {
      const { amount, provider = 'midtrans' } = req.body;
      
      const result = await WalletService.initDeposit(req.user.id, amount, {
        provider,
        initiatedBy: req.user.id
      });

      res.json({
        success: true,
        data: result,
        message: 'Deposit initiated successfully'
      });
    } catch (error) {
      console.error('Init deposit error:', error);
      res.status(400).json({ 
        success: false,
        error: error.message 
      });
    }
  }
);

/**
 * POST /api/wallet/deposit/confirm
 * Confirm deposit (webhook handler - idempotent)
 */
router.post('/deposit/confirm',
  [
    body('depositId').notEmpty().withMessage('Deposit ID required'),
    body('providerTxId').notEmpty().withMessage('Provider transaction ID required'),
    body('status').isIn(['success', 'settlement', 'failed', 'cancelled']).withMessage('Invalid status'),
    body('signature').optional().isString()
  ],
  validateRequest,
  async (req, res) => {
    try {
      const { depositId, providerTxId, status, signature, ...providerResponse } = req.body;

      // TODO: Verify webhook signature (Midtrans/Xendit)
      // For now, accepting without verification (should be implemented)

      const result = await WalletService.confirmDeposit(
        depositId,
        providerTxId,
        status,
        providerResponse
      );

      // Emit Socket.io event if successful and not already processed
      if (result.success && !result.alreadyProcessed) {
        const io = req.app.get('io');
        if (io) {
          io.to(`user:${result.transaction.userId}`).emit('COIN_UPDATE', {
            balance: result.transaction.balanceAfter_cents,
            change: result.transaction.amount_cents,
            reason: 'deposit',
            transactionId: result.transaction.txId
          });

          io.to(`user:${result.transaction.userId}`).emit('transaction-update', {
            transactionId: result.transaction.txId,
            status: 'completed',
            type: 'deposit'
          });
        }
      }

      res.json({
        success: true,
        data: result,
        message: result.alreadyProcessed ? 'Already processed' : 'Deposit confirmed'
      });
    } catch (error) {
      console.error('Confirm deposit error:', error);
      res.status(400).json({ 
        success: false,
        error: error.message 
      });
    }
  }
);

/**
 * POST /api/wallet/transfer
 * Transfer coins to another user (idempotent)
 */
router.post('/transfer',
  authenticateToken,
  transferLimiter,
  [
    body('toUserId').notEmpty().withMessage('Recipient user ID required'),
    body('amount').isInt({ min: 1 }).withMessage('Amount must be positive integer'),
    body('idempotencyKey').optional().isString(),
    body('note').optional().isString().isLength({ max: 200 })
  ],
  validateRequest,
  async (req, res) => {
    try {
      const { toUserId, amount, idempotencyKey, note } = req.body;

      const result = await WalletService.transfer(
        req.user.id,
        toUserId,
        amount,
        idempotencyKey,
        {
          note,
          initiatedBy: req.user.id,
          ip: req.ip,
          userAgent: req.get('user-agent')
        }
      );

      // Emit Socket.io events if successful and not already processed
      if (result.success && !result.alreadyProcessed) {
        const io = req.app.get('io');
        if (io) {
          // Notify sender
          io.to(`user:${req.user.id}`).emit('COIN_UPDATE', {
            balance: result.transactions.sender.balanceAfter_cents,
            change: -amount,
            reason: 'transfer_sent',
            transactionId: result.transactions.sender.txId,
            recipientId: toUserId
          });

          // Notify receiver
          io.to(`user:${toUserId}`).emit('COIN_UPDATE', {
            balance: result.transactions.receiver.balanceAfter_cents,
            change: amount,
            reason: 'transfer_received',
            transactionId: result.transactions.receiver.txId,
            senderId: req.user.id
          });
        }
      }

      res.json({
        success: true,
        data: {
          senderTransaction: result.transactions.sender,
          receiverTransaction: result.transactions.receiver,
          alreadyProcessed: result.alreadyProcessed
        },
        message: result.alreadyProcessed ? 'Already processed' : 'Transfer successful'
      });
    } catch (error) {
      console.error('Transfer error:', error);
      res.status(400).json({ 
        success: false,
        error: error.message 
      });
    }
  }
);

/**
 * POST /api/wallet/withdraw/init
 * Initialize withdrawal
 */
router.post('/withdraw/init',
  authenticateToken,
  withdrawLimiter,
  [
    body('amount').isInt({ min: 100000 }).withMessage('Minimum withdrawal is 1000 cents (Rp 10)'),
    body('bankDetails').isObject().withMessage('Bank details required'),
    body('bankDetails.bankName').notEmpty().withMessage('Bank name required'),
    body('bankDetails.accountNumber').notEmpty().withMessage('Account number required'),
    body('bankDetails.accountName').notEmpty().withMessage('Account name required')
  ],
  validateRequest,
  async (req, res) => {
    try {
      const { amount, bankDetails, provider = 'manual' } = req.body;

      const result = await WalletService.initWithdraw(
        req.user.id,
        amount,
        bankDetails,
        {
          provider,
          initiatedBy: req.user.id,
          ip: req.ip,
          userAgent: req.get('user-agent')
        }
      );

      res.json({
        success: true,
        data: result,
        message: 'Withdrawal request submitted. Please wait for admin approval.'
      });
    } catch (error) {
      console.error('Init withdraw error:', error);
      res.status(400).json({ 
        success: false,
        error: error.message 
      });
    }
  }
);

/**
 * POST /api/wallet/withdraw/confirm
 * Confirm withdrawal (admin only)
 */
router.post('/withdraw/confirm',
  authenticateToken,
  [
    body('withdrawId').notEmpty().withMessage('Withdrawal ID required'),
    body('status').isIn(['success', 'completed', 'failed', 'cancelled']).withMessage('Invalid status'),
    body('providerTxId').optional().isString(),
    body('reason').optional().isString()
  ],
  validateRequest,
  async (req, res) => {
    try {
      // Check admin permission
      if (req.user.role !== 'admin') {
        return res.status(403).json({ 
          success: false,
          error: 'Admin permission required' 
        });
      }

      const { withdrawId, status, providerTxId, reason } = req.body;

      const result = await WalletService.confirmWithdraw(
        withdrawId,
        providerTxId,
        status,
        req.user.id,
        { reason }
      );

      // Emit Socket.io event
      if (result.success && !result.alreadyProcessed) {
        const io = req.app.get('io');
        if (io) {
          io.to(`user:${result.transaction.userId}`).emit('transaction-update', {
            transactionId: result.transaction.txId,
            status: result.transaction.status,
            type: 'withdraw'
          });

          if (result.transaction.status === 'completed') {
            io.to(`user:${result.transaction.userId}`).emit('COIN_UPDATE', {
              balance: result.transaction.balanceAfter_cents,
              change: result.transaction.amount_cents,
              reason: 'withdraw_completed',
              transactionId: result.transaction.txId
            });
          }
        }
      }

      res.json({
        success: true,
        data: result,
        message: `Withdrawal ${status === 'success' || status === 'completed' ? 'approved' : 'rejected'}`
      });
    } catch (error) {
      console.error('Confirm withdraw error:', error);
      res.status(400).json({ 
        success: false,
        error: error.message 
      });
    }
  }
);

/**
 * GET /api/wallet/history
 * Get transaction history for authenticated user
 */
router.get('/history',
  authenticateToken,
  [
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be positive integer'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1-100'),
    query('type').optional().isIn(['deposit', 'withdraw', 'transfer_out', 'transfer_in', 'purchase', 'refund', 'commission', 'adjustment']),
    query('status').optional().isIn(['pending', 'processing', 'completed', 'failed', 'cancelled', 'reversed'])
  ],
  validateRequest,
  async (req, res) => {
    try {
      const { page = 1, limit = 20, type, status } = req.query;
      
      const result = await WalletService.getHistory(req.user.id, {
        page: parseInt(page),
        limit: parseInt(limit),
        type,
        status
      });

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('Get history error:', error);
      res.status(500).json({ 
        success: false,
        error: error.message 
      });
    }
  }
);

/**
 * GET /api/wallet/history/:userId
 * Get transaction history for specific user (admin only)
 */
router.get('/history/:userId',
  authenticateToken,
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('type').optional().isIn(['deposit', 'withdraw', 'transfer_out', 'transfer_in', 'purchase', 'refund', 'commission', 'adjustment']),
    query('status').optional().isIn(['pending', 'processing', 'completed', 'failed', 'cancelled', 'reversed'])
  ],
  validateRequest,
  async (req, res) => {
    try {
      // Check permission
      if (req.user.id !== req.params.userId && req.user.role !== 'admin') {
        return res.status(403).json({ 
          success: false,
          error: 'Forbidden' 
        });
      }

      const { page = 1, limit = 20, type, status } = req.query;
      
      const result = await WalletService.getHistory(req.params.userId, {
        page: parseInt(page),
        limit: parseInt(limit),
        type,
        status
      });

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('Get history error:', error);
      res.status(500).json({ 
        success: false,
        error: error.message 
      });
    }
  }
);

/**
 * GET /api/wallet/audit/:txId
 * Get audit trail for transaction (admin only)
 */
router.get('/audit/:txId',
  authenticateToken,
  async (req, res) => {
    try {
      // Check admin permission
      if (req.user.role !== 'admin') {
        return res.status(403).json({ 
          success: false,
          error: 'Admin permission required' 
        });
      }

      const trail = await WalletService.getAuditTrail(req.params.txId);
      
      res.json({
        success: true,
        data: trail
      });
    } catch (error) {
      console.error('Get audit trail error:', error);
      res.status(500).json({ 
        success: false,
        error: error.message 
      });
    }
  }
);

/**
 * POST /api/wallet/freeze/:userId
 * Freeze wallet (admin only)
 */
router.post('/freeze/:userId',
  authenticateToken,
  [
    body('reason').notEmpty().withMessage('Reason required')
  ],
  validateRequest,
  async (req, res) => {
    try {
      // Check admin permission
      if (req.user.role !== 'admin') {
        return res.status(403).json({ 
          success: false,
          error: 'Admin permission required' 
        });
      }

      const { reason } = req.body;
      const wallet = await WalletService.freezeWallet(
        req.params.userId,
        reason,
        req.user.id
      );

      // Emit Socket.io event
      const io = req.app.get('io');
      if (io) {
        io.to(`user:${req.params.userId}`).emit('fraud-alert', {
          type: 'wallet_frozen',
          reason,
          timestamp: new Date()
        });
      }

      res.json({
        success: true,
        data: wallet,
        message: 'Wallet frozen successfully'
      });
    } catch (error) {
      console.error('Freeze wallet error:', error);
      res.status(400).json({ 
        success: false,
        error: error.message 
      });
    }
  }
);

/**
 * POST /api/wallet/unfreeze/:userId
 * Unfreeze wallet (admin only)
 */
router.post('/unfreeze/:userId',
  authenticateToken,
  [
    body('reason').notEmpty().withMessage('Reason required')
  ],
  validateRequest,
  async (req, res) => {
    try {
      // Check admin permission
      if (req.user.role !== 'admin') {
        return res.status(403).json({ 
          success: false,
          error: 'Admin permission required' 
        });
      }

      const { reason } = req.body;
      const wallet = await WalletService.unfreezeWallet(
        req.params.userId,
        reason,
        req.user.id
      );

      // Emit Socket.io event
      const io = req.app.get('io');
      if (io) {
        io.to(`user:${req.params.userId}`).emit('fraud-alert', {
          type: 'wallet_unfrozen',
          reason,
          timestamp: new Date()
        });
      }

      res.json({
        success: true,
        data: wallet,
        message: 'Wallet unfrozen successfully'
      });
    } catch (error) {
      console.error('Unfreeze wallet error:', error);
      res.status(400).json({ 
        success: false,
        error: error.message 
      });
    }
  }
);

module.exports = router;
