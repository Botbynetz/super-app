/**
 * Phase 7 Database Performance Migration
 * Adds strategic indexes to optimize query performance
 * 
 * Run: node migrations/phase7_add_indexes.js
 */

require('dotenv').config();
const mongoose = require('mongoose');

const INDEXES = {
  users: [
    { fields: { email: 1 }, options: { unique: true, sparse: true } },
    { fields: { phoneNumber: 1 }, options: { unique: true, sparse: true } },
    { fields: { username: 1 }, options: { unique: true, sparse: true } },
    { fields: { role: 1 }, options: {} },
    { fields: { 'verification.status': 1 }, options: {} },
    { fields: { createdAt: -1 }, options: {} },
    // Compound index for admin queries
    { fields: { role: 1, createdAt: -1 }, options: {} }
  ],
  
  wallets: [
    { fields: { userId: 1 }, options: { unique: true } },
    { fields: { status: 1 }, options: {} },
    { fields: { balance_cents: -1 }, options: {} },
    // For transaction history queries
    { fields: { userId: 1, updatedAt: -1 }, options: {} }
  ],
  
  transactions: [
    { fields: { userId: 1, createdAt: -1 }, options: {} },
    { fields: { type: 1, createdAt: -1 }, options: {} },
    { fields: { status: 1 }, options: {} },
    { fields: { idempotencyKey: 1 }, options: { unique: true, sparse: true } },
    // For revenue analytics
    { fields: { type: 1, status: 1, createdAt: -1 }, options: {} },
    // For wallet history
    { fields: { userId: 1, status: 1, createdAt: -1 }, options: {} },
    // For detecting duplicate transactions
    { fields: { userId: 1, type: 1, amount_cents: 1, createdAt: 1 }, options: {} }
  ],
  
  contents: [
    { fields: { creatorId: 1, createdAt: -1 }, options: {} },
    { fields: { isPremium: 1, status: 1 }, options: {} },
    { fields: { category: 1, createdAt: -1 }, options: {} },
    { fields: { 'statistics.views': -1 }, options: {} },
    { fields: { 'statistics.likes': -1 }, options: {} },
    // For premium content discovery
    { fields: { isPremium: 1, status: 1, createdAt: -1 }, options: {} },
    // For creator dashboard
    { fields: { creatorId: 1, status: 1, createdAt: -1 }, options: {} }
  ],
  
  subscriptions: [
    { fields: { userId: 1, status: 1 }, options: {} },
    { fields: { creatorId: 1, status: 1 }, options: {} },
    { fields: { expiresAt: 1 }, options: {} },
    { fields: { status: 1, expiresAt: 1 }, options: {} },
    // For renewal processing
    { fields: { status: 1, expiresAt: 1, autoRenew: 1 }, options: {} },
    // Compound index for user subscription lookup
    { fields: { userId: 1, creatorId: 1, status: 1 }, options: {} },
    // For creator subscriber list
    { fields: { creatorId: 1, status: 1, createdAt: -1 }, options: {} }
  ],
  
  auditlogs: [
    { fields: { userId: 1, createdAt: -1 }, options: {} },
    { fields: { action: 1, createdAt: -1 }, options: {} },
    { fields: { level: 1, createdAt: -1 }, options: {} },
    { fields: { 'metadata.fraudScore': -1 }, options: { sparse: true } },
    // For fraud detection queries
    { fields: { userId: 1, action: 1, createdAt: -1 }, options: {} },
    { fields: { level: 1, action: 1, createdAt: -1 }, options: {} },
    // TTL index - auto-delete logs after 90 days
    { fields: { createdAt: 1 }, options: { expireAfterSeconds: 7776000 } }
  ],
  
  creatorrevenues: [
    { fields: { creatorId: 1, status: 1 }, options: {} },
    { fields: { status: 1, createdAt: -1 }, options: {} },
    // For payout processing
    { fields: { status: 1, pendingAmount_cents: -1 }, options: {} },
    // For creator dashboard
    { fields: { creatorId: 1, status: 1, updatedAt: -1 }, options: {} }
  ],
  
  messages: [
    { fields: { chatId: 1, createdAt: -1 }, options: {} },
    { fields: { sender: 1, createdAt: -1 }, options: {} },
    // For unread message count
    { fields: { chatId: 1, read: 1 }, options: {} }
  ],
  
  chats: [
    { fields: { participants: 1 }, options: {} },
    { fields: { lastMessageAt: -1 }, options: {} },
    // For user chat list
    { fields: { participants: 1, lastMessageAt: -1 }, options: {} }
  ],
  
  unlockrecords: [
    { fields: { userId: 1, contentId: 1 }, options: { unique: true } },
    { fields: { userId: 1, createdAt: -1 }, options: {} },
    { fields: { contentId: 1, createdAt: -1 }, options: {} },
    // For revenue split calculation
    { fields: { contentId: 1, status: 1 }, options: {} }
  ],
  
  gifts: [
    { fields: { senderId: 1, createdAt: -1 }, options: {} },
    { fields: { recipientId: 1, createdAt: -1 }, options: {} },
    { fields: { giftType: 1, createdAt: -1 }, options: {} },
    // For leaderboard
    { fields: { recipientId: 1, createdAt: -1, coins: -1 }, options: {} }
  ]
};

async function createIndexes() {
  try {
    console.log('🔗 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000
    });
    console.log('✅ Connected to MongoDB');

    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();
    const collectionNames = collections.map(c => c.name);

    let totalCreated = 0;
    let totalSkipped = 0;
    let totalErrors = 0;

    for (const [collectionName, indexes] of Object.entries(INDEXES)) {
      console.log(`\n📊 Processing collection: ${collectionName}`);

      if (!collectionNames.includes(collectionName)) {
        console.log(`  ⚠️  Collection "${collectionName}" does not exist. Skipping...`);
        continue;
      }

      const collection = db.collection(collectionName);

      // Get existing indexes
      const existingIndexes = await collection.indexes();
      const existingIndexNames = existingIndexes.map(idx => idx.name);

      for (const indexSpec of indexes) {
        const { fields, options } = indexSpec;
        
        // Generate index name
        const indexName = Object.keys(fields)
          .map(key => `${key}_${fields[key]}`)
          .join('_');

        try {
          // Check if index already exists
          const exists = existingIndexes.some(idx => {
            if (idx.name === indexName) return true;
            // Check if the key pattern matches
            const idxKeys = Object.keys(idx.key);
            const specKeys = Object.keys(fields);
            if (idxKeys.length !== specKeys.length) return false;
            return idxKeys.every((key, i) => key === specKeys[i] && idx.key[key] === fields[specKeys[i]]);
          });

          if (exists) {
            console.log(`  ⏭️  Index "${indexName}" already exists`);
            totalSkipped++;
            continue;
          }

          // Create index
          await collection.createIndex(fields, { ...options, name: indexName });
          console.log(`  ✅ Created index: ${indexName}`);
          totalCreated++;

        } catch (error) {
          if (error.code === 85 || error.codeName === 'IndexOptionsConflict') {
            console.log(`  ⚠️  Index conflict for "${indexName}" - may need manual intervention`);
            totalSkipped++;
          } else {
            console.error(`  ❌ Error creating index "${indexName}":`, error.message);
            totalErrors++;
          }
        }
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('📊 MIGRATION SUMMARY');
    console.log('='.repeat(60));
    console.log(`✅ Indexes created: ${totalCreated}`);
    console.log(`⏭️  Indexes skipped: ${totalSkipped}`);
    console.log(`❌ Errors: ${totalErrors}`);
    console.log('='.repeat(60));

    if (totalErrors === 0) {
      console.log('\n🎉 Migration completed successfully!');
    } else {
      console.log('\n⚠️  Migration completed with some errors. Please review the log above.');
    }

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

// Rollback function (drops all indexes except _id)
async function rollbackIndexes() {
  try {
    console.log('🔗 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000
    });
    console.log('✅ Connected to MongoDB');

    const db = mongoose.connection.db;
    
    for (const collectionName of Object.keys(INDEXES)) {
      console.log(`\n🗑️  Rolling back indexes for: ${collectionName}`);
      
      try {
        const collection = db.collection(collectionName);
        const indexes = await collection.indexes();
        
        for (const index of indexes) {
          // Don't drop the _id index
          if (index.name === '_id_') continue;
          
          await collection.dropIndex(index.name);
          console.log(`  ✅ Dropped index: ${index.name}`);
        }
      } catch (error) {
        console.error(`  ❌ Error rolling back ${collectionName}:`, error.message);
      }
    }

    console.log('\n✅ Rollback completed');

  } catch (error) {
    console.error('❌ Rollback failed:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Disconnected from MongoDB');
  }
}

// CLI interface
const command = process.argv[2];

if (command === 'rollback') {
  console.log('🔄 Starting rollback...\n');
  rollbackIndexes();
} else {
  console.log('🚀 Starting migration...\n');
  createIndexes();
}
