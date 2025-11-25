/**
 * PHASE 6 - Log Management API Routes
 * Admin endpoints for viewing, downloading, and streaming logs
 */

const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const path = require('path');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { logger, auditStream } = require('../logger');

/**
 * @route   GET /api/logs/combined
 * @desc    Get combined logs (paginated)
 * @access  Admin
 */
router.get('/combined', authenticate, requireAdmin, async (req, res) => {
  try {
    const { lines = 100 } = req.query;
    const logPath = path.join(__dirname, '..', 'logs', 'combined.log');
    
    const content = await fs.readFile(logPath, 'utf-8');
    const logLines = content.split('\n').filter(line => line.trim());
    
    // Get last N lines
    const recentLogs = logLines.slice(-parseInt(lines));
    
    // Parse JSON logs
    const parsedLogs = recentLogs.map(line => {
      try {
        return JSON.parse(line);
      } catch {
        return { message: line };
      }
    });
    
    res.json({
      success: true,
      data: {
        logs: parsedLogs,
        total: logLines.length,
        returned: parsedLogs.length,
      },
    });
  } catch (error) {
    logger.error('Error reading combined logs:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to read logs',
    });
  }
});

/**
 * @route   GET /api/logs/errors
 * @desc    Get error logs only (paginated)
 * @access  Admin
 */
router.get('/errors', authenticate, requireAdmin, async (req, res) => {
  try {
    const { lines = 50 } = req.query;
    const logPath = path.join(__dirname, '..', 'logs', 'error.log');
    
    const content = await fs.readFile(logPath, 'utf-8');
    const logLines = content.split('\n').filter(line => line.trim());
    
    // Get last N lines
    const recentErrors = logLines.slice(-parseInt(lines));
    
    // Parse JSON logs
    const parsedErrors = recentErrors.map(line => {
      try {
        return JSON.parse(line);
      } catch {
        return { message: line };
      }
    });
    
    res.json({
      success: true,
      data: {
        errors: parsedErrors,
        total: logLines.length,
        returned: parsedErrors.length,
      },
    });
  } catch (error) {
    logger.error('Error reading error logs:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to read error logs',
    });
  }
});

/**
 * @route   GET /api/logs/download/combined
 * @desc    Download combined log file
 * @access  Admin
 */
router.get('/download/combined', authenticate, requireAdmin, async (req, res) => {
  try {
    const logPath = path.join(__dirname, '..', 'logs', 'combined.log');
    
    res.download(logPath, `combined-${Date.now()}.log`, (err) => {
      if (err) {
        logger.error('Error downloading combined logs:', err);
        res.status(500).json({
          success: false,
          message: 'Failed to download logs',
        });
      }
    });
  } catch (error) {
    logger.error('Error preparing log download:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to prepare download',
    });
  }
});

/**
 * @route   GET /api/logs/download/errors
 * @desc    Download error log file
 * @access  Admin
 */
router.get('/download/errors', authenticate, requireAdmin, async (req, res) => {
  try {
    const logPath = path.join(__dirname, '..', 'logs', 'error.log');
    
    res.download(logPath, `errors-${Date.now()}.log`, (err) => {
      if (err) {
        logger.error('Error downloading error logs:', err);
        res.status(500).json({
          success: false,
          message: 'Failed to download error logs',
        });
      }
    });
  } catch (error) {
    logger.error('Error preparing error log download:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to prepare download',
    });
  }
});

/**
 * @route   GET /api/logs/stream/audit
 * @desc    Server-Sent Events stream for real-time audit logs
 * @access  Admin
 */
router.get('/stream/audit', authenticate, requireAdmin, (req, res) => {
  // Set headers for SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable buffering in nginx
  
  // Generate session ID
  const sessionId = `${req.user.id}-${Date.now()}`;
  
  // Send initial connection message
  res.write(`data: ${JSON.stringify({ type: 'connected', sessionId })}\n\n`);
  
  // Add client to audit stream
  auditStream.addClient(sessionId, res);
  
  // Handle client disconnect
  req.on('close', () => {
    auditStream.removeClient(sessionId);
  });
});

/**
 * @route   GET /api/logs/stats
 * @desc    Get log statistics
 * @access  Admin
 */
router.get('/stats', authenticate, requireAdmin, async (req, res) => {
  try {
    const [combinedStats, errorStats] = await Promise.all([
      fs.stat(path.join(__dirname, '..', 'logs', 'combined.log')),
      fs.stat(path.join(__dirname, '..', 'logs', 'error.log')),
    ]);
    
    res.json({
      success: true,
      data: {
        combined: {
          size: `${(combinedStats.size / 1024 / 1024).toFixed(2)} MB`,
          modified: combinedStats.mtime,
        },
        errors: {
          size: `${(errorStats.size / 1024 / 1024).toFixed(2)} MB`,
          modified: errorStats.mtime,
        },
        activeStreams: auditStream.getActiveStreams(),
      },
    });
  } catch (error) {
    logger.error('Error getting log stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get log statistics',
    });
  }
});

/**
 * @route   POST /api/logs/clear
 * @desc    Clear log files (admin only, use with caution)
 * @access  Admin
 */
router.post('/clear', authenticate, requireAdmin, async (req, res) => {
  try {
    const { logType } = req.body; // 'combined' or 'errors' or 'all'
    
    if (logType === 'combined' || logType === 'all') {
      await fs.writeFile(path.join(__dirname, '..', 'logs', 'combined.log'), '');
    }
    
    if (logType === 'errors' || logType === 'all') {
      await fs.writeFile(path.join(__dirname, '..', 'logs', 'error.log'), '');
    }
    
    logger.info(`Logs cleared by admin: ${req.user.id}`, { logType });
    
    res.json({
      success: true,
      message: `${logType} logs cleared successfully`,
    });
  } catch (error) {
    logger.error('Error clearing logs:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to clear logs',
    });
  }
});

module.exports = router;
