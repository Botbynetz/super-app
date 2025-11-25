/**
 * Test Fixtures - Seed Creator Revenue Data
 */

const CreatorRevenue = require('../../models/CreatorRevenue');

/**
 * Seed creator revenue records with test data
 * @param {Object} creatorIds - Map of creator usernames to their user IDs
 */
async function seedCreatorRevenue(creatorIds) {
  if (!creatorIds || !creatorIds.creator1 || !creatorIds.creator2) {
    throw new Error('Creator IDs required for seeding revenue');
  }

  const revenueData = [
    // Creator 1 - Has some pending revenue
    {
      creatorId: creatorIds.creator1,
      available_coins: 5000, // Can withdraw
      pending_coins: 2000, // Locked for 7 days
      withdrawn_coins: 10000, // Historical
      payment_info_verified: true,
      payment_details: {
        accountNumber: '1234567890',
        bankName: 'BCA',
        accountName: 'Creator One',
      },
      lifetime: {
        total_earned_coins: 17000, // available + pending + withdrawn
        total_unlocks: 34, // 17000 / 500 average
        total_subscribers: 12,
      },
      monthly: {
        current_month_earnings: 2000,
        last_month_earnings: 5000,
      },
      sources: {
        unlocks_earned_coins: 12000,
        subscriptions_earned_coins: 5000,
      },
    },
    
    // Creator 2 - Starting fresh
    {
      creatorId: creatorIds.creator2,
      available_coins: 0,
      pending_coins: 0,
      withdrawn_coins: 0,
      payment_info_verified: true,
      payment_details: {
        accountNumber: '0987654321',
        bankName: 'Mandiri',
        accountName: 'Creator Two',
      },
      lifetime: {
        total_earned_coins: 0,
        total_unlocks: 0,
        total_subscribers: 0,
      },
      monthly: {
        current_month_earnings: 0,
        last_month_earnings: 0,
      },
      sources: {
        unlocks_earned_coins: 0,
        subscriptions_earned_coins: 0,
      },
    },
  ];

  const createdRevenue = {};

  for (const data of revenueData) {
    // Update existing or create new
    const revenue = await CreatorRevenue.findOneAndUpdate(
      { creatorId: data.creatorId },
      data,
      { upsert: true, new: true }
    );

    const creatorKey = Object.keys(creatorIds).find(
      key => creatorIds[key].toString() === data.creatorId.toString()
    );

    createdRevenue[creatorKey] = {
      revenue,
      revenueId: revenue._id.toString(),
      available_coins: revenue.available_coins,
      pending_coins: revenue.pending_coins,
    };

    console.log(`[SEED] ✓ Created revenue record for: ${creatorKey} (${revenue._id})`);
  }

  console.log(`[SEED] ✅ Seeded ${revenueData.length} creator revenue records`);
  return createdRevenue;
}

/**
 * Add pending revenue for testing settlement
 */
async function addPendingRevenue(creatorId, amount_coins) {
  const revenue = await CreatorRevenue.findOne({ creatorId });
  if (!revenue) {
    throw new Error(`CreatorRevenue not found for creatorId: ${creatorId}`);
  }

  revenue.pending_coins += amount_coins;
  revenue.lifetime.total_earned_coins += amount_coins;
  revenue.monthly.current_month_earnings += amount_coins;
  
  await revenue.save();
  
  console.log(`[SEED] ✓ Added ${amount_coins} pending coins for creator: ${creatorId}`);
  return revenue;
}

/**
 * Move pending to available (simulate settlement)
 */
async function settlePendingRevenue(creatorId) {
  const revenue = await CreatorRevenue.findOne({ creatorId });
  if (!revenue) {
    throw new Error(`CreatorRevenue not found for creatorId: ${creatorId}`);
  }

  const settled = revenue.pending_coins;
  revenue.available_coins += settled;
  revenue.pending_coins = 0;
  
  await revenue.save();
  
  console.log(`[SEED] ✓ Settled ${settled} coins for creator: ${creatorId}`);
  return revenue;
}

module.exports = {
  seedCreatorRevenue,
  addPendingRevenue,
  settlePendingRevenue,
};
