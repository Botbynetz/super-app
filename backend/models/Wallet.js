const mongoose = require('mongoose');

const walletSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
    index: true
  },
  balance_cents: {
    type: Number,
    required: true,
    default: 0,
    min: 0,
    validate: {
      validator: Number.isInteger,
      message: 'Balance must be an integer (cents)'
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
    default: 'active',
    enum: ['active', 'frozen', 'suspended', 'closed']
  },
  version: {
    type: Number,
    default: 0
  },
  // Statistics
  totalDeposited_cents: {
    type: Number,
    default: 0
  },
  totalWithdrawn_cents: {
    type: Number,
    default: 0
  },
  totalTransferred_cents: {
    type: Number,
    default: 0
  },
  totalReceived_cents: {
    type: Number,
    default: 0
  },
  lastTransactionAt: {
    type: Date
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Indexes for performance
walletSchema.index({ userId: 1 }, { unique: true });
walletSchema.index({ status: 1 });
walletSchema.index({ updatedAt: -1 });

// Pre-save hook to update timestamp
walletSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Virtual for balance in rupiah
walletSchema.virtual('balance_rupiah').get(function() {
  return this.balance_cents / 100;
});

// Virtual for balance in coins (1 coin = 100 rupiah = 10000 cents)
walletSchema.virtual('balance_coins').get(function() {
  return Math.floor(this.balance_cents / 10000);
});

// Method to check if wallet can deduct amount
walletSchema.methods.canDeduct = function(amount_cents) {
  return this.status === 'active' && this.balance_cents >= amount_cents;
};

// Method to freeze wallet
walletSchema.methods.freeze = function(reason) {
  this.status = 'frozen';
  return this.save();
};

// Method to unfreeze wallet
walletSchema.methods.unfreeze = function() {
  this.status = 'active';
  return this.save();
};

// Static method to create or get wallet
walletSchema.statics.getOrCreate = async function(userId) {
  let wallet = await this.findOne({ userId });
  
  if (!wallet) {
    wallet = await this.create({
      userId,
      balance_cents: 0,
      currency: 'IDR',
      status: 'active'
    });
  }
  
  return wallet;
};

// Static method to update balance atomically
walletSchema.statics.updateBalanceAtomic = async function(userId, amount_cents, session = null) {
  const options = session ? { session, new: true } : { new: true };
  
  // Use findOneAndUpdate with $inc for atomic operation
  const wallet = await this.findOneAndUpdate(
    { 
      userId,
      status: 'active',
      balance_cents: { $gte: amount_cents < 0 ? Math.abs(amount_cents) : 0 }
    },
    {
      $inc: { 
        balance_cents: amount_cents,
        version: 1
      },
      $set: { 
        lastTransactionAt: new Date(),
        updatedAt: new Date()
      }
    },
    options
  );
  
  if (!wallet) {
    throw new Error('Insufficient balance or wallet not active');
  }
  
  return wallet;
};

const Wallet = mongoose.model('Wallet', walletSchema);

module.exports = Wallet;
