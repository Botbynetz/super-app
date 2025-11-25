/**
 * Advanced Logger with Request Tracking
 * Winston-based logging with request IDs, structured logging, and rotation
 * 
 * Features:
 * - Request ID tracking across services
 * - Structured logging (JSON format)
 * - Log levels and filtering
 * - File rotation and retention
 * - Context-aware logging
 * - Performance metrics
 */

const winston = require('winston');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

// Ensure logs directory exists
const logsDir = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

/**
 * Custom log levels
 */
const customLevels = {
  levels: {
    error: 0,
    warn: 1,
    info: 2,
    http: 3,
    debug: 4,
    trace: 5
  },
  colors: {
    error: 'red',
    warn: 'yellow',
    info: 'green',
    http: 'magenta',
    debug: 'blue',
    trace: 'gray'
  }
};

winston.addColors(customLevels.colors);

/**
 * Custom format for structured logging
 */
const structuredFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
  winston.format.errors({ stack: true }),
  winston.format.metadata({ fillExcept: ['message', 'level', 'timestamp'] }),
  winston.format.json()
);

/**
 * Console format (human-readable)
 */
const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(({ timestamp, level, message, requestId, userId, ...meta }) => {
    let log = `${timestamp} [${level}]`;
    
    if (requestId) {
      log += ` [${requestId.substring(0, 8)}]`;
    }
    
    if (userId) {
      log += ` [user:${userId}]`;
    }
    
    log += `: ${message}`;
    
    // Add metadata if present
    if (Object.keys(meta).length > 0) {
      log += ` ${JSON.stringify(meta)}`;
    }
    
    return log;
  })
);

/**
 * Create Winston logger instance
 */
const logger = winston.createLogger({
  levels: customLevels.levels,
  level: process.env.LOG_LEVEL || 'info',
  format: structuredFormat,
  transports: [
    // Console transport
    new winston.transports.Console({
      format: consoleFormat,
      level: process.env.LOG_LEVEL || 'info'
    }),
    
    // Combined log file (all logs)
    new winston.transports.File({
      filename: path.join(logsDir, 'combined.log'),
      level: 'info',
      maxsize: 10485760, // 10MB
      maxFiles: 7,
      tailable: true
    }),
    
    // Error log file (errors only)
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      maxsize: 10485760, // 10MB
      maxFiles: 14,
      tailable: true
    }),
    
    // HTTP requests log
    new winston.transports.File({
      filename: path.join(logsDir, 'http.log'),
      level: 'http',
      maxsize: 10485760, // 10MB
      maxFiles: 3,
      tailable: true
    }),
    
    // Debug log (development only)
    ...(process.env.NODE_ENV !== 'production' ? [
      new winston.transports.File({
        filename: path.join(logsDir, 'debug.log'),
        level: 'debug',
        maxsize: 5242880, // 5MB
        maxFiles: 2
      })
    ] : [])
  ],
  
  // Handle exceptions and rejections
  exceptionHandlers: [
    new winston.transports.File({
      filename: path.join(logsDir, 'exceptions.log'),
      maxsize: 10485760,
      maxFiles: 5
    })
  ],
  rejectionHandlers: [
    new winston.transports.File({
      filename: path.join(logsDir, 'rejections.log'),
      maxsize: 10485760,
      maxFiles: 5
    })
  ],
  
  exitOnError: false
});

/**
 * Logger class with context support
 */
class Logger {
  constructor(context = {}) {
    this.context = context;
  }

  /**
   * Create child logger with additional context
   */
  child(additionalContext) {
    return new Logger({ ...this.context, ...additionalContext });
  }

  /**
   * Log with merged context
   */
  log(level, message, meta = {}) {
    logger.log(level, message, { ...this.context, ...meta });
  }

  error(message, error = null, meta = {}) {
    const errorMeta = {
      ...this.context,
      ...meta,
      ...(error && {
        error: {
          message: error.message,
          stack: error.stack,
          code: error.code,
          name: error.name
        }
      })
    };
    logger.error(message, errorMeta);
  }

  warn(message, meta = {}) {
    logger.warn(message, { ...this.context, ...meta });
  }

  info(message, meta = {}) {
    logger.info(message, { ...this.context, ...meta });
  }

  http(message, meta = {}) {
    logger.http(message, { ...this.context, ...meta });
  }

  debug(message, meta = {}) {
    logger.debug(message, { ...this.context, ...meta });
  }

  trace(message, meta = {}) {
    logger.log('trace', message, { ...this.context, ...meta });
  }

  /**
   * Log performance metric
   */
  metric(metricName, value, unit = 'ms', meta = {}) {
    logger.info(`Metric: ${metricName}`, {
      ...this.context,
      ...meta,
      metric: {
        name: metricName,
        value,
        unit,
        timestamp: new Date().toISOString()
      }
    });
  }

  /**
   * Log audit event
   */
  audit(action, entity, meta = {}) {
    logger.info(`Audit: ${action}`, {
      ...this.context,
      ...meta,
      audit: {
        action,
        entity,
        timestamp: new Date().toISOString()
      }
    });
  }
}

/**
 * Express middleware for request logging with request ID
 */
function requestLoggerMiddleware(req, res, next) {
  // Generate or extract request ID
  const requestId = req.headers['x-request-id'] || uuidv4();
  req.requestId = requestId;
  
  // Add request ID to response headers
  res.setHeader('X-Request-ID', requestId);
  
  // Create request-scoped logger
  const requestLogger = new Logger({
    requestId,
    userId: req.user?.userId,
    ip: req.ip,
    userAgent: req.headers['user-agent']
  });
  
  req.logger = requestLogger;
  
  // Log request start
  const startTime = Date.now();
  requestLogger.http(`${req.method} ${req.path}`, {
    method: req.method,
    url: req.url,
    path: req.path,
    query: req.query,
    headers: {
      'user-agent': req.headers['user-agent'],
      'content-type': req.headers['content-type']
    }
  });
  
  // Log response
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const level = res.statusCode >= 400 ? 'warn' : 'http';
    
    requestLogger.log(level, `${req.method} ${req.path} ${res.statusCode} ${duration}ms`, {
      method: req.method,
      url: req.url,
      path: req.path,
      statusCode: res.statusCode,
      duration,
      contentLength: res.getHeader('content-length')
    });
    
    // Log slow requests
    if (duration > 1000) {
      requestLogger.warn(`Slow request: ${req.method} ${req.path}`, {
        duration,
        threshold: 1000
      });
    }
  });
  
  // Log errors
  res.on('error', (error) => {
    requestLogger.error(`Request error: ${req.method} ${req.path}`, error);
  });
  
  next();
}

/**
 * Error logging middleware
 */
function errorLoggerMiddleware(err, req, res, next) {
  const logger = req.logger || new Logger({ requestId: req.requestId });
  
  logger.error(`Unhandled error: ${err.message}`, err, {
    method: req.method,
    path: req.path,
    statusCode: err.statusCode || 500,
    stack: err.stack
  });
  
  next(err);
}

/**
 * Performance monitoring helper
 */
class PerformanceLogger {
  constructor(logger, operationName) {
    this.logger = logger;
    this.operationName = operationName;
    this.startTime = Date.now();
    this.checkpoints = [];
  }

  checkpoint(name) {
    const elapsed = Date.now() - this.startTime;
    this.checkpoints.push({ name, elapsed });
    this.logger.debug(`${this.operationName} - ${name}`, { elapsed });
  }

  end(meta = {}) {
    const totalDuration = Date.now() - this.startTime;
    this.logger.metric(this.operationName, totalDuration, 'ms', {
      ...meta,
      checkpoints: this.checkpoints
    });
    return totalDuration;
  }
}

/**
 * Create performance logger
 */
function createPerformanceLogger(logger, operationName) {
  return new PerformanceLogger(logger, operationName);
}

/**
 * Sanitize sensitive data from logs
 */
function sanitizeLogData(data) {
  const sensitiveFields = [
    'password',
    'token',
    'secret',
    'apiKey',
    'authorization',
    'cookie',
    'creditCard',
    'ssn',
    'pin'
  ];
  
  if (typeof data !== 'object' || data === null) {
    return data;
  }
  
  const sanitized = Array.isArray(data) ? [] : {};
  
  for (const [key, value] of Object.entries(data)) {
    const lowerKey = key.toLowerCase();
    
    // Check if field is sensitive
    const isSensitive = sensitiveFields.some(field => lowerKey.includes(field));
    
    if (isSensitive) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeLogData(value);
    } else {
      sanitized[key] = value;
    }
  }
  
  return sanitized;
}

/**
 * Query logger for database operations
 */
function logQuery(logger, query, duration, results) {
  logger.debug('Database query', {
    query: sanitizeLogData(query),
    duration,
    resultCount: results?.length || 0
  });
  
  if (duration > 500) {
    logger.warn('Slow database query', {
      query: sanitizeLogData(query),
      duration,
      threshold: 500
    });
  }
}

/**
 * Get logger stats
 */
function getLoggerStats() {
  const logFiles = ['combined.log', 'error.log', 'http.log'];
  const stats = {};
  
  for (const file of logFiles) {
    const filePath = path.join(logsDir, file);
    try {
      const stat = fs.statSync(filePath);
      stats[file] = {
        size: stat.size,
        sizeFormatted: formatBytes(stat.size),
        modified: stat.mtime
      };
    } catch (error) {
      stats[file] = { error: 'File not found' };
    }
  }
  
  return {
    logLevel: logger.level,
    files: stats,
    directory: logsDir
  };
}

/**
 * Format bytes to human-readable size
 */
function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Rotate logs manually (for testing)
 */
async function rotateLogs() {
  // Winston handles rotation automatically via maxsize/maxFiles
  // This function is for manual rotation if needed
  logger.info('Manual log rotation triggered');
  
  // Close and reopen transports
  logger.close();
  
  // Recreate transports (Winston will handle file rotation)
  logger.configure({
    transports: logger.transports
  });
  
  return { success: true, message: 'Logs rotated' };
}

// Create default logger instance
const defaultLogger = new Logger();

module.exports = {
  logger: defaultLogger,
  Logger,
  requestLoggerMiddleware,
  errorLoggerMiddleware,
  createPerformanceLogger,
  PerformanceLogger,
  sanitizeLogData,
  logQuery,
  getLoggerStats,
  rotateLogs
};
