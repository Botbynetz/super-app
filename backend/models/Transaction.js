const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    enum: ['gift_sent', 'gift_received', 'boost_stream', 'earn_reward', 'purchase_coins', 'level_up'],
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  relatedId: mongoose.Schema.Types.ObjectId,
  relatedModel: String,
  description: String,
  balanceBefore: Number,
  balanceAfter: Number
}, {
  timestamps: true
});

transactionSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('Transaction', transactionSchema);
