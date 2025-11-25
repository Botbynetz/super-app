const express = require('express');
const router = express.Router();
const LiveStream = require('../models/LiveStream');
const UserProgress = require('../models/UserProgress');
const Transaction = require('../models/Transaction');
const { authenticateToken } = require('../middleware/auth');
const crypto = require('crypto');

// Start live stream
router.post('/start', authenticateToken, async (req, res) => {
  try {
    const { title, category, description, thumbnailUrl } = req.body;
    
    if (!title || !category) {
      return res.status(400).json({ error: 'Title and category required' });
    }

    const streamKey = crypto.randomBytes(16).toString('hex');
    const rtcRoomId = crypto.randomBytes(8).toString('hex');

    const liveStream = new LiveStream({
      userId: req.user.userId,
      title,
      category,
      description,
      thumbnailUrl,
      status: 'live',
      streamKey,
      rtcRoomId,
      startedAt: new Date()
    });

    await liveStream.save();

    // Update user progress
    await UserProgress.findOneAndUpdate(
      { userId: req.user.userId },
      { 
        $inc: { 
          'stats.totalLiveStreams': 1,
          experiencePoints: 10
        }
      },
      { upsert: true }
    );

    res.json({
      success: true,
      stream: {
        streamId: liveStream._id,
        streamKey,
        rtcRoomId,
        title,
        category
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Stop live stream
router.post('/stop/:streamId', authenticateToken, async (req, res) => {
  try {
    const liveStream = await LiveStream.findOne({
      _id: req.params.streamId,
      userId: req.user.userId,
      status: 'live'
    });

    if (!liveStream) {
      return res.status(404).json({ error: 'Live stream not found' });
    }

    const endedAt = new Date();
    const duration = Math.floor((endedAt - liveStream.startedAt) / 1000);

    liveStream.status = 'ended';
    liveStream.endedAt = endedAt;
    liveStream.duration = duration;
    await liveStream.save();

    // Award coins based on performance
    const coinReward = Math.floor(liveStream.peakViewerCount * 0.5 + liveStream.totalGiftsReceived * 0.1);
    
    await UserProgress.findOneAndUpdate(
      { userId: req.user.userId },
      { 
        $inc: { 
          coins: coinReward,
          experiencePoints: Math.floor(duration / 60)
        }
      }
    );

    if (coinReward > 0) {
      await new Transaction({
        userId: req.user.userId,
        type: 'earn_reward',
        amount: coinReward,
        relatedId: liveStream._id,
        relatedModel: 'LiveStream',
        description: 'Live stream reward'
      }).save();
    }

    res.json({
      success: true,
      stats: {
        duration,
        peakViewerCount: liveStream.peakViewerCount,
        totalGifts: liveStream.totalGiftsReceived,
        coinReward
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get live streams (active & boosted first)
router.get('/list', async (req, res) => {
  try {
    const { category, status = 'live', page = 1, limit = 20 } = req.query;
    
    const query = { status };
    if (category) query.category = category;

    const streams = await LiveStream.find(query)
      .sort({ isBoosted: -1, viewerCount: -1, startedAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .populate('userId', 'name username profilePicture')
      .lean();

    res.json({ success: true, streams });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get featured live streams (for Home screen highlights)
router.get('/featured', async (req, res) => {
  try {
    const { limit = 5 } = req.query;
    
    // Prioritize: boosted > high viewers > recently started
    const featuredStreams = await LiveStream.find({ status: 'live' })
      .sort({ isBoosted: -1, viewerCount: -1, startedAt: -1 })
      .limit(parseInt(limit))
      .populate('userId', 'username profilePhoto')
      .select('title category viewerCount isBoosted thumbnailUrl userId startedAt')
      .lean();

    res.json({ success: true, streams: featuredStreams });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get stream details
router.get('/:streamId', async (req, res) => {
  try {
    const stream = await LiveStream.findById(req.params.streamId)
      .populate('userId', 'name username profilePicture');

    if (!stream) {
      return res.status(404).json({ error: 'Stream not found' });
    }

    res.json({ success: true, stream });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Join stream (viewer)
router.post('/:streamId/join', authenticateToken, async (req, res) => {
  try {
    const stream = await LiveStream.findById(req.params.streamId);
    
    if (!stream || stream.status !== 'live') {
      return res.status(404).json({ error: 'Stream not available' });
    }

    const alreadyViewing = stream.viewers.some(v => 
      v.userId.toString() === req.user.userId && !v.leftAt
    );

    if (!alreadyViewing) {
      stream.viewers.push({
        userId: req.user.userId,
        joinedAt: new Date()
      });
      stream.viewerCount += 1;
      if (stream.viewerCount > stream.peakViewerCount) {
        stream.peakViewerCount = stream.viewerCount;
      }
      await stream.save();
    }

    res.json({ success: true, rtcRoomId: stream.rtcRoomId });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Leave stream
router.post('/:streamId/leave', authenticateToken, async (req, res) => {
  try {
    const stream = await LiveStream.findById(req.params.streamId);
    
    if (!stream) {
      return res.status(404).json({ error: 'Stream not found' });
    }

    const viewer = stream.viewers.find(v => 
      v.userId.toString() === req.user.userId && !v.leftAt
    );

    if (viewer) {
      viewer.leftAt = new Date();
      stream.viewerCount = Math.max(0, stream.viewerCount - 1);
      await stream.save();
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Send gift
router.post('/:streamId/gift', authenticateToken, async (req, res) => {
  try {
    const { giftType, coinValue } = req.body;
    
    if (!giftType || !coinValue || coinValue <= 0) {
      return res.status(400).json({ error: 'Invalid gift data' });
    }

    const stream = await LiveStream.findById(req.params.streamId);
    if (!stream || stream.status !== 'live') {
      return res.status(404).json({ error: 'Stream not available' });
    }

    // Transaction lock: Use findOneAndUpdate with atomic operations to prevent double-spend
    const userProgress = await UserProgress.findOneAndUpdate(
      { 
        userId: req.user.userId,
        coins: { $gte: coinValue } // Ensure sufficient coins atomically
      },
      { 
        $inc: { 
          coins: -coinValue,
          'stats.totalGiftsSent': coinValue
        }
      },
      { new: true }
    );

    if (!userProgress) {
      return res.status(400).json({ error: 'Insufficient coins or user not found' });
    }

    await new Transaction({
      userId: req.user.userId,
      type: 'gift_sent',
      amount: -coinValue,
      relatedId: stream._id,
      relatedModel: 'LiveStream',
      description: `Gift sent: ${giftType}`
    }).save();

    // Add coins to streamer (atomic operation)
    const streamerProgress = await UserProgress.findOneAndUpdate(
      { userId: stream.userId },
      { 
        $inc: { 
          coins: coinValue,
          'stats.totalGiftsReceived': coinValue,
          experiencePoints: Math.floor(coinValue * 0.5)
        }
      },
      { upsert: true, new: true }
    );

    await new Transaction({
      userId: stream.userId,
      type: 'gift_received',
      amount: coinValue,
      relatedId: stream._id,
      relatedModel: 'LiveStream',
      description: `Gift received: ${giftType}`
    }).save();

    // Update stream
    stream.gifts.push({
      fromUserId: req.user.userId,
      giftType,
      coinValue,
      timestamp: new Date()
    });
    stream.totalGiftsReceived += coinValue;
    await stream.save();

    // Send notification to streamer
    const { createNotification } = require('./notification');
    await createNotification({
      userId: stream.userId,
      type: 'gift_received',
      title: 'Gift Received!',
      message: `You received a ${giftType} gift worth ${coinValue} coins!`,
      relatedId: stream._id,
      relatedModel: 'LiveStream',
      actorId: req.user.userId,
      data: {
        giftType,
        coinValue
      }
    });

    // Emit leaderboard update for streamer
    const { io } = require('../server');
    if (io) {
      io.emit('leaderboard-change', {
        userId: stream.userId,
        level: streamerProgress.level,
        experiencePoints: streamerProgress.experiencePoints,
        coins: streamerProgress.coins,
        timestamp: Date.now()
      });
    }

    res.json({ success: true, remainingCoins: userProgress.coins });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Boost stream (paid promotion)
router.post('/:streamId/boost', authenticateToken, async (req, res) => {
  try {
    const { duration = 60 } = req.body; // duration in minutes
    const coinCost = duration * 10;

    const stream = await LiveStream.findOne({
      _id: req.params.streamId,
      userId: req.user.userId,
      status: 'live'
    });

    if (!stream) {
      return res.status(404).json({ error: 'Stream not found' });
    }

    // Atomic transaction to prevent double-spend
    const userProgress = await UserProgress.findOneAndUpdate(
      { 
        userId: req.user.userId,
        coins: { $gte: coinCost }
      },
      { $inc: { coins: -coinCost } },
      { new: true }
    );

    if (!userProgress) {
      return res.status(400).json({ error: 'Insufficient coins or user not found' });
    }

    await new Transaction({
      userId: req.user.userId,
      type: 'boost_stream',
      amount: -coinCost,
      relatedId: stream._id,
      relatedModel: 'LiveStream',
      description: `Boosted stream for ${duration} minutes`
    }).save();

    stream.isBoosted = true;
    stream.boostExpiresAt = new Date(Date.now() + duration * 60 * 1000);
    await stream.save();

    res.json({ 
      success: true, 
      boostExpiresAt: stream.boostExpiresAt,
      remainingCoins: userProgress.coins 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get user's stream history
router.get('/user/:userId/history', async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    
    const streams = await LiveStream.find({
      userId: req.params.userId,
      status: 'ended'
    })
      .sort({ endedAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .select('-streamKey -rtcRoomId')
      .lean();

    res.json({ success: true, streams });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
