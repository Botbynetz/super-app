/**
 * PHASE 6 - Telemetry & Metrics API Routes
 * Admin-only endpoints for monitoring system health and business metrics
 */

const express = require('express');
const router = express.Router();
const { telemetry } = require('../monitoring');
const { authenticate, requireAdmin } = require('../middleware/auth');

/**
 * @route   GET /api/telemetry/metrics
 * @desc    Get current telemetry metrics
 * @access  Admin
 */
router.get('/metrics', authenticate, requireAdmin, async (req, res) => {
  try {
    const metrics = telemetry.getMetrics();
    
    res.json({
      success: true,
      data: metrics,
    });
  } catch (error) {
    console.error('Error fetching telemetry metrics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch metrics',
    });
  }
});

/**
 * @route   GET /api/telemetry/snapshot
 * @desc    Get complete system snapshot (metrics + system info)
 * @access  Admin
 */
router.get('/snapshot', authenticate, requireAdmin, async (req, res) => {
  try {
    const snapshot = telemetry.getSnapshot();
    
    res.json({
      success: true,
      data: snapshot,
    });
  } catch (error) {
    console.error('Error fetching telemetry snapshot:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch snapshot',
    });
  }
});

/**
 * @route   GET /api/telemetry/health
 * @desc    System health check with detailed status
 * @access  Public
 */
router.get('/health', async (req, res) => {
  try {
    const mongoose = require('mongoose');
    
    const health = {
      status: 'healthy',
      timestamp: new Date(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV,
      version: process.env.npm_package_version || '1.0.0',
      services: {
        database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
        memory: {
          usage: Math.round((process.memoryUsage().heapUsed / process.memoryUsage().heapTotal) * 100),
          heapUsed: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`,
          heapTotal: `${Math.round(process.memoryUsage().heapTotal / 1024 / 1024)}MB`,
        },
        cpu: process.cpuUsage(),
      },
    };
    
    // Check database connection
    if (mongoose.connection.readyState !== 1) {
      health.status = 'degraded';
    }
    
    // Check memory usage
    if (health.services.memory.usage > 90) {
      health.status = 'degraded';
    }
    
    const statusCode = health.status === 'healthy' ? 200 : 503;
    res.status(statusCode).json(health);
  } catch (error) {
    console.error('Health check failed:', error);
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date(),
      error: error.message,
    });
  }
});

/**
 * @route   GET /api/telemetry/revenue
 * @desc    Get revenue analytics
 * @access  Admin
 */
router.get('/revenue', authenticate, requireAdmin, async (req, res) => {
  try {
    const CreatorRevenue = require('../models/CreatorRevenue');
    const Transaction = require('../models/Transaction');
    
    // Aggregate revenue data
    const [totalRevenue, totalTransactions, revenueByType] = await Promise.all([
      CreatorRevenue.aggregate([
        {
          $group: {
            _id: null,
            platformRevenue: { $sum: '$platformShare' },
            creatorRevenue: { $sum: '$availableBalance' },
            pendingRevenue: { $sum: '$pendingBalance' },
          },
        },
      ]),
      Transaction.countDocuments(),
      Transaction.aggregate([
        {
          $group: {
            _id: '$type',
            count: { $sum: 1 },
            totalAmount: { $sum: '$amount' },
          },
        },
      ]),
    ]);
    
    res.json({
      success: true,
      data: {
        totalRevenue: totalRevenue[0] || {},
        totalTransactions,
        revenueByType,
        telemetry: {
          totalRevenue: telemetry.metrics.totalRevenue,
          totalTransactions: telemetry.metrics.totalTransactions,
        },
      },
    });
  } catch (error) {
    console.error('Error fetching revenue analytics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch revenue analytics',
    });
  }
});

/**
 * @route   GET /api/telemetry/fraud
 * @desc    Get fraud detection metrics
 * @access  Admin
 */
router.get('/fraud', authenticate, requireAdmin, async (req, res) => {
  try {
    const AuditLog = require('../models/AuditLog');
    
    const [highRiskUsers, recentAlerts] = await Promise.all([
      AuditLog.aggregate([
        { $match: { action: 'FRAUD_ALERT' } },
        { $group: { _id: '$userId', alertCount: { $sum: 1 } } },
        { $sort: { alertCount: -1 } },
        { $limit: 10 },
      ]),
      AuditLog.find({ action: 'FRAUD_ALERT' })
        .sort({ createdAt: -1 })
        .limit(20)
        .populate('userId', 'username email'),
    ]);
    
    res.json({
      success: true,
      data: {
        totalAlerts: telemetry.metrics.fraudAlerts,
        highRiskUsers,
        recentAlerts,
      },
    });
  } catch (error) {
    console.error('Error fetching fraud metrics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch fraud metrics',
    });
  }
});

/**
 * @route   POST /api/telemetry/reset
 * @desc    Reset daily metrics (admin only)
 * @access  Admin
 */
router.post('/reset', authenticate, requireAdmin, async (req, res) => {
  try {
    telemetry.resetDailyMetrics();
    
    res.json({
      success: true,
      message: 'Daily metrics reset successfully',
    });
  } catch (error) {
    console.error('Error resetting metrics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reset metrics',
    });
  }
});

module.exports = router;
