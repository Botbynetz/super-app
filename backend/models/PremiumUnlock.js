const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const premiumUnlockSchema = new mongoose.Schema({
  unlockId: {
    type: String,
    required: true,
    unique: true,
    default: () => `unlock_${uuidv4()}`
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  contentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PremiumContent',
    required: true,
    index: true
  },
  creatorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  amount_coins: {
    type: Number,
    required: true,
    min: 1,
    validate: {
      validator: Number.isInteger,
      message: 'Amount must be an integer'
    }
  },
  platform_share: {
    type: Number,
    required: true,
    min: 0
  },
  creator_share: {
    type: Number,
    required: true,
    min: 0
  },
  processing_fee: {
    type: Number,
    required: true,
    min: 0
  },
  txStatus: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'refunded'],
    default: 'pending',
    index: true
  },
  walletTxIds: {
    buyer_tx: String, // Reference to buyer's wallet transaction
    creator_tx: String, // Reference to creator's wallet transaction
    platform_tx: String // Reference to platform's wallet transaction
  },
  idempotencyKey: {
    type: String,
    unique: true,
    sparse: true,
    index: true
  },
  metadata: {
    ip: String,
    userAgent: String,
    device: String,
    failureReason: String,
    refundReason: String,
    refundedAt: Date,
    refundedBy: mongoose.Schema.Types.ObjectId
  },
  completedAt: Date,
  failedAt: Date
}, {
  timestamps: true
});

// Compound indexes
premiumUnlockSchema.index({ userId: 1, contentId: 1, txStatus: 1 });
premiumUnlockSchema.index({ creatorId: 1, txStatus: 1, createdAt: -1 });
premiumUnlockSchema.index({ txStatus: 1, createdAt: -1 });
premiumUnlockSchema.index({ idempotencyKey: 1 }, { unique: true, sparse: true });

// Virtual for amount in cents (for wallet operations)
premiumUnlockSchema.virtual('amount_cents').get(function() {
  return this.amount_coins * 10000; // 1 coin = 10000 cents
});

// Instance method: Mark as completed
premiumUnlockSchema.methods.markCompleted = async function(walletTxIds) {
  this.txStatus = 'completed';
  this.completedAt = new Date();
  if (walletTxIds) {
    this.walletTxIds = walletTxIds;
  }
  await this.save();
};

// Instance method: Mark as failed
premiumUnlockSchema.methods.markFailed = async function(reason) {
  this.txStatus = 'failed';
  this.failedAt = new Date();
  this.metadata.failureReason = reason;
  await this.save();
};

// Instance method: Process refund
premiumUnlockSchema.methods.refund = async function(adminId, reason) {
  if (this.txStatus !== 'completed') {
    throw new Error('Can only refund completed transactions');
  }

  this.txStatus = 'refunded';
  this.metadata.refundedAt = new Date();
  this.metadata.refundedBy = adminId;
  this.metadata.refundReason = reason;
  await this.save();
};

// Static method: Find by idempotency key
premiumUnlockSchema.statics.findByIdempotencyKey = async function(key) {
  return await this.findOne({ idempotencyKey: key });
};

// Static method: Check if user already unlocked content
premiumUnlockSchema.statics.hasUnlocked = async function(userId, contentId) {
  const unlock = await this.findOne({
    userId,
    contentId,
    txStatus: 'completed'
  });
  return !!unlock;
};

// Static method: Get user's unlock history
premiumUnlockSchema.statics.getUserUnlocks = async function(userId, options = {}) {
  const {
    status,
    page = 1,
    limit = 20
  } = options;

  const query = { userId };
  if (status) query.txStatus = status;

  const skip = (page - 1) * limit;

  const [unlocks, total] = await Promise.all([
    this.find(query)
      .populate('contentId', 'title thumbnailUrl category creatorId')
      .populate('creatorId', 'username profilePhoto')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    this.countDocuments(query)
  ]);

  return {
    unlocks,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  };
};

// Static method: Get creator's unlock history (revenue)
premiumUnlockSchema.statics.getCreatorUnlocks = async function(creatorId, options = {}) {
  const {
    status = 'completed',
    page = 1,
    limit = 20,
    startDate,
    endDate
  } = options;

  const query = {
    creatorId,
    txStatus: status
  };

  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) query.createdAt.$gte = new Date(startDate);
    if (endDate) query.createdAt.$lte = new Date(endDate);
  }

  const skip = (page - 1) * limit;

  const [unlocks, total] = await Promise.all([
    this.find(query)
      .populate('userId', 'username profilePhoto')
      .populate('contentId', 'title thumbnailUrl')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    this.countDocuments(query)
  ]);

  return {
    unlocks,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  };
};

// Static method: Calculate creator revenue
premiumUnlockSchema.statics.getCreatorRevenue = async function(creatorId, options = {}) {
  const {
    startDate,
    endDate,
    status = 'completed'
  } = options;

  const matchQuery = {
    creatorId: mongoose.Types.ObjectId(creatorId),
    txStatus: status
  };

  if (startDate || endDate) {
    matchQuery.createdAt = {};
    if (startDate) matchQuery.createdAt.$gte = new Date(startDate);
    if (endDate) matchQuery.createdAt.$lte = new Date(endDate);
  }

  const result = await this.aggregate([
    { $match: matchQuery },
    {
      $group: {
        _id: null,
        totalUnlocks: { $sum: 1 },
        totalRevenue: { $sum: '$amount_coins' },
        creatorShare: { $sum: '$creator_share' },
        platformShare: { $sum: '$platform_share' },
        processingFees: { $sum: '$processing_fee' }
      }
    }
  ]);

  if (result.length === 0) {
    return {
      totalUnlocks: 0,
      totalRevenue_coins: 0,
      creatorShare_coins: 0,
      platformShare_coins: 0,
      processingFees_coins: 0,
      withdrawable_coins: 0
    };
  }

  const data = result[0];
  return {
    totalUnlocks: data.totalUnlocks,
    totalRevenue_coins: data.totalRevenue,
    creatorShare_coins: data.creatorShare,
    platformShare_coins: data.platformShare,
    processingFees_coins: data.processingFees,
    withdrawable_coins: data.creatorShare // Can be withdrawn
  };
};

// Static method: Get platform revenue summary
premiumUnlockSchema.statics.getPlatformRevenue = async function(options = {}) {
  const {
    startDate,
    endDate,
    status = 'completed'
  } = options;

  const matchQuery = { txStatus: status };

  if (startDate || endDate) {
    matchQuery.createdAt = {};
    if (startDate) matchQuery.createdAt.$gte = new Date(startDate);
    if (endDate) matchQuery.createdAt.$lte = new Date(endDate);
  }

  const result = await this.aggregate([
    { $match: matchQuery },
    {
      $group: {
        _id: null,
        totalUnlocks: { $sum: 1 },
        totalRevenue: { $sum: '$amount_coins' },
        platformShare: { $sum: '$platform_share' },
        processingFees: { $sum: '$processing_fee' },
        creatorPayouts: { $sum: '$creator_share' }
      }
    }
  ]);

  if (result.length === 0) {
    return {
      totalUnlocks: 0,
      totalRevenue_coins: 0,
      platformRevenue_coins: 0,
      processingFees_coins: 0,
      creatorPayouts_coins: 0
    };
  }

  const data = result[0];
  return {
    totalUnlocks: data.totalUnlocks,
    totalRevenue_coins: data.totalRevenue,
    platformRevenue_coins: data.platformShare + data.processingFees,
    platformShare_coins: data.platformShare,
    processingFees_coins: data.processingFees,
    creatorPayouts_coins: data.creatorPayouts
  };
};

// Static method: Get top earning creators
premiumUnlockSchema.statics.getTopCreators = async function(limit = 10, days = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const result = await this.aggregate([
    {
      $match: {
        txStatus: 'completed',
        createdAt: { $gte: startDate }
      }
    },
    {
      $group: {
        _id: '$creatorId',
        totalUnlocks: { $sum: 1 },
        totalRevenue: { $sum: '$creator_share' }
      }
    },
    {
      $sort: { totalRevenue: -1 }
    },
    {
      $limit: limit
    },
    {
      $lookup: {
        from: 'users',
        localField: '_id',
        foreignField: '_id',
        as: 'creator'
      }
    },
    {
      $unwind: '$creator'
    },
    {
      $project: {
        creatorId: '$_id',
        username: '$creator.username',
        profilePhoto: '$creator.profilePhoto',
        totalUnlocks: 1,
        totalRevenue_coins: '$totalRevenue'
      }
    }
  ]);

  return result;
};

module.exports = mongoose.model('PremiumUnlock', premiumUnlockSchema);
