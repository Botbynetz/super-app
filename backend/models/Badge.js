const mongoose = require('mongoose');

const badgeSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true
  },
  description: String,
  iconUrl: String,
  type: {
    type: String,
    enum: ['skill', 'live', 'event', 'achievement', 'special'],
    required: true
  },
  criteria: {
    type: String,
    required: true
  },
  requiredValue: Number,
  rarity: {
    type: String,
    enum: ['common', 'rare', 'epic', 'legendary'],
    default: 'common'
  },
  coinReward: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Badge', badgeSchema);
