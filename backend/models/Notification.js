const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  type: {
    type: String,
    enum: [
      'follower',           // Someone followed you
      'stream_start',       // Someone you follow started streaming
      'event_reminder',     // Event starting soon
      'event_invite',       // Invited to event
      'badge_earned',       // New badge earned
      'level_up',           // Level up notification
      'gift_received',      // Received gift during stream
      'mention',            // Mentioned in content/chat
      'comment',            // New comment on content
      'like',               // Content liked
      'system'              // System announcements
    ],
    required: true
  },
  title: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  relatedId: {
    type: mongoose.Schema.Types.ObjectId,
    refPath: 'relatedModel'
  },
  relatedModel: {
    type: String,
    enum: ['User', 'LiveStream', 'Event', 'Content', 'Badge', 'Message']
  },
  actorId: {
    // Who triggered this notification (e.g., the follower, liker, etc.)
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  isRead: {
    type: Boolean,
    default: false,
    index: true
  },
  readAt: {
    type: Date
  },
  data: {
    // Additional metadata (e.g., thumbnail, icon, etc.)
    type: mongoose.Schema.Types.Mixed
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  expiresAt: {
    type: Date,
    index: true
    // Optional: auto-delete old notifications
  }
});

// Compound indexes for efficient queries
notificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, type: 1, createdAt: -1 });

// TTL index: auto-delete notifications older than 30 days
notificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Pre-save hook to set expiration (30 days)
notificationSchema.pre('save', function(next) {
  if (!this.expiresAt) {
    this.expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  }
  next();
});

module.exports = mongoose.model('Notification', notificationSchema);
