const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  txId: {
    type: String,
    required: true,
    index: true
  },
  action: {
    type: String,
    required: true,
    enum: ['create', 'commit', 'rollback', 'reverse', 'update', 'freeze', 'unfreeze'],
    index: true
  },
  entity: {
    type: String,
    required: true,
    enum: ['wallet', 'transaction', 'user'],
    index: true
  },
  entityId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    index: true
  },
  actor: {
    id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    role: {
      type: String,
      enum: ['user', 'admin', 'system']
    },
    ip: String,
    userAgent: String
  },
  before: {
    type: mongoose.Schema.Types.Mixed
  },
  after: {
    type: mongoose.Schema.Types.Mixed
  },
  changes: {
    type: mongoose.Schema.Types.Mixed
  },
  reason: {
    type: String
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  }
});

// Compound indexes for audit queries
auditLogSchema.index({ txId: 1, timestamp: -1 });
auditLogSchema.index({ entityId: 1, timestamp: -1 });
auditLogSchema.index({ 'actor.id': 1, timestamp: -1 });
auditLogSchema.index({ action: 1, timestamp: -1 });

// Static method to create audit log
auditLogSchema.statics.createLog = async function(logData) {
  try {
    const log = await this.create(logData);
    return log;
  } catch (error) {
    // Don't throw on audit log failure, just log it
    console.error('Failed to create audit log:', error);
    return null;
  }
};

// Static method to get transaction audit trail
auditLogSchema.statics.getTransactionTrail = async function(txId) {
  return this.find({ txId })
    .sort({ timestamp: 1 })
    .populate('actor.id', 'username email')
    .lean();
};

// Static method to get entity audit history
auditLogSchema.statics.getEntityHistory = async function(entityId, options = {}) {
  const {
    page = 1,
    limit = 100,
    action = null,
    startDate = null,
    endDate = null
  } = options;

  const query = { entityId };
  
  if (action) query.action = action;
  if (startDate || endDate) {
    query.timestamp = {};
    if (startDate) query.timestamp.$gte = new Date(startDate);
    if (endDate) query.timestamp.$lte = new Date(endDate);
  }

  const skip = (page - 1) * limit;

  const [logs, total] = await Promise.all([
    this.find(query)
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit)
      .populate('actor.id', 'username')
      .lean(),
    this.countDocuments(query)
  ]);

  return {
    logs,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  };
};

// Static method to get user activity
auditLogSchema.statics.getUserActivity = async function(userId, options = {}) {
  const {
    page = 1,
    limit = 50,
    action = null
  } = options;

  const query = { 'actor.id': userId };
  if (action) query.action = action;

  const skip = (page - 1) * limit;

  const [logs, total] = await Promise.all([
    this.find(query)
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    this.countDocuments(query)
  ]);

  return {
    logs,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  };
};

const AuditLog = mongoose.model('AuditLog', auditLogSchema);

module.exports = AuditLog;
