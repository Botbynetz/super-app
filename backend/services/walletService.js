const mongoose = require('mongoose');
const Wallet = require('../models/Wallet');
const WalletTransaction = require('../models/WalletTransaction');
const AuditLog = require('../models/AuditLog');

class WalletService {
  /**
   * Get or create wallet for user
   */
  static async getOrCreateWallet(userId) {
    return await Wallet.getOrCreate(userId);
  }

  /**
   * Get wallet balance
   */
  static async getBalance(userId) {
    const wallet = await Wallet.findOne({ userId });
    if (!wallet) {
      throw new Error('Wallet not found');
    }
    
    return {
      balance_cents: wallet.balance_cents,
      balance_rupiah: wallet.balance_rupiah,
      balance_coins: wallet.balance_coins,
      currency: wallet.currency,
      status: wallet.status,
      lastTransactionAt: wallet.lastTransactionAt
    };
  }

  /**
   * Initialize deposit (create pending transaction)
   */
  static async initDeposit(userId, amount_cents, meta = {}) {
    // Validate amount
    if (amount_cents <= 0 || !Number.isInteger(amount_cents)) {
      throw new Error('Invalid deposit amount');
    }

    // Get wallet
    const wallet = await this.getOrCreateWallet(userId);

    // Create pending transaction
    const transaction = await WalletTransaction.create({
      userId,
      type: 'deposit',
      amount_cents,
      currency: wallet.currency,
      status: 'pending',
      balanceBefore_cents: wallet.balance_cents,
      balanceAfter_cents: wallet.balance_cents, // Will be updated on confirm
      meta,
      provider: meta.provider || 'midtrans'
    });

    // Create audit log
    await AuditLog.createLog({
      txId: transaction.txId,
      action: 'create',
      entity: 'transaction',
      entityId: transaction._id,
      actor: {
        id: userId,
        role: 'user'
      },
      after: transaction.toObject(),
      reason: 'Deposit initiated'
    });

    return {
      depositId: transaction.txId,
      amount_cents: transaction.amount_cents,
      status: transaction.status,
      createdAt: transaction.createdAt
    };
  }

  /**
   * Confirm deposit (idempotent via providerTxId)
   */
  static async confirmDeposit(depositId, providerTxId, providerStatus, providerResponse = {}) {
    // Check idempotency - if already processed, return existing result
    const existingTx = await WalletTransaction.findByProviderTxId(providerTxId);
    if (existingTx) {
      return {
        success: true,
        alreadyProcessed: true,
        transaction: existingTx
      };
    }

    // Find pending deposit
    const transaction = await WalletTransaction.findOne({ txId: depositId, status: 'pending' });
    if (!transaction) {
      throw new Error('Deposit transaction not found or already processed');
    }

    // Check provider status
    if (providerStatus !== 'success' && providerStatus !== 'settlement') {
      // Mark as failed
      transaction.status = 'failed';
      transaction.failureReason = `Provider status: ${providerStatus}`;
      transaction.providerTxId = providerTxId;
      transaction.providerResponse = providerResponse;
      await transaction.save();

      await AuditLog.createLog({
        txId: transaction.txId,
        action: 'rollback',
        entity: 'transaction',
        entityId: transaction._id,
        actor: { role: 'system' },
        before: { status: 'pending' },
        after: { status: 'failed' },
        reason: transaction.failureReason
      });

      throw new Error('Payment failed');
    }

    // Start MongoDB session for atomic operation
    const session = await mongoose.startSession();
    
    try {
      await session.withTransaction(async () => {
        // Update wallet balance atomically
        const updatedWallet = await Wallet.updateBalanceAtomic(
          transaction.userId,
          transaction.amount_cents,
          session
        );

        // Update transaction
        transaction.status = 'completed';
        transaction.balanceAfter_cents = updatedWallet.balance_cents;
        transaction.providerTxId = providerTxId;
        transaction.providerResponse = providerResponse;
        transaction.processedAt = new Date();
        await transaction.save({ session });

        // Update wallet statistics
        await Wallet.findOneAndUpdate(
          { userId: transaction.userId },
          {
            $inc: { totalDeposited_cents: transaction.amount_cents }
          },
          { session }
        );

        // Create audit log
        await AuditLog.createLog({
          txId: transaction.txId,
          action: 'commit',
          entity: 'wallet',
          entityId: updatedWallet._id,
          actor: { role: 'system' },
          before: { balance_cents: transaction.balanceBefore_cents },
          after: { balance_cents: updatedWallet.balance_cents },
          reason: 'Deposit confirmed',
          metadata: { providerTxId, providerStatus }
        });
      });

      await session.endSession();

      return {
        success: true,
        transaction: transaction.toObject()
      };
    } catch (error) {
      await session.endSession();
      
      // Mark transaction as failed
      transaction.status = 'failed';
      transaction.failureReason = error.message;
      await transaction.save();

      await AuditLog.createLog({
        txId: transaction.txId,
        action: 'rollback',
        entity: 'transaction',
        entityId: transaction._id,
        actor: { role: 'system' },
        reason: `Transaction rollback: ${error.message}`
      });

      throw error;
    }
  }

  /**
   * Transfer coins between users (atomic)
   */
  static async transfer(fromUserId, toUserId, amount_cents, idempotencyKey, meta = {}) {
    // Validate
    if (fromUserId.toString() === toUserId.toString()) {
      throw new Error('Cannot transfer to yourself');
    }

    if (amount_cents <= 0 || !Number.isInteger(amount_cents)) {
      throw new Error('Invalid transfer amount');
    }

    // Check idempotency
    if (idempotencyKey) {
      const existing = await WalletTransaction.findByIdempotencyKey(idempotencyKey);
      if (existing) {
        return {
          success: true,
          alreadyProcessed: true,
          transaction: existing
        };
      }
    }

    // Get both wallets
    const [fromWallet, toWallet] = await Promise.all([
      this.getOrCreateWallet(fromUserId),
      this.getOrCreateWallet(toUserId)
    ]);

    // Check sender balance
    if (!fromWallet.canDeduct(amount_cents)) {
      throw new Error('Insufficient balance');
    }

    // Start MongoDB session
    const session = await mongoose.startSession();
    let txOutId, txInId;

    try {
      await session.withTransaction(async () => {
        // Deduct from sender
        const updatedFromWallet = await Wallet.updateBalanceAtomic(
          fromUserId,
          -amount_cents,
          session
        );

        // Add to receiver
        const updatedToWallet = await Wallet.updateBalanceAtomic(
          toUserId,
          amount_cents,
          session
        );

        // Create transfer_out transaction
        const txOut = await WalletTransaction.create([{
          userId: fromUserId,
          type: 'transfer_out',
          amount_cents: -amount_cents,
          currency: fromWallet.currency,
          status: 'completed',
          balanceBefore_cents: fromWallet.balance_cents,
          balanceAfter_cents: updatedFromWallet.balance_cents,
          relatedUserId: toUserId,
          idempotencyKey,
          meta,
          processedAt: new Date()
        }], { session });

        txOutId = txOut[0].txId;

        // Create transfer_in transaction
        const txIn = await WalletTransaction.create([{
          userId: toUserId,
          type: 'transfer_in',
          amount_cents: amount_cents,
          currency: toWallet.currency,
          status: 'completed',
          balanceBefore_cents: toWallet.balance_cents,
          balanceAfter_cents: updatedToWallet.balance_cents,
          relatedUserId: fromUserId,
          relatedTxId: txOutId,
          meta,
          processedAt: new Date()
        }], { session });

        txInId = txIn[0].txId;

        // Link transactions
        await WalletTransaction.findOneAndUpdate(
          { txId: txOutId },
          { relatedTxId: txInId },
          { session }
        );

        // Update wallet statistics
        await Promise.all([
          Wallet.findOneAndUpdate(
            { userId: fromUserId },
            { $inc: { totalTransferred_cents: amount_cents } },
            { session }
          ),
          Wallet.findOneAndUpdate(
            { userId: toUserId },
            { $inc: { totalReceived_cents: amount_cents } },
            { session }
          )
        ]);

        // Create audit logs
        await Promise.all([
          AuditLog.createLog({
            txId: txOutId,
            action: 'commit',
            entity: 'wallet',
            entityId: updatedFromWallet._id,
            actor: { id: fromUserId, role: 'user' },
            before: { balance_cents: fromWallet.balance_cents },
            after: { balance_cents: updatedFromWallet.balance_cents },
            reason: `Transfer to user ${toUserId}`,
            metadata: { toUserId, amount_cents }
          }),
          AuditLog.createLog({
            txId: txInId,
            action: 'commit',
            entity: 'wallet',
            entityId: updatedToWallet._id,
            actor: { id: fromUserId, role: 'user' },
            before: { balance_cents: toWallet.balance_cents },
            after: { balance_cents: updatedToWallet.balance_cents },
            reason: `Transfer from user ${fromUserId}`,
            metadata: { fromUserId, amount_cents }
          })
        ]);
      });

      await session.endSession();

      const [txOut, txIn] = await Promise.all([
        WalletTransaction.findOne({ txId: txOutId }).populate('relatedUserId', 'username profilePhoto'),
        WalletTransaction.findOne({ txId: txInId }).populate('relatedUserId', 'username profilePhoto')
      ]);

      return {
        success: true,
        transactions: {
          sender: txOut,
          receiver: txIn
        }
      };
    } catch (error) {
      await session.endSession();

      // Create audit log for failure
      await AuditLog.createLog({
        txId: 'failed_transfer',
        action: 'rollback',
        entity: 'wallet',
        entityId: fromWallet._id,
        actor: { id: fromUserId, role: 'user' },
        reason: `Transfer failed: ${error.message}`,
        metadata: { toUserId, amount_cents }
      });

      throw error;
    }
  }

  /**
   * Initialize withdrawal
   */
  static async initWithdraw(userId, amount_cents, bankDetails, meta = {}) {
    // Validate
    if (amount_cents <= 0 || !Number.isInteger(amount_cents)) {
      throw new Error('Invalid withdrawal amount');
    }

    // Get wallet
    const wallet = await this.getOrCreateWallet(userId);

    // Check balance
    if (!wallet.canDeduct(amount_cents)) {
      throw new Error('Insufficient balance');
    }

    // Check wallet status
    if (wallet.status !== 'active') {
      throw new Error('Wallet is not active');
    }

    // Create pending withdrawal transaction
    const transaction = await WalletTransaction.create({
      userId,
      type: 'withdraw',
      amount_cents: -amount_cents,
      currency: wallet.currency,
      status: 'pending',
      balanceBefore_cents: wallet.balance_cents,
      balanceAfter_cents: wallet.balance_cents - amount_cents,
      bankDetails,
      meta,
      provider: meta.provider || 'manual'
    });

    // Create audit log
    await AuditLog.createLog({
      txId: transaction.txId,
      action: 'create',
      entity: 'transaction',
      entityId: transaction._id,
      actor: { id: userId, role: 'user' },
      after: transaction.toObject(),
      reason: 'Withdrawal initiated'
    });

    return {
      withdrawId: transaction.txId,
      amount_cents: Math.abs(transaction.amount_cents),
      status: transaction.status,
      bankDetails: transaction.bankDetails,
      createdAt: transaction.createdAt
    };
  }

  /**
   * Confirm withdrawal (admin action or webhook)
   */
  static async confirmWithdraw(withdrawId, providerTxId, status, processedBy = null, meta = {}) {
    // Check idempotency
    if (providerTxId) {
      const existing = await WalletTransaction.findByProviderTxId(providerTxId);
      if (existing) {
        return {
          success: true,
          alreadyProcessed: true,
          transaction: existing
        };
      }
    }

    // Find pending withdrawal
    const transaction = await WalletTransaction.findOne({ 
      txId: withdrawId,
      status: 'pending'
    });

    if (!transaction) {
      throw new Error('Withdrawal not found or already processed');
    }

    const session = await mongoose.startSession();

    try {
      await session.withTransaction(async () => {
        if (status === 'success' || status === 'completed') {
          // Deduct balance
          const updatedWallet = await Wallet.updateBalanceAtomic(
            transaction.userId,
            transaction.amount_cents,
            session
          );

          // Update transaction
          transaction.status = 'completed';
          transaction.balanceAfter_cents = updatedWallet.balance_cents;
          transaction.providerTxId = providerTxId;
          transaction.processedBy = processedBy;
          transaction.processedAt = new Date();
          transaction.meta = { ...transaction.meta, ...meta };
          await transaction.save({ session });

          // Update statistics
          await Wallet.findOneAndUpdate(
            { userId: transaction.userId },
            { $inc: { totalWithdrawn_cents: Math.abs(transaction.amount_cents) } },
            { session }
          );

          // Audit log
          await AuditLog.createLog({
            txId: transaction.txId,
            action: 'commit',
            entity: 'wallet',
            entityId: updatedWallet._id,
            actor: { id: processedBy, role: processedBy ? 'admin' : 'system' },
            before: { balance_cents: transaction.balanceBefore_cents },
            after: { balance_cents: updatedWallet.balance_cents },
            reason: 'Withdrawal completed',
            metadata: { providerTxId, status }
          });
        } else {
          // Mark as failed
          transaction.status = 'failed';
          transaction.failureReason = meta.reason || `Withdrawal failed: ${status}`;
          transaction.providerTxId = providerTxId;
          transaction.processedBy = processedBy;
          transaction.processedAt = new Date();
          await transaction.save({ session });

          // Audit log
          await AuditLog.createLog({
            txId: transaction.txId,
            action: 'rollback',
            entity: 'transaction',
            entityId: transaction._id,
            actor: { id: processedBy, role: processedBy ? 'admin' : 'system' },
            before: { status: 'pending' },
            after: { status: 'failed' },
            reason: transaction.failureReason
          });
        }
      });

      await session.endSession();

      return {
        success: true,
        transaction: transaction.toObject()
      };
    } catch (error) {
      await session.endSession();
      throw error;
    }
  }

  /**
   * Get transaction history
   */
  static async getHistory(userId, options = {}) {
    return await WalletTransaction.getUserHistory(userId, options);
  }

  /**
   * Get transaction audit trail
   */
  static async getAuditTrail(txId) {
    return await AuditLog.getTransactionTrail(txId);
  }

  /**
   * Freeze wallet (admin action)
   */
  static async freezeWallet(userId, reason, adminId) {
    const wallet = await Wallet.findOne({ userId });
    if (!wallet) {
      throw new Error('Wallet not found');
    }

    const beforeStatus = wallet.status;
    await wallet.freeze(reason);

    await AuditLog.createLog({
      txId: `freeze_${Date.now()}`,
      action: 'freeze',
      entity: 'wallet',
      entityId: wallet._id,
      actor: { id: adminId, role: 'admin' },
      before: { status: beforeStatus },
      after: { status: 'frozen' },
      reason
    });

    return wallet;
  }

  /**
   * Unfreeze wallet (admin action)
   */
  static async unfreezeWallet(userId, reason, adminId) {
    const wallet = await Wallet.findOne({ userId });
    if (!wallet) {
      throw new Error('Wallet not found');
    }

    const beforeStatus = wallet.status;
    await wallet.unfreeze();

    await AuditLog.createLog({
      txId: `unfreeze_${Date.now()}`,
      action: 'unfreeze',
      entity: 'wallet',
      entityId: wallet._id,
      actor: { id: adminId, role: 'admin' },
      before: { status: beforeStatus },
      after: { status: 'active' },
      reason
    });

    return wallet;
  }
}

module.exports = WalletService;
