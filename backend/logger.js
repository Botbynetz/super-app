/**
 * PHASE 6 - Logging Infrastructure with Winston
 * Combined logs, error logs, and audit streaming
 */

const winston = require('winston');
const path = require('path');

// Define log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Define colors for each level
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'blue',
};

winston.addColors(colors);

// Define log format
const format = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

// Console format for development
const consoleFormat = winston.format.combine(
  winston.format.colorize({ all: true }),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(
    (info) => `${info.timestamp} ${info.level}: ${info.message}${info.stack ? '\n' + info.stack : ''}`
  )
);

// Define transports
const transports = [
  // Console transport
  new winston.transports.Console({
    format: consoleFormat,
  }),
  
  // Combined log file
  new winston.transports.File({
    filename: path.join(__dirname, 'logs', 'combined.log'),
    format,
    maxsize: 10485760, // 10MB
    maxFiles: 7,
  }),
  
  // Error log file
  new winston.transports.File({
    filename: path.join(__dirname, 'logs', 'error.log'),
    level: 'error',
    format,
    maxsize: 10485760, // 10MB
    maxFiles: 7,
  }),
];

// Create logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  levels,
  format,
  transports,
  exitOnError: false,
});

// Audit log stream for real-time wallet & revenue events
class AuditLogStream {
  constructor() {
    this.streams = new Map(); // sessionId -> response object
  }

  addClient(sessionId, res) {
    this.streams.set(sessionId, res);
    logger.info(`Audit stream client connected: ${sessionId}`);
  }

  removeClient(sessionId) {
    this.streams.delete(sessionId);
    logger.info(`Audit stream client disconnected: ${sessionId}`);
  }

  broadcast(event) {
    const data = JSON.stringify(event);
    
    this.streams.forEach((res, sessionId) => {
      try {
        res.write(`data: ${data}\n\n`);
      } catch (error) {
        logger.error(`Failed to send to client ${sessionId}:`, error);
        this.streams.delete(sessionId);
      }
    });
    
    // Also log to file
    logger.info('AUDIT_EVENT', event);
  }

  getActiveStreams() {
    return this.streams.size;
  }
}

const auditStream = new AuditLogStream();

/**
 * Log audit event (wallet, revenue, transactions)
 */
function logAudit(action, data) {
  const event = {
    timestamp: new Date(),
    action,
    ...data,
  };
  
  auditStream.broadcast(event);
}

/**
 * HTTP request logger middleware
 */
function httpLogger(req, res, next) {
  const startTime = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    
    logger.http(`${req.method} ${req.originalUrl}`, {
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      userAgent: req.get('user-agent'),
      userId: req.user?.id,
    });
  });
  
  next();
}

/**
 * Error logger middleware
 */
function errorLogger(err, req, res, next) {
  logger.error(`${err.message}`, {
    error: {
      message: err.message,
      stack: err.stack,
      name: err.name,
    },
    request: {
      method: req.method,
      url: req.originalUrl,
      headers: req.headers,
      body: req.body,
      userId: req.user?.id,
    },
  });
  
  next(err);
}

module.exports = {
  logger,
  auditStream,
  logAudit,
  httpLogger,
  errorLogger,
};
