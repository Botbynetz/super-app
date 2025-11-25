/**
 * Cron Job: Process Expired Subscriptions
 * 
 * This script should be run daily (e.g., at 00:00 UTC) to:
 * 1. Mark expired subscriptions as 'expired'
 * 2. Remove subscribers from premium content allowed_subscribers arrays
 * 3. Log results for monitoring
 * 
 * Usage:
 *   node backend/jobs/processExpiredSubscriptions.js
 * 
 * Crontab entry (daily at midnight):
 *   0 0 * * * cd /path/to/super-app && node backend/jobs/processExpiredSubscriptions.js >> logs/cron.log 2>&1
 */

const mongoose = require('mongoose');
require('dotenv').config();

const SubscriptionService = require('../services/SubscriptionService');

async function main() {
  try {
    console.log('[Cron] Starting expired subscriptions processing...');
    console.log('[Cron] Timestamp:', new Date().toISOString());
    
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('[Cron] MongoDB connected');
    
    // Process expired subscriptions
    const result = await SubscriptionService.processExpiredSubscriptions();
    
    console.log('[Cron] ✅ Processing complete');
    console.log(`[Cron] Subscriptions processed: ${result.processedCount}`);
    console.log(`[Cron] Access records removed: ${result.removedAccessCount}`);
    console.log(`[Cron] Duration: ${Date.now() - result.timestamp.getTime()}ms`);
    
    // Disconnect
    await mongoose.connection.close();
    console.log('[Cron] MongoDB disconnected');
    
    process.exit(0);
  } catch (error) {
    console.error('[Cron] ❌ Error processing expired subscriptions:', error);
    
    // Disconnect on error
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
    }
    
    process.exit(1);
  }
}

main();
