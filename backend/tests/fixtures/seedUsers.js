/**
 * Test Fixtures - Seed Users
 */

const bcrypt = require('bcryptjs');
const User = require('../../models/User');
const Wallet = require('../../models/Wallet');
const CreatorRevenue = require('../../models/CreatorRevenue');

/**
 * Create test users with wallets
 */
async function seedUsers() {
  const hashedPassword = await bcrypt.hash('Test123!@#', 10);

  const users = [
    // Buyer 1 - Rich user with 10,000 coins
    {
      username: 'buyer1',
      email: 'buyer1@test.com',
      password: hashedPassword,
      fullName: 'Buyer One',
      role: 'user',
      wallet: {
        balance_coins: 10000,
        is_frozen: false,
      },
    },
    
    // Buyer 2 - Medium balance 2,000 coins
    {
      username: 'buyer2',
      email: 'buyer2@test.com',
      password: hashedPassword,
      fullName: 'Buyer Two',
      role: 'user',
      wallet: {
        balance_coins: 2000,
        is_frozen: false,
      },
    },
    
    // Buyer 3 - Low balance 500 coins
    {
      username: 'buyer3',
      email: 'buyer3@test.com',
      password: hashedPassword,
      fullName: 'Buyer Three',
      role: 'user',
      wallet: {
        balance_coins: 500,
        is_frozen: false,
      },
    },
    
    // Creator 1 - Verified creator with content
    {
      username: 'creator1',
      email: 'creator1@test.com',
      password: hashedPassword,
      fullName: 'Creator One',
      role: 'creator',
      is_verified: true,
      wallet: {
        balance_coins: 5000,
        is_frozen: false,
      },
      creatorRevenue: {
        available_coins: 0,
        pending_coins: 0,
        withdrawn_coins: 0,
        payment_info_verified: true,
        payment_details: {
          accountNumber: '1234567890',
          bankName: 'BCA',
          accountName: 'Creator One',
        },
      },
    },
    
    // Creator 2 - Another creator
    {
      username: 'creator2',
      email: 'creator2@test.com',
      password: hashedPassword,
      fullName: 'Creator Two',
      role: 'creator',
      is_verified: true,
      wallet: {
        balance_coins: 3000,
        is_frozen: false,
      },
      creatorRevenue: {
        available_coins: 0,
        pending_coins: 0,
        withdrawn_coins: 0,
        payment_info_verified: true,
        payment_details: {
          accountNumber: '0987654321',
          bankName: 'Mandiri',
          accountName: 'Creator Two',
        },
      },
    },
    
    // Admin user
    {
      username: 'admin',
      email: 'admin@test.com',
      password: hashedPassword,
      fullName: 'Admin User',
      role: 'admin',
      wallet: {
        balance_coins: 100000,
        is_frozen: false,
      },
    },
    
    // Platform wallet (system account)
    {
      username: 'platform',
      email: 'platform@test.com',
      password: hashedPassword,
      fullName: 'Platform Wallet',
      role: 'system',
      wallet: {
        balance_coins: 0,
        is_frozen: false,
      },
    },
    
    // Processing wallet (system account)
    {
      username: 'processing',
      email: 'processing@test.com',
      password: hashedPassword,
      fullName: 'Processing Fee Wallet',
      role: 'system',
      wallet: {
        balance_coins: 0,
        is_frozen: false,
      },
    },
    
    // Fraudster - For fraud testing (initially normal)
    {
      username: 'fraudster',
      email: 'fraudster@test.com',
      password: hashedPassword,
      fullName: 'Fraudulent User',
      role: 'user',
      wallet: {
        balance_coins: 50000, // High balance for testing velocity
        is_frozen: false,
      },
    },
    
    // Poor buyer - For insufficient balance tests
    {
      username: 'poorbuyer',
      email: 'poorbuyer@test.com',
      password: hashedPassword,
      fullName: 'Poor Buyer',
      role: 'user',
      wallet: {
        balance_coins: 10,
        is_frozen: false,
      },
    },
  ];

  const createdUsers = {};

  for (const userData of users) {
    // Create user
    const user = await User.create({
      username: userData.username,
      email: userData.email,
      password: userData.password,
      fullName: userData.fullName,
      role: userData.role,
      is_verified: userData.is_verified || false,
    });

    // Create wallet
    const wallet = await Wallet.create({
      userId: user._id,
      balance_coins: userData.wallet.balance_coins,
      is_frozen: userData.wallet.is_frozen,
      statistics: {
        total_deposited_coins: userData.wallet.balance_coins,
        total_withdrawn_coins: 0,
        total_spent_coins: 0,
        total_earned_coins: 0,
      },
    });

    // Create creator revenue record if creator
    if (userData.creatorRevenue) {
      await CreatorRevenue.create({
        creatorId: user._id,
        available_coins: userData.creatorRevenue.available_coins,
        pending_coins: userData.creatorRevenue.pending_coins,
        withdrawn_coins: userData.creatorRevenue.withdrawn_coins,
        payment_info_verified: userData.creatorRevenue.payment_info_verified,
        payment_details: userData.creatorRevenue.payment_details,
        lifetime: {
          total_earned_coins: 0,
          total_unlocks: 0,
          total_subscribers: 0,
        },
      });
    }

    createdUsers[userData.username] = {
      user,
      wallet,
      userId: user._id.toString(),
      walletId: wallet._id.toString(),
    };

    console.log(`[SEED] ✓ Created user: ${userData.username} (${user._id})`);
  }

  console.log(`[SEED] ✅ Seeded ${users.length} users with wallets`);
  return createdUsers;
}

/**
 * Get test user credentials
 */
function getTestCredentials() {
  return {
    buyer1: { username: 'buyer1', password: 'Test123!@#' },
    buyer2: { username: 'buyer2', password: 'Test123!@#' },
    buyer3: { username: 'buyer3', password: 'Test123!@#' },
    creator1: { username: 'creator1', password: 'Test123!@#' },
    creator2: { username: 'creator2', password: 'Test123!@#' },
    admin: { username: 'admin', password: 'Test123!@#' },
    fraudster: { username: 'fraudster', password: 'Test123!@#' },
    poorbuyer: { username: 'poorbuyer', password: 'Test123!@#' },
  };
}

module.exports = {
  seedUsers,
  getTestCredentials,
};
