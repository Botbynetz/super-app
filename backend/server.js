const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/user');
const contentRoutes = require('./routes/content');
const eventRoutes = require('./routes/event');
const chatRoutes = require('./routes/chat');
const searchRoutes = require('./routes/search');
const adminRoutes = require('./routes/admin');
const livestreamRoutes = require('./routes/livestream');
const gamificationRoutes = require('./routes/gamification');
const aiRoutes = require('./routes/ai');
const { router: notificationRoutes } = require('./routes/notification');
const walletRoutes = require('./routes/wallet');
const premiumRoutes = require('./routes/premium');
const subscriptionRoutes = require('./routes/subscription');
const creatorRevenueRoutes = require('./routes/creatorRevenue');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static('uploads'));

// Make io accessible in routes
app.set('io', io);

mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));

app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/content', contentRoutes);
app.use('/api/event', eventRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/livestream', livestreamRoutes);
app.use('/api/gamification', gamificationRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/notification', notificationRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/premium', premiumRoutes);
app.use('/api/subscription', subscriptionRoutes);
app.use('/api/creator', creatorRevenueRoutes);

const activeUsers = new Map();
const liveStreamRooms = new Map();

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Heartbeat for connection stability
  let heartbeatInterval;
  
  socket.on('user-online', (userId) => {
    activeUsers.set(userId, socket.id);
    socket.userId = userId;
    socket.join(`user:${userId}`); // Personal notification room
    io.emit('user-status', { userId, status: 'online' });
    
    // Start heartbeat
    heartbeatInterval = setInterval(() => {
      socket.emit('ping');
    }, 30000); // 30 seconds
  });

  socket.on('pong', () => {
    // Client responded to ping
    socket.lastPong = Date.now();
  });

  // Wallet balance request
  socket.on('REQUEST_BALANCE', async (data) => {
    try {
      const WalletService = require('./services/walletService');
      const balance = await WalletService.getBalance(socket.userId);
      socket.emit('BALANCE_RESPONSE', {
        success: true,
        data: balance
      });
    } catch (error) {
      socket.emit('BALANCE_RESPONSE', {
        success: false,
        error: error.message
      });
    }
  });

  socket.on('send-message', (data) => {
    const { chatId, message } = data;
    socket.to(chatId).emit('receive-message', message);
  });

  socket.on('join-chat', (chatId) => {
    socket.join(chatId);
  });

  // Live streaming events
  socket.on('join-stream', ({ streamId, rtcRoomId, userId }) => {
    socket.join(streamId);
    socket.streamId = streamId;
    
    if (!liveStreamRooms.has(streamId)) {
      liveStreamRooms.set(streamId, new Set());
    }
    liveStreamRooms.get(streamId).add(userId);
    
    io.to(streamId).emit('viewer-joined', { 
      userId, 
      viewerCount: liveStreamRooms.get(streamId).size 
    });
  });

  socket.on('leave-stream', ({ streamId, userId }) => {
    if (liveStreamRooms.has(streamId)) {
      liveStreamRooms.get(streamId).delete(userId);
      io.to(streamId).emit('viewer-left', { 
        userId, 
        viewerCount: liveStreamRooms.get(streamId).size 
      });
    }
    socket.leave(streamId);
  });

  socket.on('stream-chat-message', ({ streamId, message, username }) => {
    io.to(streamId).emit('stream-chat-message', { message, username, timestamp: Date.now() });
  });

  socket.on('stream-gift', ({ streamId, gift, fromUser }) => {
    io.to(streamId).emit('stream-gift', { gift, fromUser, timestamp: Date.now() });
  });

  socket.on('stream-like', ({ streamId, userId }) => {
    io.to(streamId).emit('stream-like', { userId });
  });

  socket.on('webrtc-signal', ({ streamId, signal, to }) => {
    socket.to(to).emit('webrtc-signal', { signal, from: socket.id });
  });

  // Leaderboard real-time updates
  socket.on('leaderboard-update', (data) => {
    const { userId, level, experiencePoints, coins, rank } = data;
    io.emit('leaderboard-change', { userId, level, experiencePoints, coins, rank, timestamp: Date.now() });
  });

  // Transaction notifications (double-spend prevention check)
  socket.on('transaction-initiated', (data) => {
    const { userId, type, amount, transactionId } = data;
    // Notify transaction processing to prevent double-clicks
    socket.emit('transaction-processing', { transactionId, status: 'processing' });
  });

  // Premium content events (Phase 5.1)
  socket.on('premium-unlock', ({ userId, contentId, unlockId, amount_coins, title, creatorId }) => {
    // Notify buyer
    io.to(`user:${userId}`).emit('PREMIUM_UNLOCKED', {
      contentId,
      title,
      unlockId,
      amount_coins,
      timestamp: Date.now()
    });
    
    // Notify creator
    io.to(`user:${creatorId}`).emit('REVENUE_UPDATED', {
      type: 'unlock',
      contentId,
      amount_coins: Math.floor(amount_coins * 0.70), // Creator share
      timestamp: Date.now()
    });
  });

  socket.on('subscription-started', ({ subscriberId, creatorId, subscriptionId, tier, expiresAt }) => {
    // Notify subscriber
    io.to(`user:${subscriberId}`).emit('SUBSCRIPTION_STARTED', {
      subscriptionId,
      creatorId,
      tier,
      expiresAt,
      timestamp: Date.now()
    });
    
    // Notify creator
    io.to(`user:${creatorId}`).emit('SUBSCRIPTION_STARTED', {
      subscriptionId,
      subscriberId,
      tier,
      expiresAt,
      timestamp: Date.now()
    });
  });

  socket.on('subscription-cancelled', ({ subscriberId, creatorId, subscriptionId }) => {
    io.to(`user:${subscriberId}`).emit('SUBSCRIPTION_CANCELLED', {
      subscriptionId,
      timestamp: Date.now()
    });
    
    io.to(`user:${creatorId}`).emit('SUBSCRIPTION_CANCELLED', {
      subscriptionId,
      subscriberId,
      timestamp: Date.now()
    });
  });

  socket.on('content-published', ({ creatorId, contentId, title }) => {
    // Notify creator's subscribers
    // TODO: Get subscriber list and notify each
    io.emit('CONTENT_PUBLISHED', {
      creatorId,
      contentId,
      title,
      timestamp: Date.now()
    });
  });

  socket.on('disconnect', () => {
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
    }
    if (socket.userId) {
      activeUsers.delete(socket.userId);
      socket.leave(`user:${socket.userId}`);
      io.emit('user-status', { userId: socket.userId, status: 'offline' });
    }
    if (socket.streamId && liveStreamRooms.has(socket.streamId)) {
      liveStreamRooms.get(socket.streamId).delete(socket.userId);
      io.to(socket.streamId).emit('viewer-left', { 
        userId: socket.userId, 
        viewerCount: liveStreamRooms.get(socket.streamId).size 
      });
    }
    console.log('User disconnected:', socket.id);
  });

  // Handle client errors
  socket.on('error', (error) => {
    console.error('Socket error:', error);
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = { io };
