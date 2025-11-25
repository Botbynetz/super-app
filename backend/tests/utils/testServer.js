/**
 * Test Server Utility
 * Spins up Express app in test mode with isolated database
 */

const express = require('express');
const mongoose = require('mongoose');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

// Import routes
const authRoutes = require('../../routes/auth');
const userRoutes = require('../../routes/user');
const walletRoutes = require('../../routes/wallet');
const premiumRoutes = require('../../routes/premium');
const subscriptionRoutes = require('../../routes/subscription');
const creatorRevenueRoutes = require('../../routes/creatorRevenue');

// Middleware
const { verifyToken } = require('../../middleware/auth');

let server;
let io;
let mongoConnection;

/**
 * Initialize test server
 * @param {number} port - Port to run server on (default: 5001)
 * @returns {Promise<{app, server, io}>}
 */
async function startTestServer(port = 5001) {
  // Connect to test database
  const MONGODB_URI_TEST = process.env.MONGODB_URI_TEST || 'mongodb://localhost:27017/super-app-test';
  
  try {
    mongoConnection = await mongoose.connect(MONGODB_URI_TEST, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log(`[TEST] Connected to MongoDB: ${MONGODB_URI_TEST}`);
  } catch (error) {
    console.error('[TEST] MongoDB connection failed:', error);
    throw error;
  }

  // Initialize Express app
  const app = express();
  
  // Middleware
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Health check endpoint
  app.get('/health', (req, res) => {
    res.json({ 
      status: 'ok', 
      environment: 'test',
      database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
      timestamp: new Date().toISOString()
    });
  });

  // API Routes
  app.use('/api/auth', authRoutes);
  app.use('/api/users', verifyToken, userRoutes);
  app.use('/api/wallet', verifyToken, walletRoutes);
  app.use('/api/premium', verifyToken, premiumRoutes);
  app.use('/api/subscription', verifyToken, subscriptionRoutes);
  app.use('/api/creator/revenue', verifyToken, creatorRevenueRoutes);

  // Error handler
  app.use((err, req, res, next) => {
    console.error('[TEST] Error:', err);
    res.status(err.status || 500).json({
      error: err.message || 'Internal server error',
      code: err.code || 'INTERNAL_ERROR',
    });
  });

  // Create HTTP server
  server = http.createServer(app);

  // Initialize Socket.IO
  io = new Server(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  });

  // Socket.IO authentication middleware
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error('Authentication error'));
    }
    
    try {
      const jwt = require('jsonwebtoken');
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'test-secret-key-123');
      socket.userId = decoded.id;
      socket.join(`user:${decoded.id}`);
      next();
    } catch (error) {
      next(new Error('Authentication error'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`[TEST] Socket connected: ${socket.userId}`);

    socket.on('disconnect', () => {
      console.log(`[TEST] Socket disconnected: ${socket.userId}`);
    });
  });

  // Make io accessible to routes
  app.set('io', io);

  // Start server
  await new Promise((resolve) => {
    server.listen(port, () => {
      console.log(`[TEST] Server running on port ${port}`);
      resolve();
    });
  });

  return { app, server, io };
}

/**
 * Stop test server and cleanup
 */
async function stopTestServer() {
  if (io) {
    io.close();
    console.log('[TEST] Socket.IO closed');
  }

  if (server) {
    await new Promise((resolve) => {
      server.close(resolve);
    });
    console.log('[TEST] HTTP server closed');
  }

  if (mongoConnection) {
    await mongoose.disconnect();
    console.log('[TEST] MongoDB disconnected');
  }
}

/**
 * Get Socket.IO instance
 */
function getIO() {
  if (!io) {
    throw new Error('Socket.IO not initialized. Call startTestServer() first.');
  }
  return io;
}

module.exports = {
  startTestServer,
  stopTestServer,
  getIO,
};
