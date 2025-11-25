const mongoose = require('mongoose');
const validator = require('validator');

const messageSchema = new mongoose.Schema({
  chatId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Chat',
    required: true
  },
  senderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  text: {
    type: String,
    required: true,
    validate: {
      validator: function(v) {
        return validator.escape(v).length <= 1000;
      },
      message: 'Message too long or contains invalid characters'
    }
  },
  isRead: {
    type: Boolean,
    default: false
  },
  readBy: [{
    userId: mongoose.Schema.Types.ObjectId,
    readAt: Date
  }],
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Message', messageSchema);
