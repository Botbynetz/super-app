/**
 * Database Cleanup Utility for Integration Tests
 */

const mongoose = require('mongoose');

// Import all models
const User = require('../../models/User');
const Wallet = require('../../models/Wallet');
const WalletTransaction = require('../../models/WalletTransaction');
const PremiumContent = require('../../models/PremiumContent');
const PremiumUnlock = require('../../models/PremiumUnlock');
const Subscription = require('../../models/Subscription');
const CreatorRevenue = require('../../models/CreatorRevenue');
const AuditLog = require('../../models/AuditLog');

/**
 * Clean all test data from database
 */
async function cleanupAllCollections() {
  try {
    console.log('[CLEANUP] Starting database cleanup...');

    // Delete in order to respect foreign key constraints
    await AuditLog.deleteMany({});
    console.log('[CLEANUP] ✓ AuditLog cleared');

    await WalletTransaction.deleteMany({});
    console.log('[CLEANUP] ✓ WalletTransaction cleared');

    await PremiumUnlock.deleteMany({});
    console.log('[CLEANUP] ✓ PremiumUnlock cleared');

    await Subscription.deleteMany({});
    console.log('[CLEANUP] ✓ Subscription cleared');

    await PremiumContent.deleteMany({});
    console.log('[CLEANUP] ✓ PremiumContent cleared');

    await CreatorRevenue.deleteMany({});
    console.log('[CLEANUP] ✓ CreatorRevenue cleared');

    await Wallet.deleteMany({});
    console.log('[CLEANUP] ✓ Wallet cleared');

    await User.deleteMany({});
    console.log('[CLEANUP] ✓ User cleared');

    console.log('[CLEANUP] ✅ All collections cleaned successfully');
  } catch (error) {
    console.error('[CLEANUP] ❌ Error during cleanup:', error);
    throw error;
  }
}

/**
 * Clean specific collections
 */
async function cleanupCollections(collectionNames = []) {
  const models = {
    users: User,
    wallets: Wallet,
    wallettransactions: WalletTransaction,
    premiumcontents: PremiumContent,
    premiumunlocks: PremiumUnlock,
    subscriptions: Subscription,
    creatorrevenues: CreatorRevenue,
    auditlogs: AuditLog,
  };

  for (const name of collectionNames) {
    const model = models[name.toLowerCase()];
    if (model) {
      await model.deleteMany({});
      console.log(`[CLEANUP] ✓ ${name} cleared`);
    }
  }
}

/**
 * Drop entire test database (use with caution!)
 */
async function dropTestDatabase() {
  if (!process.env.MONGODB_URI_TEST || !process.env.MONGODB_URI_TEST.includes('test')) {
    throw new Error('Cannot drop database: Not a test database!');
  }

  try {
    await mongoose.connection.dropDatabase();
    console.log('[CLEANUP] ✅ Test database dropped');
  } catch (error) {
    console.error('[CLEANUP] ❌ Error dropping database:', error);
    throw error;
  }
}

/**
 * Reset auto-increment counters (if using)
 */
async function resetCounters() {
  // If you're using any counter collections for auto-incrementing IDs
  // Reset them here
  console.log('[CLEANUP] ✓ Counters reset');
}

/**
 * Create database snapshot for quick restore
 */
async function createSnapshot(snapshotName = 'default') {
  const collections = await mongoose.connection.db.listCollections().toArray();
  const snapshot = {};

  for (const collection of collections) {
    const docs = await mongoose.connection.db
      .collection(collection.name)
      .find({})
      .toArray();
    snapshot[collection.name] = docs;
  }

  // Store in memory (for tests) or file system
  global.__testSnapshots = global.__testSnapshots || {};
  global.__testSnapshots[snapshotName] = snapshot;

  console.log(`[CLEANUP] ✓ Snapshot created: ${snapshotName}`);
  return snapshot;
}

/**
 * Restore database from snapshot
 */
async function restoreSnapshot(snapshotName = 'default') {
  if (!global.__testSnapshots || !global.__testSnapshots[snapshotName]) {
    throw new Error(`Snapshot not found: ${snapshotName}`);
  }

  const snapshot = global.__testSnapshots[snapshotName];

  // Clear current data
  await cleanupAllCollections();

  // Restore from snapshot
  for (const [collectionName, docs] of Object.entries(snapshot)) {
    if (docs.length > 0) {
      await mongoose.connection.db.collection(collectionName).insertMany(docs);
      console.log(`[CLEANUP] ✓ Restored ${collectionName}: ${docs.length} docs`);
    }
  }

  console.log(`[CLEANUP] ✅ Snapshot restored: ${snapshotName}`);
}

module.exports = {
  cleanupAllCollections,
  cleanupCollections,
  dropTestDatabase,
  resetCounters,
  createSnapshot,
  restoreSnapshot,
};
