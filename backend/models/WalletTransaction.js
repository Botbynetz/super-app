const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const walletTransactionSchema = new mongoose.Schema({
  txId: {
    type: String,
    required: true,
    unique: true,
    default: () => `tx_${uuidv4()}`,
    index: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  type: {
    type: String,
    required: true,
    enum: ['deposit', 'withdraw', 'transfer_out', 'transfer_in', 'purchase', 'refund', 'commission', 'adjustment'],
    index: true
  },
  amount_cents: {
    type: Number,
    required: true,
    validate: {
      validator: Number.isInteger,
      message: 'Amount must be an integer (cents)'
    }
  },
  currency: {
    type: String,
    required: true,
    default: 'IDR',
    enum: ['IDR', 'USD']
  },
  status: {
    type: String,
    required: true,
    default: 'pending',
    enum: ['pending', 'processing', 'completed', 'failed', 'cancelled', 'reversed'],
    index: true
  },
  // Balance snapshots
  balanceBefore_cents: {
    type: Number,
    required: true
  },
  balanceAfter_cents: {
    type: Number,
    required: true
  },
  // Related entities
  relatedUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  relatedTxId: {
    type: String
  },
  // Provider information (for deposits/withdrawals)
  providerTxId: {
    type: String,
    unique: true,
    sparse: true,
    index: true
  },
  provider: {
    type: String,
    enum: ['midtrans', 'xendit', 'manual', 'system']
  },
  providerResponse: {
    type: mongoose.Schema.Types.Mixed
  },
  // Idempotency
  idempotencyKey: {
    type: String,
    unique: true,
    sparse: true,
    index: true
  },
  // Metadata
  meta: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  description: {
    type: String
  },
  // Bank details for withdrawals
  bankDetails: {
    bankName: String,
    accountNumber: String,
    accountName: String
  },
  // Audit
  processedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  processedAt: {
    type: Date
  },
  failureReason: {
    type: String
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Compound indexes for queries
walletTransactionSchema.index({ userId: 1, createdAt: -1 });
walletTransactionSchema.index({ userId: 1, type: 1, status: 1 });
walletTransactionSchema.index({ status: 1, createdAt: -1 });
walletTransactionSchema.index({ providerTxId: 1 }, { unique: true, sparse: true });
walletTransactionSchema.index({ idempotencyKey: 1 }, { unique: true, sparse: true });

// Pre-save hook
walletTransactionSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Virtual for amount in rupiah
walletTransactionSchema.virtual('amount_rupiah').get(function() {
  return this.amount_cents / 100;
});

// Virtual for amount in coins
walletTransactionSchema.virtual('amount_coins').get(function() {
  return Math.floor(this.amount_cents / 10000);
});

// Method to mark as completed
walletTransactionSchema.methods.markCompleted = function(balanceAfter_cents, processedBy = null) {
  this.status = 'completed';
  this.balanceAfter_cents = balanceAfter_cents;
  this.processedAt = Date.now();
  if (processedBy) this.processedBy = processedBy;
  return this.save();
};

// Method to mark as failed
walletTransactionSchema.methods.markFailed = function(reason) {
  this.status = 'failed';
  this.failureReason = reason;
  this.processedAt = Date.now();
  return this.save();
};

// Static method to find by idempotency key
walletTransactionSchema.statics.findByIdempotencyKey = async function(key) {
  return this.findOne({ idempotencyKey: key });
};

// Static method to find by provider transaction ID
walletTransactionSchema.statics.findByProviderTxId = async function(providerTxId) {
  return this.findOne({ providerTxId });
};

// Static method to get user transaction history
walletTransactionSchema.statics.getUserHistory = async function(userId, options = {}) {
  const {
    page = 1,
    limit = 50,
    type = null,
    status = null,
    startDate = null,
    endDate = null
  } = options;

  const query = { userId };
  
  if (type) query.type = type;
  if (status) query.status = status;
  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) query.createdAt.$gte = new Date(startDate);
    if (endDate) query.createdAt.$lte = new Date(endDate);
  }

  const skip = (page - 1) * limit;

  const [transactions, total] = await Promise.all([
    this.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('relatedUserId', 'username profilePhoto')
      .lean(),
    this.countDocuments(query)
  ]);

  return {
    transactions,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  };
};

const WalletTransaction = mongoose.model('WalletTransaction', walletTransactionSchema);

module.exports = WalletTransaction;
