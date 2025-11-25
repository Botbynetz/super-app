const mongoose = require('mongoose');

const financialReportSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  month: {
    type: Number, // 1-12
    required: true
  },
  year: {
    type: Number,
    required: true
  },
  income: {
    liveStreamGifts: { type: Number, default: 0 },
    boostRevenue: { type: Number, default: 0 },
    premiumContent: { type: Number, default: 0 },
    marketplace: { type: Number, default: 0 },
    affiliate: { type: Number, default: 0 },
    freelanceJobs: { type: Number, default: 0 },
    other: { type: Number, default: 0 },
    total: { type: Number, default: 0 }
  },
  expenses: {
    giftsSent: { type: Number, default: 0 },
    boostPurchases: { type: Number, default: 0 },
    premiumSubscriptions: { type: Number, default: 0 },
    marketplacePurchases: { type: Number, default: 0 },
    platformFees: { type: Number, default: 0 },
    other: { type: Number, default: 0 },
    total: { type: Number, default: 0 }
  },
  netBalance: { type: Number, default: 0 },
  targets: {
    incomeTarget: { type: Number, default: 0 },
    expenseLimit: { type: Number, default: 0 }
  },
  insights: {
    topIncomeSource: String,
    topExpenseCategory: String,
    savingsRate: Number, // percentage
    growthRate: Number, // percentage compared to last month
    recommendations: [String]
  },
  isGenerated: { type: Boolean, default: false }
}, {
  timestamps: true
});

// Compound index for unique month/year per user
financialReportSchema.index({ userId: 1, month: 1, year: 1 }, { unique: true });

module.exports = mongoose.model('FinancialReport', financialReportSchema);
