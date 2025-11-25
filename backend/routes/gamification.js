const express = require('express');
const router = express.Router();
const Badge = require('../models/Badge');
const UserProgress = require('../models/UserProgress');
const Transaction = require('../models/Transaction');
const { authenticateToken } = require('../middleware/auth');
const { createNotification } = require('./notification');
const { io } = require('../server');

// Get user progress
router.get('/progress/:userId', async (req, res) => {
  try {
    let progress = await UserProgress.findOne({ userId: req.params.userId })
      .populate('badges.badgeId');
    
    if (!progress) {
      progress = await UserProgress.create({ userId: req.params.userId });
    }

    // Calculate level progress
    const expForNextLevel = progress.level * 100;
    const levelProgress = (progress.experiencePoints % expForNextLevel) / expForNextLevel * 100;

    res.json({
      success: true,
      progress: {
        ...progress.toObject(),
        expForNextLevel,
        levelProgress
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get leaderboard
router.get('/leaderboard', async (req, res) => {
  try {
    const { type = 'level', page = 1, limit = 50 } = req.query;
    
    let sortField = {};
    switch (type) {
      case 'level':
        sortField = { level: -1, experiencePoints: -1 };
        break;
      case 'viewers':
        sortField = { 'stats.totalViewers': -1 };
        break;
      case 'streamer':
        sortField = { 'stats.totalLiveStreams': -1, 'stats.totalViewers': -1 };
        break;
      case 'gifter':
        sortField = { 'stats.totalGiftsSent': -1 };
        break;
      default:
        sortField = { level: -1 };
    }

    const leaderboard = await UserProgress.find()
      .sort(sortField)
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .populate('userId', 'name username profilePicture')
      .lean();

    res.json({ success: true, leaderboard, type });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all badges
router.get('/badges', async (req, res) => {
  try {
    const { type } = req.query;
    const query = type ? { type } : {};
    
    const badges = await Badge.find(query).sort({ rarity: -1, createdAt: -1 });
    res.json({ success: true, badges });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Award badge (manual or auto check)
router.post('/award-badge', authenticateToken, async (req, res) => {
  try {
    const { badgeId, userId } = req.body;
    
    const badge = await Badge.findById(badgeId);
    if (!badge) {
      return res.status(404).json({ error: 'Badge not found' });
    }

    const progress = await UserProgress.findOne({ userId: userId || req.user.userId });
    if (!progress) {
      return res.status(404).json({ error: 'User progress not found' });
    }

    const alreadyHas = progress.badges.some(b => b.badgeId.toString() === badgeId);
    if (alreadyHas) {
      return res.status(400).json({ error: 'Badge already earned' });
    }

    progress.badges.push({
      badgeId: badge._id,
      earnedAt: new Date()
    });

    if (badge.coinReward > 0) {
      progress.coins += badge.coinReward;
      await new Transaction({
        userId: progress.userId,
        type: 'earn_reward',
        amount: badge.coinReward,
        relatedId: badge._id,
        relatedModel: 'Badge',
        description: `Badge earned: ${badge.name}`
      }).save();
    }

    progress.experiencePoints += 50;
    await progress.save();

    // Send notification
    await createNotification({
      userId: progress.userId,
      type: 'badge_earned',
      title: 'New Badge Earned!',
      message: `You've earned the "${badge.name}" badge!`,
      relatedId: badge._id,
      relatedModel: 'Badge',
      data: {
        badgeIcon: badge.iconUrl,
        coinReward: badge.coinReward
      }
    });

    // Emit leaderboard update
    if (io) {
      io.emit('leaderboard-change', {
        userId: progress.userId,
        level: progress.level,
        experiencePoints: progress.experiencePoints,
        coins: progress.coins,
        timestamp: Date.now()
      });
    }

    res.json({ 
      success: true, 
      badge: {
        ...badge.toObject(),
        earnedAt: new Date()
      },
      coinReward: badge.coinReward
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Check and auto-award badges
router.post('/check-badges/:userId', async (req, res) => {
  try {
    const progress = await UserProgress.findOne({ userId: req.params.userId });
    if (!progress) {
      return res.status(404).json({ error: 'User progress not found' });
    }

    const allBadges = await Badge.find();
    const newBadges = [];

    for (const badge of allBadges) {
      const alreadyHas = progress.badges.some(b => b.badgeId.toString() === badge._id.toString());
      if (alreadyHas) continue;

      let earned = false;

      // Check criteria
      switch (badge.criteria) {
        case 'total_live_streams':
          earned = progress.stats.totalLiveStreams >= badge.requiredValue;
          break;
        case 'total_viewers':
          earned = progress.stats.totalViewers >= badge.requiredValue;
          break;
        case 'total_gifts_received':
          earned = progress.stats.totalGiftsReceived >= badge.requiredValue;
          break;
        case 'total_events_joined':
          earned = progress.stats.totalEventsJoined >= badge.requiredValue;
          break;
        case 'level':
          earned = progress.level >= badge.requiredValue;
          break;
      }

      if (earned) {
        progress.badges.push({
          badgeId: badge._id,
          earnedAt: new Date()
        });

        if (badge.coinReward > 0) {
          progress.coins += badge.coinReward;
          await new Transaction({
            userId: progress.userId,
            type: 'earn_reward',
            amount: badge.coinReward,
            relatedId: badge._id,
            relatedModel: 'Badge',
            description: `Badge auto-earned: ${badge.name}`
          }).save();
        }

        // Send notification for auto-earned badge
        await createNotification({
          userId: progress.userId,
          type: 'badge_earned',
          title: 'New Badge Earned!',
          message: `You've earned the "${badge.name}" badge!`,
          relatedId: badge._id,
          relatedModel: 'Badge',
          data: {
            badgeIcon: badge.iconUrl,
            coinReward: badge.coinReward
          }
        });

        newBadges.push(badge);
      }
    }

    if (newBadges.length > 0) {
      await progress.save();
    }

    res.json({ success: true, newBadges });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add experience points
router.post('/add-exp', authenticateToken, async (req, res) => {
  try {
    const { amount, reason } = req.body;
    
    const progress = await UserProgress.findOneAndUpdate(
      { userId: req.user.userId },
      { $inc: { experiencePoints: amount } },
      { upsert: true, new: true }
    );

    // Check level up
    const expForNextLevel = progress.level * 100;
    if (progress.experiencePoints >= expForNextLevel) {
      progress.level += 1;
      progress.coins += progress.level * 10;
      
      await new Transaction({
        userId: req.user.userId,
        type: 'level_up',
        amount: progress.level * 10,
        description: `Level up to ${progress.level}`
      }).save();
      
      await progress.save();

      // Send level-up notification
      await createNotification({
        userId: req.user.userId,
        type: 'level_up',
        title: 'Level Up!',
        message: `Congratulations! You've reached level ${progress.level}!`,
        data: {
          newLevel: progress.level,
          coinReward: progress.level * 10
        }
      });

      // Emit leaderboard update
      if (io) {
        io.emit('leaderboard-change', {
          userId: req.user.userId,
          level: progress.level,
          experiencePoints: progress.experiencePoints,
          coins: progress.coins,
          timestamp: Date.now()
        });
      }
      
      return res.json({ 
        success: true, 
        levelUp: true, 
        newLevel: progress.level,
        coinReward: progress.level * 10,
        progress 
      });
    }

    res.json({ success: true, progress });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get user transactions
router.get('/transactions/:userId', async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    
    const transactions = await Transaction.find({ userId: req.params.userId })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .lean();

    res.json({ success: true, transactions });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Purchase coins (placeholder for payment integration)
router.post('/purchase-coins', authenticateToken, async (req, res) => {
  try {
    const { amount, paymentMethod, transactionId } = req.body;
    
    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Invalid amount' });
    }

    // Atomic increment to prevent race conditions
    const progress = await UserProgress.findOneAndUpdate(
      { userId: req.user.userId },
      { $inc: { coins: amount } },
      { upsert: true, new: true }
    );

    await new Transaction({
      userId: req.user.userId,
      type: 'purchase_coins',
      amount,
      description: `Purchased ${amount} coins via ${paymentMethod}`,
      metadata: { transactionId, paymentMethod }
    }).save();

    // Emit leaderboard update
    if (io) {
      io.emit('leaderboard-change', {
        userId: req.user.userId,
        level: progress.level,
        experiencePoints: progress.experiencePoints,
        coins: progress.coins,
        timestamp: Date.now()
      });
    }

    res.json({ 
      success: true, 
      coins: progress.coins,
      message: `Successfully purchased ${amount} coins`
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Seed default badges (run once)
router.post('/seed-badges', async (req, res) => {
  try {
    const defaultBadges = [
      { name: 'First Stream', description: 'Started your first live stream', type: 'live', criteria: 'total_live_streams', requiredValue: 1, rarity: 'common', coinReward: 10 },
      { name: 'Popular Streamer', description: 'Reached 100 total viewers', type: 'live', criteria: 'total_viewers', requiredValue: 100, rarity: 'rare', coinReward: 50 },
      { name: 'Live Legend', description: 'Completed 50 live streams', type: 'live', criteria: 'total_live_streams', requiredValue: 50, rarity: 'epic', coinReward: 200 },
      { name: 'Event Enthusiast', description: 'Joined 10 events', type: 'event', criteria: 'total_events_joined', requiredValue: 10, rarity: 'rare', coinReward: 30 },
      { name: 'Generous Gifter', description: 'Sent 500 coins in gifts', type: 'achievement', criteria: 'total_gifts_sent', requiredValue: 500, rarity: 'epic', coinReward: 100 },
      { name: 'Level 10', description: 'Reached level 10', type: 'achievement', criteria: 'level', requiredValue: 10, rarity: 'rare', coinReward: 50 },
      { name: 'Level 25', description: 'Reached level 25', type: 'achievement', criteria: 'level', requiredValue: 25, rarity: 'epic', coinReward: 150 },
      { name: 'Level 50', description: 'Reached level 50', type: 'achievement', criteria: 'level', requiredValue: 50, rarity: 'legendary', coinReward: 500 }
    ];

    for (const badgeData of defaultBadges) {
      await Badge.findOneAndUpdate(
        { name: badgeData.name },
        badgeData,
        { upsert: true }
      );
    }

    res.json({ success: true, message: 'Default badges seeded' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
