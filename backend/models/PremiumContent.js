const mongoose = require('mongoose');

const premiumContentSchema = new mongoose.Schema({
  creatorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  description: {
    type: String,
    required: true,
    maxlength: 2000
  },
  category: {
    type: String,
    required: true,
    enum: ['education', 'entertainment', 'business', 'technology', 'lifestyle', 'art', 'music', 'fitness', 'other'],
    index: true
  },
  price_coins: {
    type: Number,
    required: true,
    min: 1,
    validate: {
      validator: Number.isInteger,
      message: 'Price must be an integer'
    }
  },
  previewMediaUrl: {
    type: String,
    default: null
  },
  fullMediaUrl: {
    type: String,
    required: true
  },
  thumbnailUrl: {
    type: String,
    default: null
  },
  mediaType: {
    type: String,
    enum: ['image', 'video', 'audio', 'document', 'course'],
    required: true
  },
  duration_seconds: {
    type: Number, // For video/audio
    default: null
  },
  fileSize_bytes: {
    type: Number,
    default: null
  },
  is_published: {
    type: Boolean,
    default: false,
    index: true
  },
  is_deleted: {
    type: Boolean,
    default: false,
    index: true
  },
  watermark_enabled: {
    type: Boolean,
    default: true
  },
  allowed_subscribers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  subscriber_only: {
    type: Boolean,
    default: false
  },
  stats: {
    views: {
      type: Number,
      default: 0
    },
    unlocks: {
      type: Number,
      default: 0
    },
    revenue_coins: {
      type: Number,
      default: 0
    },
    likes: {
      type: Number,
      default: 0
    },
    shares: {
      type: Number,
      default: 0
    }
  },
  tags: [{
    type: String,
    lowercase: true,
    trim: true
  }],
  visibility: {
    type: String,
    enum: ['public', 'subscribers_only', 'unlisted', 'private'],
    default: 'public'
  }
}, {
  timestamps: true
});

// Indexes for performance
premiumContentSchema.index({ creatorId: 1, is_published: 1, createdAt: -1 });
premiumContentSchema.index({ category: 1, is_published: 1, 'stats.unlocks': -1 });
premiumContentSchema.index({ is_published: 1, 'stats.views': -1 });
premiumContentSchema.index({ tags: 1 });
premiumContentSchema.index({ createdAt: -1 });

// Virtual for price in rupiah
premiumContentSchema.virtual('price_rupiah').get(function() {
  return this.price_coins * 100; // 1 coin = 100 rupiah
});

// Virtual for creator share
premiumContentSchema.virtual('creator_share_coins').get(function() {
  return Math.floor(this.price_coins * 0.70);
});

// Virtual for platform share
premiumContentSchema.virtual('platform_share_coins').get(function() {
  return Math.floor(this.price_coins * 0.25);
});

// Virtual for processing fee
premiumContentSchema.virtual('processing_fee_coins').get(function() {
  return Math.floor(this.price_coins * 0.05);
});

// Instance method: Check if user has access
premiumContentSchema.methods.hasAccess = function(userId) {
  // Creator always has access
  if (this.creatorId.toString() === userId.toString()) {
    return true;
  }
  
  // Check if user is in allowed_subscribers (unlocked or subscribed)
  return this.allowed_subscribers.some(id => id.toString() === userId.toString());
};

// Instance method: Grant access to user
premiumContentSchema.methods.grantAccess = async function(userId) {
  if (!this.hasAccess(userId)) {
    this.allowed_subscribers.push(userId);
    await this.save();
  }
};

// Instance method: Increment view count
premiumContentSchema.methods.incrementViews = async function() {
  this.stats.views += 1;
  await this.save();
};

// Instance method: Increment unlock count and revenue
premiumContentSchema.methods.recordUnlock = async function(amount_coins) {
  this.stats.unlocks += 1;
  this.stats.revenue_coins += amount_coins;
  await this.save();
};

// Instance method: Publish content
premiumContentSchema.methods.publish = async function() {
  if (!this.previewMediaUrl && this.mediaType === 'video') {
    throw new Error('Preview media required for video content');
  }
  this.is_published = true;
  await this.save();
};

// Instance method: Unpublish content
premiumContentSchema.methods.unpublish = async function() {
  this.is_published = false;
  await this.save();
};

// Instance method: Soft delete
premiumContentSchema.methods.softDelete = async function() {
  this.is_deleted = true;
  this.is_published = false;
  await this.save();
};

// Static method: Get published content with pagination
premiumContentSchema.statics.getBrowsable = async function(options = {}) {
  const {
    category,
    creatorId,
    tags,
    searchQuery,
    sortBy = 'recent', // recent, popular, trending
    page = 1,
    limit = 20
  } = options;

  const query = {
    is_published: true,
    is_deleted: false
  };

  if (category) query.category = category;
  if (creatorId) query.creatorId = creatorId;
  if (tags && tags.length) query.tags = { $in: tags };
  if (searchQuery) {
    query.$or = [
      { title: { $regex: searchQuery, $options: 'i' } },
      { description: { $regex: searchQuery, $options: 'i' } },
      { tags: { $regex: searchQuery, $options: 'i' } }
    ];
  }

  let sort = {};
  switch (sortBy) {
    case 'popular':
      sort = { 'stats.unlocks': -1, 'stats.views': -1 };
      break;
    case 'trending':
      sort = { 'stats.views': -1, createdAt: -1 };
      break;
    case 'price_low':
      sort = { price_coins: 1 };
      break;
    case 'price_high':
      sort = { price_coins: -1 };
      break;
    default: // recent
      sort = { createdAt: -1 };
  }

  const skip = (page - 1) * limit;

  const [contents, total] = await Promise.all([
    this.find(query)
      .populate('creatorId', 'username profilePhoto category')
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean(),
    this.countDocuments(query)
  ]);

  return {
    contents,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  };
};

// Static method: Get creator's content
premiumContentSchema.statics.getCreatorContent = async function(creatorId, options = {}) {
  const {
    includeUnpublished = false,
    page = 1,
    limit = 20
  } = options;

  const query = {
    creatorId,
    is_deleted: false
  };

  if (!includeUnpublished) {
    query.is_published = true;
  }

  const skip = (page - 1) * limit;

  const [contents, total] = await Promise.all([
    this.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    this.countDocuments(query)
  ]);

  return {
    contents,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  };
};

// Static method: Get trending content
premiumContentSchema.statics.getTrending = async function(limit = 10) {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  return await this.find({
    is_published: true,
    is_deleted: false,
    createdAt: { $gte: oneDayAgo }
  })
    .populate('creatorId', 'username profilePhoto')
    .sort({ 'stats.views': -1, 'stats.unlocks': -1 })
    .limit(limit)
    .lean();
};

// Static method: Get recommendations for user (based on previous unlocks/views)
premiumContentSchema.statics.getRecommendations = async function(userId, limit = 10) {
  // TODO: Implement collaborative filtering based on user's unlock history
  // For now, return popular content from categories user has engaged with
  
  return await this.find({
    is_published: true,
    is_deleted: false
  })
    .populate('creatorId', 'username profilePhoto')
    .sort({ 'stats.unlocks': -1 })
    .limit(limit)
    .lean();
};

module.exports = mongoose.model('PremiumContent', premiumContentSchema);
