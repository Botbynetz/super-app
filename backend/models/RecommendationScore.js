const mongoose = require('mongoose');

const recommendationScoreSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  itemId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    index: true
  },
  itemType: {
    type: String,
    enum: ['event', 'livestream', 'content', 'user', 'freelancer'],
    required: true
  },
  score: {
    type: Number,
    required: true,
    min: 0,
    max: 100
  },
  factors: {
    skillMatch: { type: Number, default: 0 },
    interestMatch: { type: Number, default: 0 },
    historyMatch: { type: Number, default: 0 },
    popularityScore: { type: Number, default: 0 },
    recencyScore: { type: Number, default: 0 },
    socialScore: { type: Number, default: 0 }
  },
  isShown: {
    type: Boolean,
    default: false
  },
  isInteracted: {
    type: Boolean,
    default: false
  },
  expiresAt: {
    type: Date,
    index: true
  }
}, {
  timestamps: true
});

// Compound index for efficient querying
recommendationScoreSchema.index({ userId: 1, itemType: 1, score: -1 });
recommendationScoreSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL index

const userPreferenceSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
    index: true
  },
  interests: [String], // e.g., ['coding', 'design', 'trading']
  preferredEventTypes: [String],
  preferredContentTypes: [String],
  preferredStreamCategories: [String],
  interactionHistory: {
    viewedEvents: [{ eventId: mongoose.Schema.Types.ObjectId, viewedAt: Date }],
    joinedEvents: [{ eventId: mongoose.Schema.Types.ObjectId, joinedAt: Date }],
    watchedStreams: [{ streamId: mongoose.Schema.Types.ObjectId, watchedAt: Date, duration: Number }],
    likedContent: [{ contentId: mongoose.Schema.Types.ObjectId, likedAt: Date }],
    followedUsers: [{ userId: mongoose.Schema.Types.ObjectId, followedAt: Date }]
  },
  lastUpdated: Date
}, {
  timestamps: true
});

const RecommendationScore = mongoose.model('RecommendationScore', recommendationScoreSchema);
const UserPreference = mongoose.model('UserPreference', userPreferenceSchema);

module.exports = { RecommendationScore, UserPreference };
