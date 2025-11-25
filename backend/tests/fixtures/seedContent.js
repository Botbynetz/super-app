/**
 * Test Fixtures - Seed Premium Content
 */

const PremiumContent = require('../../models/PremiumContent');

/**
 * Create test premium content
 * @param {Object} creatorIds - Map of creator usernames to their user IDs
 */
async function seedContent(creatorIds) {
  if (!creatorIds || !creatorIds.creator1 || !creatorIds.creator2) {
    throw new Error('Creator IDs required for seeding content');
  }

  const contents = [
    // Creator 1 Content
    {
      title: 'Premium Tutorial: Advanced Node.js',
      description: 'Learn advanced Node.js patterns and best practices. Includes event loop optimization, memory management, and clustering.',
      price_coins: 500,
      creatorId: creatorIds.creator1,
      category: 'education',
      mediaType: 'video',
      fullMediaUrl: 'https://cdn.test.com/videos/nodejs-advanced.mp4',
      previewMediaUrl: 'https://cdn.test.com/previews/nodejs-advanced-preview.mp4',
      is_published: true,
      subscriber_only: false,
      tags: ['nodejs', 'javascript', 'backend', 'tutorial'],
    },
    
    {
      title: 'Exclusive: MongoDB Performance Tips',
      description: 'Master MongoDB indexing, aggregation pipelines, and query optimization techniques.',
      price_coins: 300,
      creatorId: creatorIds.creator1,
      category: 'education',
      mediaType: 'article',
      fullMediaUrl: 'https://cdn.test.com/articles/mongodb-performance.pdf',
      previewMediaUrl: 'https://cdn.test.com/previews/mongodb-preview.jpg',
      is_published: true,
      subscriber_only: false,
      tags: ['mongodb', 'database', 'performance'],
    },
    
    {
      title: 'VIP Only: System Design Interview Prep',
      description: 'Comprehensive system design interview preparation for FAANG companies. Subscriber-only content.',
      price_coins: 1000,
      creatorId: creatorIds.creator1,
      category: 'education',
      mediaType: 'video',
      fullMediaUrl: 'https://cdn.test.com/videos/system-design-prep.mp4',
      previewMediaUrl: 'https://cdn.test.com/previews/system-design-preview.mp4',
      is_published: true,
      subscriber_only: true, // Only for subscribers
      tags: ['system-design', 'interview', 'career'],
    },
    
    {
      title: 'High Value: Complete AWS Certification Course',
      description: 'Full AWS Solutions Architect certification course. 40+ hours of content.',
      price_coins: 5000, // High value for fraud testing
      creatorId: creatorIds.creator1,
      category: 'education',
      mediaType: 'video',
      fullMediaUrl: 'https://cdn.test.com/videos/aws-cert.mp4',
      previewMediaUrl: 'https://cdn.test.com/previews/aws-cert-preview.mp4',
      is_published: true,
      subscriber_only: false,
      tags: ['aws', 'cloud', 'certification'],
    },
    
    // Creator 2 Content
    {
      title: 'React Hooks Masterclass',
      description: 'Deep dive into React Hooks with practical examples and custom hooks.',
      price_coins: 400,
      creatorId: creatorIds.creator2,
      category: 'education',
      mediaType: 'video',
      fullMediaUrl: 'https://cdn.test.com/videos/react-hooks.mp4',
      previewMediaUrl: 'https://cdn.test.com/previews/react-hooks-preview.mp4',
      is_published: true,
      subscriber_only: false,
      tags: ['react', 'javascript', 'frontend'],
    },
    
    {
      title: 'Docker & Kubernetes Guide',
      description: 'Container orchestration from basics to production deployment.',
      price_coins: 600,
      creatorId: creatorIds.creator2,
      category: 'education',
      mediaType: 'video',
      fullMediaUrl: 'https://cdn.test.com/videos/docker-k8s.mp4',
      previewMediaUrl: 'https://cdn.test.com/previews/docker-k8s-preview.mp4',
      is_published: true,
      subscriber_only: false,
      tags: ['docker', 'kubernetes', 'devops'],
    },
    
    {
      title: 'Free Sample: Git Best Practices',
      description: 'Free content for testing access control. Git workflow and collaboration tips.',
      price_coins: 0, // Free content
      creatorId: creatorIds.creator2,
      category: 'education',
      mediaType: 'article',
      fullMediaUrl: 'https://cdn.test.com/articles/git-practices.pdf',
      previewMediaUrl: 'https://cdn.test.com/previews/git-preview.jpg',
      is_published: true,
      subscriber_only: false,
      tags: ['git', 'version-control', 'collaboration'],
    },
    
    {
      title: 'Unpublished Draft: Testing Microservices',
      description: 'Draft content for testing visibility. Should not appear in browse.',
      price_coins: 250,
      creatorId: creatorIds.creator2,
      category: 'education',
      mediaType: 'article',
      fullMediaUrl: 'https://cdn.test.com/articles/microservices-testing.pdf',
      previewMediaUrl: null,
      is_published: false, // Unpublished
      subscriber_only: false,
      tags: ['microservices', 'testing', 'architecture'],
    },
  ];

  const createdContent = {};

  for (const contentData of contents) {
    const content = await PremiumContent.create(contentData);
    
    const key = contentData.title.split(':')[0].trim().replace(/\s+/g, '_').toLowerCase();
    createdContent[key] = {
      content,
      contentId: content._id.toString(),
      title: content.title,
      price_coins: content.price_coins,
      creatorId: content.creatorId.toString(),
      is_published: content.is_published,
      subscriber_only: content.subscriber_only,
    };

    console.log(`[SEED] ✓ Created content: ${contentData.title} (${content._id})`);
  }

  console.log(`[SEED] ✅ Seeded ${contents.length} premium content items`);
  return createdContent;
}

/**
 * Create subscription tiers for creators
 */
async function seedSubscriptionTiers(creatorIds) {
  // Subscription tiers are typically stored in the User model or separate SubscriptionTier model
  // For now, we'll return the default tiers that are handled in the SubscriptionService
  
  const tiers = {
    creator1: [
      { id: 'monthly', name: 'Monthly VIP', price_coins: 1000, duration_days: 30 },
      { id: 'quarterly', name: 'Quarterly VIP', price_coins: 2700, duration_days: 90 },
      { id: 'yearly', name: 'Yearly VIP', price_coins: 9600, duration_days: 365 },
    ],
    creator2: [
      { id: 'monthly', name: 'Monthly Premium', price_coins: 800, duration_days: 30 },
      { id: 'quarterly', name: 'Quarterly Premium', price_coins: 2160, duration_days: 90 },
      { id: 'yearly', name: 'Yearly Premium', price_coins: 7680, duration_days: 365 },
    ],
  };

  console.log('[SEED] ✅ Subscription tiers configured');
  return tiers;
}

module.exports = {
  seedContent,
  seedSubscriptionTiers,
};
