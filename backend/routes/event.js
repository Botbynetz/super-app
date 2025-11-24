const express = require('express');
const router = express.Router();
const Event = require('../models/Event');
const jwt = require('jsonwebtoken');

const auth = (req, res, next) => {
  try {
    const token = req.header('Authorization').replace('Bearer ', '');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch (error) {
    res.status(401).json({ message: 'Please authenticate' });
  }
};

router.post('/create', auth, async (req, res) => {
  try {
    const { title, description, date } = req.body;
    const userId = req.userId;

    const event = new Event({
      userId,
      title,
      description,
      date: new Date(date)
    });

    await event.save();

    res.json({ success: true, event });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/user/:userId', async (req, res) => {
  try {
    const events = await Event.find({ userId: req.params.userId })
      .sort({ date: 1 })
      .populate('userId', 'username profilePhoto');
    res.json({ events });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/all', async (req, res) => {
  try {
    const events = await Event.find()
      .sort({ date: 1 })
      .populate('userId', 'username profilePhoto');
    res.json({ events });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
