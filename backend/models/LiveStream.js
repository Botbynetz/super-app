const mongoose = require('mongoose');

const liveStreamSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  title: {
    type: String,
    required: true
  },
  category: {
    type: String,
    required: true,
    enum: ['coding', 'design', 'trading', 'gaming', 'music', 'art', 'education', 'lifestyle', 'other']
  },
  description: String,
  thumbnailUrl: String,
  status: {
    type: String,
    enum: ['scheduled', 'live', 'ended'],
    default: 'scheduled'
  },
  viewerCount: {
    type: Number,
    default: 0
  },
  peakViewerCount: {
    type: Number,
    default: 0
  },
  likeCount: {
    type: Number,
    default: 0
  },
  totalGiftsReceived: {
    type: Number,
    default: 0
  },
  isBoosted: {
    type: Boolean,
    default: false
  },
  boostExpiresAt: Date,
  streamKey: String,
  rtcRoomId: String,
  startedAt: Date,
  endedAt: Date,
  duration: Number, // in seconds
  viewers: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    joinedAt: Date,
    leftAt: Date
  }],
  gifts: [{
    fromUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    giftType: String,
    coinValue: Number,
    timestamp: Date
  }]
}, {
  timestamps: true
});

liveStreamSchema.index({ status: 1, startedAt: -1 });
liveStreamSchema.index({ userId: 1, status: 1 });
liveStreamSchema.index({ isBoosted: 1, viewerCount: -1 });

module.exports = mongoose.model('LiveStream', liveStreamSchema);
