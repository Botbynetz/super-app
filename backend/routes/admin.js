const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Event = require('../models/Event');
const jwt = require('jsonwebtoken');

const adminAuth = (req, res, next) => {
  try {
    const token = req.header('Authorization').replace('Bearer ', '');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch (error) {
    res.status(401).json({ message: 'Please authenticate' });
  }
};

router.get('/users', adminAuth, async (req, res) => {
  try {
    const users = await User.find()
      .select('-otp -otpExpiry')
      .sort({ createdAt: -1 });
    res.json({ users, total: users.length });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/events', adminAuth, async (req, res) => {
  try {
    const events = await Event.find()
      .populate('userId', 'username profilePhoto')
      .sort({ createdAt: -1 });
    res.json({ events, total: events.length });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/stats', adminAuth, async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalEvents = await Event.countDocuments();
    const usersByCategory = await User.aggregate([
      { $group: { _id: '$category', count: { $sum: 1 } } }
    ]);

    res.json({ 
      totalUsers,
      totalEvents,
      usersByCategory
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
