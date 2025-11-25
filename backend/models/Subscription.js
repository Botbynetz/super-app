const mongoose = require('mongoose');

const subscriptionSchema = new mongoose.Schema({
  subscriberId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  creatorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  tier: {
    type: String,
    enum: ['monthly', 'quarterly', 'yearly'],
    required: true,
    default: 'monthly'
  },
  price_coins: {
    type: Number,
    required: true,
    min: 1,
    validate: {
      validator: Number.isInteger,
      message: 'Price must be an integer'
    }
  },
  startedAt: {
    type: Date,
    required: true,
    default: Date.now
  },
  expiresAt: {
    type: Date,
    required: true,
    index: true
  },
  status: {
    type: String,
    enum: ['active', 'expired', 'cancelled', 'suspended'],
    default: 'active',
    index: true
  },
  autoRenew: {
    type: Boolean,
    default: false
  },
  benefits: {
    type: [String],
    default: ['Access to subscriber-only content', 'Early access to new content', 'Exclusive updates']
  },
  metadata: {
    renewalCount: {
      type: Number,
      default: 0
    },
    totalSpent_coins: {
      type: Number,
      default: 0
    },
    cancelledAt: Date,
    cancelReason: String
  }
}, {
  timestamps: true
});

// Compound indexes
subscriptionSchema.index({ subscriberId: 1, creatorId: 1, status: 1 });
subscriptionSchema.index({ creatorId: 1, status: 1, expiresAt: -1 });
subscriptionSchema.index({ expiresAt: 1, status: 1 }); // For expiry checks

// Virtual for days remaining
subscriptionSchema.virtual('daysRemaining').get(function() {
  if (this.status !== 'active') return 0;
  const now = new Date();
  const diff = this.expiresAt - now;
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
});

// Virtual for is expired
subscriptionSchema.virtual('isExpired').get(function() {
  return this.status === 'active' && new Date() > this.expiresAt;
});

// Instance method: Check if subscription is valid
subscriptionSchema.methods.isValid = function() {
  return this.status === 'active' && new Date() < this.expiresAt;
};

// Instance method: Cancel subscription
subscriptionSchema.methods.cancel = async function(reason = 'User requested') {
  this.status = 'cancelled';
  this.autoRenew = false;
  this.metadata.cancelledAt = new Date();
  this.metadata.cancelReason = reason;
  await this.save();
};

// Instance method: Suspend subscription (admin action)
subscriptionSchema.methods.suspend = async function(reason) {
  this.status = 'suspended';
  this.metadata.cancelReason = reason;
  await this.save();
};

// Instance method: Reactivate subscription
subscriptionSchema.methods.reactivate = async function() {
  if (this.isExpired) {
    throw new Error('Cannot reactivate expired subscription. Please renew.');
  }
  this.status = 'active';
  await this.save();
};

// Instance method: Renew subscription
subscriptionSchema.methods.renew = async function() {
  const duration = this.getTierDuration();
  const newExpiry = new Date(this.expiresAt);
  newExpiry.setDate(newExpiry.getDate() + duration);
  
  this.expiresAt = newExpiry;
  this.status = 'active';
  this.metadata.renewalCount += 1;
  this.metadata.totalSpent_coins += this.price_coins;
  await this.save();
};

// Instance method: Get tier duration in days
subscriptionSchema.methods.getTierDuration = function() {
  switch (this.tier) {
    case 'monthly':
      return 30;
    case 'quarterly':
      return 90;
    case 'yearly':
      return 365;
    default:
      return 30;
  }
};

// Static method: Get active subscription between subscriber and creator
subscriptionSchema.statics.getActiveSubscription = async function(subscriberId, creatorId) {
  return await this.findOne({
    subscriberId,
    creatorId,
    status: 'active',
    expiresAt: { $gt: new Date() }
  });
};

// Static method: Check if user is subscribed to creator
subscriptionSchema.statics.isSubscribed = async function(subscriberId, creatorId) {
  const subscription = await this.getActiveSubscription(subscriberId, creatorId);
  return !!subscription;
};

// Static method: Get user's subscriptions
subscriptionSchema.statics.getUserSubscriptions = async function(subscriberId, options = {}) {
  const {
    status = 'active',
    page = 1,
    limit = 20
  } = options;

  const query = { subscriberId };
  if (status) query.status = status;

  const skip = (page - 1) * limit;

  const [subscriptions, total] = await Promise.all([
    this.find(query)
      .populate('creatorId', 'username profilePhoto category bio')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    this.countDocuments(query)
  ]);

  return {
    subscriptions,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  };
};

// Static method: Get creator's subscribers
subscriptionSchema.statics.getCreatorSubscribers = async function(creatorId, options = {}) {
  const {
    status = 'active',
    page = 1,
    limit = 20
  } = options;

  const query = { creatorId };
  if (status) query.status = status;

  const skip = (page - 1) * limit;

  const [subscriptions, total] = await Promise.all([
    this.find(query)
      .populate('subscriberId', 'username profilePhoto email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    this.countDocuments(query)
  ]);

  return {
    subscriptions,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  };
};

// Static method: Get subscriptions expiring soon (for renewal reminders)
subscriptionSchema.statics.getExpiringSoon = async function(daysThreshold = 7) {
  const now = new Date();
  const threshold = new Date(now.getTime() + daysThreshold * 24 * 60 * 60 * 1000);

  return await this.find({
    status: 'active',
    expiresAt: {
      $gt: now,
      $lte: threshold
    }
  })
    .populate('subscriberId', 'username email')
    .populate('creatorId', 'username')
    .lean();
};

// Static method: Mark expired subscriptions
subscriptionSchema.statics.markExpired = async function() {
  const result = await this.updateMany(
    {
      status: 'active',
      expiresAt: { $lte: new Date() }
    },
    {
      $set: { status: 'expired' }
    }
  );

  return result.modifiedCount;
};

// Static method: Get subscription statistics for creator
subscriptionSchema.statics.getCreatorStats = async function(creatorId) {
  const [active, total, revenue] = await Promise.all([
    this.countDocuments({ creatorId, status: 'active' }),
    this.countDocuments({ creatorId }),
    this.aggregate([
      {
        $match: {
          creatorId: mongoose.Types.ObjectId(creatorId),
          status: { $in: ['active', 'expired'] }
        }
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$metadata.totalSpent_coins' },
          avgPrice: { $avg: '$price_coins' }
        }
      }
    ])
  ]);

  return {
    activeSubscribers: active,
    totalSubscribers: total,
    totalRevenue_coins: revenue[0]?.totalRevenue || 0,
    averagePrice_coins: Math.round(revenue[0]?.avgPrice || 0)
  };
};

module.exports = mongoose.model('Subscription', subscriptionSchema);
