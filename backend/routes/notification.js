const express = require('express');
const router = express.Router();
const Notification = require('../models/Notification');
const { authenticateToken } = require('../middleware/auth');
const { io } = require('../server');

// Get user notifications
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 20, unreadOnly = false, type } = req.query;
    
    const query = { userId: req.user.userId };
    if (unreadOnly === 'true') query.isRead = false;
    if (type) query.type = type;

    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .populate('actorId', 'username profilePhoto')
      .lean();

    const unreadCount = await Notification.countDocuments({ 
      userId: req.user.userId, 
      isRead: false 
    });

    res.json({ 
      success: true, 
      notifications, 
      unreadCount,
      page: parseInt(page),
      hasMore: notifications.length === parseInt(limit)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get unread count
router.get('/unread-count', authenticateToken, async (req, res) => {
  try {
    const count = await Notification.countDocuments({ 
      userId: req.user.userId, 
      isRead: false 
    });
    res.json({ success: true, unreadCount: count });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Mark notification as read
router.put('/:notificationId/read', authenticateToken, async (req, res) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.notificationId, userId: req.user.userId },
      { isRead: true, readAt: new Date() },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    res.json({ success: true, notification });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Mark all notifications as read
router.put('/read-all', authenticateToken, async (req, res) => {
  try {
    await Notification.updateMany(
      { userId: req.user.userId, isRead: false },
      { isRead: true, readAt: new Date() }
    );

    res.json({ success: true, message: 'All notifications marked as read' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete notification
router.delete('/:notificationId', authenticateToken, async (req, res) => {
  try {
    const notification = await Notification.findOneAndDelete({
      _id: req.params.notificationId,
      userId: req.user.userId
    });

    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    res.json({ success: true, message: 'Notification deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Helper function to create and emit notification
const createNotification = async (data) => {
  try {
    const notification = new Notification(data);
    await notification.save();
    
    // Populate actor before emitting
    await notification.populate('actorId', 'username profilePhoto');

    // Emit via Socket.io to the user
    if (io) {
      io.to(`user:${data.userId}`).emit('new-notification', {
        notification: notification.toObject(),
        unreadCount: await Notification.countDocuments({ 
          userId: data.userId, 
          isRead: false 
        })
      });
    }

    return notification;
  } catch (error) {
    console.error('Failed to create notification:', error);
    return null;
  }
};

// Test notification (dev only)
router.post('/test', authenticateToken, async (req, res) => {
  try {
    const notification = await createNotification({
      userId: req.user.userId,
      type: 'system',
      title: 'Test Notification',
      message: 'This is a test notification',
      actorId: req.user.userId
    });

    res.json({ success: true, notification });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = { router, createNotification };
