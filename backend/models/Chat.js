const mongoose = require('mongoose');

const chatSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['private', 'group'],
    required: true
  },
  participants: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    unreadCount: {
      type: Number,
      default: 0
    },
    lastSeen: Date
  }],
  groupName: {
    type: String
  },
  lastMessage: {
    text: String,
    senderId: mongoose.Schema.Types.ObjectId,
    timestamp: Date
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Chat', chatSchema);
