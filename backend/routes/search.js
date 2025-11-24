const express = require('express');
const router = express.Router();
const Event = require('../models/Event');
const Content = require('../models/Content');

router.get('/', async (req, res) => {
  try {
    const { q } = req.query;

    if (!q) {
      return res.status(400).json({ message: 'Query parameter required' });
    }

    const eventResults = await Event.find({
      $or: [
        { title: { $regex: q, $options: 'i' } },
        { description: { $regex: q, $options: 'i' } }
      ]
    }).populate('userId', 'username profilePhoto');

    const contentResults = await Content.find({
      caption: { $regex: q, $options: 'i' }
    }).populate('userId', 'username profilePhoto');

    res.json({ 
      events: eventResults,
      contents: contentResults
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
