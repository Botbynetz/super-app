const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { body, param, query, validationResult } = require('express-validator');
const PremiumContent = require('../models/PremiumContent');
const PremiumContentService = require('../services/PremiumContentService');
const FraudGuard = require('../services/FraudGuard');

// Multer configuration for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Store in uploads/premium/{creatorId}/
    const uploadPath = path.join(__dirname, '../../uploads/premium', req.user.id);
    const fs = require('fs');
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    // Generate unique filename
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `content-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 500 * 1024 * 1024 // 500MB max
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|mp4|mov|avi|mp3|wav|pdf|doc|docx/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (extname && mimetype) {
      return cb(null, true);
    } else {
      cb(new Error('Invalid file type. Allowed: images, videos, audio, documents'));
    }
  }
});

// Middleware: Require authentication (assumes req.user is set by auth middleware)
const requireAuth = (req, res, next) => {
  if (!req.user || !req.user.id) {
    return res.status(401).json({
      code: 'UNAUTHORIZED',
      reason: 'Authentication required'
    });
  }
  next();
};

// Middleware: Rate limiting for expensive operations
const rateLimitCache = new Map();
const rateLimit = (maxRequests, windowMs) => {
  return (req, res, next) => {
    const userId = req.user?.id || req.ip;
    const now = Date.now();
    const userRequests = rateLimitCache.get(userId) || [];
    
    // Remove old requests outside window
    const validRequests = userRequests.filter(timestamp => now - timestamp < windowMs);
    
    if (validRequests.length >= maxRequests) {
      return res.status(429).json({
        code: 'RATE_LIMIT_EXCEEDED',
        reason: `Too many requests. Limit: ${maxRequests} per ${windowMs / 1000}s`,
        retryAfter: Math.ceil((validRequests[0] + windowMs - now) / 1000)
      });
    }
    
    validRequests.push(now);
    rateLimitCache.set(userId, validRequests);
    next();
  };
};

/**
 * POST /api/premium/create
 * Create new premium content (with file upload)
 */
router.post('/create',
  requireAuth,
  upload.single('media'),
  [
    body('title').trim().isLength({ min: 3, max: 200 }).withMessage('Title must be 3-200 characters'),
    body('description').trim().isLength({ min: 10, max: 2000 }).withMessage('Description must be 10-2000 characters'),
    body('category').isIn(['education', 'entertainment', 'business', 'technology', 'lifestyle', 'art', 'music', 'fitness', 'other']).withMessage('Invalid category'),
    body('price_coins').isInt({ min: 0 }).withMessage('Price must be a non-negative integer'),
    body('mediaType').isIn(['image', 'video', 'audio', 'document', 'course']).withMessage('Invalid media type'),
    body('subscriber_only').optional().isBoolean().withMessage('subscriber_only must be boolean'),
    body('tags').optional().isArray().withMessage('Tags must be an array')
  ],
  async (req, res) => {
    try {
      // Validation
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          code: 'VALIDATION_ERROR',
          reason: 'Invalid input',
          errors: errors.array()
        });
      }

      const { title, description, category, price_coins, mediaType, subscriber_only, tags, visibility } = req.body;
      const creatorId = req.user.id;

      // Create content record
      const content = await PremiumContent.create({
        creatorId,
        title,
        description,
        category,
        price_coins: parseInt(price_coins),
        mediaType,
        subscriber_only: subscriber_only === 'true' || subscriber_only === true,
        tags: tags ? (Array.isArray(tags) ? tags : JSON.parse(tags)) : [],
        visibility: visibility || 'public',
        fullMediaUrl: req.file ? `/uploads/premium/${creatorId}/${req.file.filename}` : null,
        previewMediaUrl: req.file ? `/uploads/premium/${creatorId}/${req.file.filename}` : null, // TODO: Generate actual preview
        thumbnailUrl: null, // TODO: Generate thumbnail
        is_published: false // Draft by default
      });

      res.status(201).json({
        success: true,
        content: {
          id: content._id,
          title: content.title,
          status: 'draft',
          message: 'Content created. Use /publish endpoint to make it available.'
        }
      });

    } catch (error) {
      console.error('Create content error:', error);
      res.status(error.status || 500).json({
        code: error.code || 'CREATE_CONTENT_FAILED',
        reason: error.reason || error.message || 'Failed to create content'
      });
    }
  }
);

/**
 * PUT /api/premium/:id/publish
 * Publish content (make available for purchase)
 */
router.put('/:id/publish',
  requireAuth,
  [
    param('id').isMongoId().withMessage('Invalid content ID')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          code: 'VALIDATION_ERROR',
          errors: errors.array()
        });
      }

      const content = await PremiumContent.findById(req.params.id);
      
      if (!content) {
        return res.status(404).json({
          code: 'CONTENT_NOT_FOUND',
          reason: 'Content does not exist'
        });
      }

      // Authorization check
      if (content.creatorId.toString() !== req.user.id) {
        return res.status(403).json({
          code: 'UNAUTHORIZED',
          reason: 'Only content owner can publish'
        });
      }

      if (content.is_published) {
        return res.status(400).json({
          code: 'ALREADY_PUBLISHED',
          reason: 'Content is already published'
        });
      }

      await content.publish();

      res.json({
        success: true,
        message: 'Content published successfully',
        content: {
          id: content._id,
          title: content.title,
          is_published: true
        }
      });

    } catch (error) {
      console.error('Publish content error:', error);
      res.status(error.status || 500).json({
        code: error.code || 'PUBLISH_FAILED',
        reason: error.reason || error.message
      });
    }
  }
);

/**
 * GET /api/premium/:id
 * Get premium content details (with access control)
 */
router.get('/:id',
  [
    param('id').isMongoId().withMessage('Invalid content ID')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          code: 'VALIDATION_ERROR',
          errors: errors.array()
        });
      }

      const viewerId = req.user?.id || null;
      const contentDetails = await PremiumContentService.getPremiumContentDetails(req.params.id, viewerId);

      // Increment view count (async, don't wait)
      PremiumContentService.incrementView(req.params.id).catch(err => 
        console.error('Failed to increment view:', err)
      );

      res.json({
        success: true,
        content: contentDetails
      });

    } catch (error) {
      console.error('Get content error:', error);
      res.status(error.status || 500).json({
        code: error.code || 'GET_CONTENT_FAILED',
        reason: error.reason || error.message
      });
    }
  }
);

/**
 * GET /api/premium/browse
 * Browse premium content with filters, sorting, pagination
 */
router.get('/browse',
  [
    query('category').optional().isString().withMessage('Category must be string'),
    query('creatorId').optional().isMongoId().withMessage('Invalid creator ID'),
    query('tags').optional().isString().withMessage('Tags must be comma-separated string'),
    query('searchQuery').optional().isString().withMessage('Search query must be string'),
    query('sort').optional().isIn(['recent', 'popular', 'trending', 'price_low', 'price_high']).withMessage('Invalid sort option'),
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be positive integer'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be 1-100')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          code: 'VALIDATION_ERROR',
          errors: errors.array()
        });
      }

      const options = {
        category: req.query.category,
        creatorId: req.query.creatorId,
        tags: req.query.tags ? req.query.tags.split(',') : undefined,
        searchQuery: req.query.searchQuery,
        sort: req.query.sort || 'recent',
        page: parseInt(req.query.page) || 1,
        limit: parseInt(req.query.limit) || 20
      };

      const result = await PremiumContentService.browseContent(options);

      res.json({
        success: true,
        ...result
      });

    } catch (error) {
      console.error('Browse content error:', error);
      res.status(error.status || 500).json({
        code: error.code || 'BROWSE_FAILED',
        reason: error.reason || error.message
      });
    }
  }
);

/**
 * POST /api/premium/:id/unlock
 * Unlock premium content (atomic transaction with fraud check)
 */
router.post('/:id/unlock',
  requireAuth,
  rateLimit(5, 60000), // Max 5 unlocks per minute
  [
    param('id').isMongoId().withMessage('Invalid content ID'),
    body('idempotencyKey').optional().isString().withMessage('Idempotency key must be string')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          code: 'VALIDATION_ERROR',
          errors: errors.array()
        });
      }

      const userId = req.user.id;
      const contentId = req.params.id;
      const idempotencyKey = req.body.idempotencyKey;

      // Get content to check price for fraud detection
      const content = await PremiumContent.findById(contentId);
      if (!content) {
        return res.status(404).json({
          code: 'CONTENT_NOT_FOUND',
          reason: 'Content does not exist'
        });
      }

      // Fraud check
      const fraudCheck = await FraudGuard.checkUnlockAllowed(userId, contentId, content.price_coins);
      if (!fraudCheck.allowed) {
        return res.status(403).json({
          code: 'FRAUD_CHECK_FAILED',
          reason: fraudCheck.reason,
          riskScore: fraudCheck.riskScore,
          action: fraudCheck.action
        });
      }

      // Perform unlock transaction
      const result = await PremiumContentService.unlockContent(
        userId,
        contentId,
        idempotencyKey,
        {
          ip: req.ip,
          userAgent: req.get('user-agent'),
          device: req.get('x-device-info')
        }
      );

      // TODO: Emit Socket.io event PREMIUM_UNLOCKED

      res.json({
        success: true,
        message: 'Content unlocked successfully',
        unlock: {
          unlockId: result.unlockRecord.unlockId,
          amount_coins: result.unlockRecord.amount_coins,
          amount_rupiah: result.unlockRecord.amount_coins * 100,
          accessGranted: result.accessGranted
        },
        content: {
          id: contentId,
          title: content.title
        },
        idempotent: result.idempotent || false
      });

    } catch (error) {
      console.error('Unlock content error:', error);
      res.status(error.status || 500).json({
        code: error.code || 'UNLOCK_FAILED',
        reason: error.reason || error.message
      });
    }
  }
);

/**
 * GET /api/premium/:id/preview
 * Get preview media URL (public access)
 */
router.get('/:id/preview',
  [
    param('id').isMongoId().withMessage('Invalid content ID')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          code: 'VALIDATION_ERROR',
          errors: errors.array()
        });
      }

      const content = await PremiumContent.findById(req.params.id);
      
      if (!content || !content.is_published) {
        return res.status(404).json({
          code: 'CONTENT_NOT_FOUND',
          reason: 'Content not available'
        });
      }

      res.json({
        success: true,
        preview: {
          previewMediaUrl: content.previewMediaUrl,
          thumbnailUrl: content.thumbnailUrl,
          duration_seconds: content.duration_seconds,
          mediaType: content.mediaType
        }
      });

    } catch (error) {
      console.error('Get preview error:', error);
      res.status(error.status || 500).json({
        code: error.code || 'GET_PREVIEW_FAILED',
        reason: error.reason || error.message
      });
    }
  }
);

/**
 * GET /api/premium/my-content
 * Get creator's own content (published + unpublished)
 */
router.get('/my-content',
  requireAuth,
  [
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be positive integer'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be 1-100')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          code: 'VALIDATION_ERROR',
          errors: errors.array()
        });
      }

      const options = {
        page: parseInt(req.query.page) || 1,
        limit: parseInt(req.query.limit) || 20,
        includeUnpublished: true
      };

      const result = await PremiumContent.getCreatorContent(req.user.id, options);

      res.json({
        success: true,
        ...result
      });

    } catch (error) {
      console.error('Get my content error:', error);
      res.status(error.status || 500).json({
        code: error.code || 'GET_MY_CONTENT_FAILED',
        reason: error.reason || error.message
      });
    }
  }
);

/**
 * PUT /api/premium/:id/edit
 * Edit content metadata (creator only)
 */
router.put('/:id/edit',
  requireAuth,
  [
    param('id').isMongoId().withMessage('Invalid content ID'),
    body('title').optional().trim().isLength({ min: 3, max: 200 }).withMessage('Title must be 3-200 characters'),
    body('description').optional().trim().isLength({ min: 10, max: 2000 }).withMessage('Description must be 10-2000 characters'),
    body('price_coins').optional().isInt({ min: 0 }).withMessage('Price must be non-negative'),
    body('tags').optional().isArray().withMessage('Tags must be array')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          code: 'VALIDATION_ERROR',
          errors: errors.array()
        });
      }

      const content = await PremiumContent.findById(req.params.id);
      
      if (!content) {
        return res.status(404).json({
          code: 'CONTENT_NOT_FOUND',
          reason: 'Content does not exist'
        });
      }

      // Authorization
      if (content.creatorId.toString() !== req.user.id) {
        return res.status(403).json({
          code: 'UNAUTHORIZED',
          reason: 'Only content owner can edit'
        });
      }

      // Update allowed fields
      const updates = {};
      if (req.body.title) updates.title = req.body.title;
      if (req.body.description) updates.description = req.body.description;
      if (req.body.price_coins !== undefined) updates.price_coins = parseInt(req.body.price_coins);
      if (req.body.tags) updates.tags = req.body.tags;

      await PremiumContent.updateOne({ _id: req.params.id }, { $set: updates });

      res.json({
        success: true,
        message: 'Content updated successfully'
      });

    } catch (error) {
      console.error('Edit content error:', error);
      res.status(error.status || 500).json({
        code: error.code || 'EDIT_FAILED',
        reason: error.reason || error.message
      });
    }
  }
);

/**
 * DELETE /api/premium/:id
 * Soft delete content (creator only)
 */
router.delete('/:id',
  requireAuth,
  [
    param('id').isMongoId().withMessage('Invalid content ID')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          code: 'VALIDATION_ERROR',
          errors: errors.array()
        });
      }

      const content = await PremiumContent.findById(req.params.id);
      
      if (!content) {
        return res.status(404).json({
          code: 'CONTENT_NOT_FOUND',
          reason: 'Content does not exist'
        });
      }

      // Authorization
      if (content.creatorId.toString() !== req.user.id) {
        return res.status(403).json({
          code: 'UNAUTHORIZED',
          reason: 'Only content owner can delete'
        });
      }

      await content.softDelete();

      res.json({
        success: true,
        message: 'Content deleted successfully'
      });

    } catch (error) {
      console.error('Delete content error:', error);
      res.status(error.status || 500).json({
        code: error.code || 'DELETE_FAILED',
        reason: error.reason || error.message
      });
    }
  }
);

module.exports = router;
