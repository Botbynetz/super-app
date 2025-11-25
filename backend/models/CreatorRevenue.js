const mongoose = require('mongoose');

const creatorRevenueSchema = new mongoose.Schema({
  creatorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
    index: true
  },
  balance: {
    available_coins: {
      type: Number,
      default: 0,
      min: 0
    },
    pending_coins: {
      type: Number,
      default: 0,
      min: 0
    },
    withdrawn_coins: {
      type: Number,
      default: 0,
      min: 0
    }
  },
  lifetime: {
    total_earned_coins: {
      type: Number,
      default: 0,
      min: 0
    },
    total_unlocks: {
      type: Number,
      default: 0,
      min: 0
    },
    total_subscribers: {
      type: Number,
      default: 0,
      min: 0
    }
  },
  monthly: {
    current_month_earnings: {
      type: Number,
      default: 0
    },
    last_month_earnings: {
      type: Number,
      default: 0
    },
    month_year: String // Format: "2025-11"
  },
  withdrawals: [{
    amount_coins: Number,
    amount_cents: Number,
    walletTxId: String,
    withdrawnAt: Date,
    status: {
      type: String,
      enum: ['pending', 'completed', 'failed']
    }
  }],
  paymentInfo: {
    verified: {
      type: Boolean,
      default: false
    },
    bankName: String,
    accountNumber: String,
    accountName: String,
    taxId: String
  },
  settings: {
    autoWithdrawThreshold_coins: {
      type: Number,
      default: 1000 // Auto withdraw when reaching 1000 coins
    },
    autoWithdrawEnabled: {
      type: Boolean,
      default: false
    },
    notifyOnEarnings: {
      type: Boolean,
      default: true
    }
  }
}, {
  timestamps: true
});

// Indexes
creatorRevenueSchema.index({ 'balance.available_coins': -1 });
creatorRevenueSchema.index({ 'lifetime.total_earned_coins': -1 });
creatorRevenueSchema.index({ 'monthly.month_year': 1 });

// Virtual for total balance
creatorRevenueSchema.virtual('total_balance_coins').get(function() {
  return this.balance.available_coins + this.balance.pending_coins;
});

// Virtual for withdrawable in rupiah
creatorRevenueSchema.virtual('withdrawable_rupiah').get(function() {
  return this.balance.available_coins * 100; // 1 coin = 100 rupiah
});

// Instance method: Add earnings from unlock
creatorRevenueSchema.methods.addEarnings = async function(amount_coins, isPending = false) {
  if (isPending) {
    this.balance.pending_coins += amount_coins;
  } else {
    this.balance.available_coins += amount_coins;
  }
  
  this.lifetime.total_earned_coins += amount_coins;
  this.lifetime.total_unlocks += 1;

  // Update monthly earnings
  const monthYear = new Date().toISOString().slice(0, 7); // "2025-11"
  if (this.monthly.month_year === monthYear) {
    this.monthly.current_month_earnings += amount_coins;
  } else {
    this.monthly.last_month_earnings = this.monthly.current_month_earnings;
    this.monthly.current_month_earnings = amount_coins;
    this.monthly.month_year = monthYear;
  }

  await this.save();
};

// Instance method: Move from pending to available
creatorRevenueSchema.methods.releasePending = async function(amount_coins) {
  if (this.balance.pending_coins < amount_coins) {
    throw new Error('Insufficient pending balance');
  }

  this.balance.pending_coins -= amount_coins;
  this.balance.available_coins += amount_coins;
  await this.save();
};

// Instance method: Record withdrawal
creatorRevenueSchema.methods.withdraw = async function(amount_coins, walletTxId) {
  if (this.balance.available_coins < amount_coins) {
    throw new Error('Insufficient available balance');
  }

  if (!this.paymentInfo.verified) {
    throw new Error('Payment information not verified. Please complete KYC.');
  }

  this.balance.available_coins -= amount_coins;
  this.balance.withdrawn_coins += amount_coins;

  this.withdrawals.push({
    amount_coins,
    amount_cents: amount_coins * 10000,
    walletTxId,
    withdrawnAt: new Date(),
    status: 'pending'
  });

  await this.save();
  return this.withdrawals[this.withdrawals.length - 1];
};

// Instance method: Update withdrawal status
creatorRevenueSchema.methods.updateWithdrawalStatus = async function(walletTxId, status) {
  const withdrawal = this.withdrawals.find(w => w.walletTxId === walletTxId);
  if (!withdrawal) {
    throw new Error('Withdrawal not found');
  }

  withdrawal.status = status;
  await this.save();
  return withdrawal;
};

// Instance method: Set payment info
creatorRevenueSchema.methods.setPaymentInfo = async function(paymentInfo) {
  this.paymentInfo = {
    ...this.paymentInfo,
    ...paymentInfo,
    verified: false // Requires admin verification
  };
  await this.save();
};

// Instance method: Verify payment info (admin)
creatorRevenueSchema.methods.verifyPaymentInfo = async function() {
  if (!this.paymentInfo.bankName || !this.paymentInfo.accountNumber || !this.paymentInfo.accountName) {
    throw new Error('Incomplete payment information');
  }
  this.paymentInfo.verified = true;
  await this.save();
};

// Static method: Get or create revenue account
creatorRevenueSchema.statics.getOrCreate = async function(creatorId) {
  let revenue = await this.findOne({ creatorId });
  
  if (!revenue) {
    revenue = await this.create({
      creatorId,
      balance: {
        available_coins: 0,
        pending_coins: 0,
        withdrawn_coins: 0
      },
      lifetime: {
        total_earned_coins: 0,
        total_unlocks: 0,
        total_subscribers: 0
      },
      monthly: {
        current_month_earnings: 0,
        last_month_earnings: 0,
        month_year: new Date().toISOString().slice(0, 7)
      }
    });
  }

  return revenue;
};

// Static method: Get top earners
creatorRevenueSchema.statics.getTopEarners = async function(limit = 10, period = 'lifetime') {
  let sortField;
  
  switch (period) {
    case 'month':
      sortField = 'monthly.current_month_earnings';
      break;
    case 'lifetime':
    default:
      sortField = 'lifetime.total_earned_coins';
      break;
  }

  const sort = {};
  sort[sortField] = -1;

  return await this.find({})
    .populate('creatorId', 'username profilePhoto category')
    .sort(sort)
    .limit(limit)
    .lean();
};

// Static method: Get creators pending verification
creatorRevenueSchema.statics.getPendingVerification = async function() {
  return await this.find({
    'paymentInfo.verified': false,
    'paymentInfo.bankName': { $exists: true, $ne: null }
  })
    .populate('creatorId', 'username email profilePhoto')
    .lean();
};

// Static method: Get creators eligible for auto-withdraw
creatorRevenueSchema.statics.getAutoWithdrawEligible = async function() {
  return await this.find({
    'settings.autoWithdrawEnabled': true,
    'paymentInfo.verified': true,
    $expr: {
      $gte: ['$balance.available_coins', '$settings.autoWithdrawThreshold_coins']
    }
  })
    .populate('creatorId', 'username email')
    .lean();
};

// Static method: Reset monthly earnings (run at start of each month)
creatorRevenueSchema.statics.resetMonthlyEarnings = async function() {
  const monthYear = new Date().toISOString().slice(0, 7);
  
  await this.updateMany(
    { 'monthly.month_year': { $ne: monthYear } },
    {
      $set: {
        'monthly.last_month_earnings': '$monthly.current_month_earnings',
        'monthly.current_month_earnings': 0,
        'monthly.month_year': monthYear
      }
    }
  );
};

module.exports = mongoose.model('CreatorRevenue', creatorRevenueSchema);
