const mongoose = require('mongoose');

const userProgressSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  level: {
    type: Number,
    default: 1
  },
  experiencePoints: {
    type: Number,
    default: 0
  },
  coins: {
    type: Number,
    default: 0
  },
  badges: [{
    badgeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Badge'
    },
    earnedAt: Date
  }],
  stats: {
    totalLiveStreams: { type: Number, default: 0 },
    totalViewers: { type: Number, default: 0 },
    totalGiftsReceived: { type: Number, default: 0 },
    totalGiftsSent: { type: Number, default: 0 },
    totalEventsJoined: { type: Number, default: 0 },
    totalContentsCreated: { type: Number, default: 0 },
    totalLikes: { type: Number, default: 0 }
  },
  achievements: [{
    type: String,
    timestamp: Date
  }]
}, {
  timestamps: true
});

userProgressSchema.index({ level: -1, experiencePoints: -1 });
userProgressSchema.index({ 'stats.totalViewers': -1 });

module.exports = mongoose.model('UserProgress', userProgressSchema);
