/**
 * Integration Tests - Revenue Settlement Flow
 * Tests creator revenue settlement from pending to available
 */

const request = require('supertest');
const mongoose = require('mongoose');
const { startTestServer, stopTestServer } = require('../utils/testServer');
const { createAuthenticatedClient } = require('../utils/apiClient');
const { seedUsers, seedContent, seedCreatorRevenue } = require('../fixtures');
const CreatorRevenue = require('../../models/CreatorRevenue');
const PremiumUnlock = require('../../models/PremiumUnlock');
const Subscription = require('../../models/Subscription');
const Wallet = require('../../models/Wallet');
const AuditLog = require('../../models/AuditLog');

describe('Revenue Settlement Integration Tests', () => {
  let app, server;
  let creatorClient, adminClient;
  let creator, buyer, admin;

  beforeAll(async () => {
    ({ app, server } = await startTestServer());
  });

  afterAll(async () => {
    await stopTestServer(server);
  });

  beforeEach(async () => {
    // Seed test users
    const users = await seedUsers();
    creator = users.creator;
    buyer = users.buyer;
    admin = users.admin;

    creatorClient = createAuthenticatedClient(app, creator.token);
    adminClient = createAuthenticatedClient(app, admin.token);

    // Create initial revenue data
    await CreatorRevenue.create({
      creatorId: creator.id,
      balance_coins: 0,
      pending_coins: 1000, // 1000 coins pending settlement
      withdrawn_coins: 0,
      lifetime: {
        total_earned_coins: 1000,
        total_unlocks: 10,
        total_subscriptions: 2
      },
      monthly: {
        current_month_earnings: 1000,
        last_month_earnings: 0
      },
      sources: {
        unlocks_revenue: 700,
        subscription_revenue: 300
      },
      payment_info_verified: true
    });
  });

  afterEach(async () => {
    await mongoose.connection.dropDatabase();
  });

  describe('Pending to Available Settlement', () => {
    test('should move pending revenue to available after settlement period', async () => {
      const response = await adminClient
        .post('/api/admin/revenue/settle')
        .send({
          creatorId: creator.id,
          amount_coins: 500 // Settle 500 out of 1000 pending
        })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        settled_amount: 500
      });

      // Verify CreatorRevenue updated
      const revenue = await CreatorRevenue.findOne({ creatorId: creator.id });
      expect(revenue.pending_coins).toBe(500); // 1000 - 500
      expect(revenue.balance_coins).toBe(500); // 0 + 500

      // Verify AuditLog created
      const auditLog = await AuditLog.findOne({
        userId: creator.id,
        action: 'REVENUE_SETTLED'
      });
      expect(auditLog).toBeTruthy();
      expect(auditLog.metadata.amount_coins).toBe(500);
    });

    test('should settle all pending revenue if no amount specified', async () => {
      const response = await adminClient
        .post('/api/admin/revenue/settle')
        .send({
          creatorId: creator.id
          // No amount_coins = settle all
        })
        .expect(200);

      expect(response.body.settled_amount).toBe(1000);

      const revenue = await CreatorRevenue.findOne({ creatorId: creator.id });
      expect(revenue.pending_coins).toBe(0);
      expect(revenue.balance_coins).toBe(1000);
    });

    test('should reject settlement if amount exceeds pending', async () => {
      const response = await adminClient
        .post('/api/admin/revenue/settle')
        .send({
          creatorId: creator.id,
          amount_coins: 2000 // More than 1000 pending
        })
        .expect(400);

      expect(response.body.error).toContain('exceeds pending');

      // Verify no changes
      const revenue = await CreatorRevenue.findOne({ creatorId: creator.id });
      expect(revenue.pending_coins).toBe(1000);
      expect(revenue.balance_coins).toBe(0);
    });
  });

  describe('Batch Settlement Job', () => {
    test('should process all eligible creators in batch', async () => {
      // Create multiple creators with pending revenue
      const creator2 = await seedUsers().then(u => u.creator2);
      const creator3 = await seedUsers().then(u => u.creator3);

      await CreatorRevenue.insertMany([
        {
          creatorId: creator2.id,
          pending_coins: 500,
          balance_coins: 0,
          lifetime: { total_earned_coins: 500 }
        },
        {
          creatorId: creator3.id,
          pending_coins: 750,
          balance_coins: 0,
          lifetime: { total_earned_coins: 750 }
        }
      ]);

      // Run batch settlement (7-day holding period passed)
      const response = await adminClient
        .post('/api/admin/revenue/batch-settle')
        .send({
          holding_period_days: 7,
          dry_run: false
        })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        creators_processed: 3,
        total_settled_coins: 2250 // 1000 + 500 + 750
      });

      // Verify all creators settled
      const revenues = await CreatorRevenue.find({
        creatorId: { $in: [creator.id, creator2.id, creator3.id] }
      });

      revenues.forEach(rev => {
        expect(rev.pending_coins).toBe(0);
        expect(rev.balance_coins).toBeGreaterThan(0);
      });
    });

    test('should skip creators with pending_coins = 0', async () => {
      // Set creator pending to 0
      await CreatorRevenue.updateOne(
        { creatorId: creator.id },
        { $set: { pending_coins: 0 } }
      );

      const response = await adminClient
        .post('/api/admin/revenue/batch-settle')
        .expect(200);

      expect(response.body.creators_processed).toBe(0);
      expect(response.body.total_settled_coins).toBe(0);
    });

    test('should respect holding period constraint', async () => {
      // Create unlock from yesterday (within 7-day hold)
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      await PremiumUnlock.create({
        userId: buyer.id,
        contentId: new mongoose.Types.ObjectId(),
        creatorId: creator.id,
        amount_coins: 100,
        creator_share: 70,
        unlocked_at: yesterday
      });

      // Run settlement with 7-day hold
      const response = await adminClient
        .post('/api/admin/revenue/batch-settle')
        .send({
          holding_period_days: 7
        })
        .expect(200);

      // Should not settle recent transactions
      expect(response.body.creators_processed).toBe(0);

      // Now set unlock to 8 days ago
      await PremiumUnlock.updateOne(
        { userId: buyer.id },
        { $set: { unlocked_at: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000) } }
      );

      const response2 = await adminClient
        .post('/api/admin/revenue/batch-settle')
        .send({
          holding_period_days: 7
        })
        .expect(200);

      // Now should settle
      expect(response2.body.creators_processed).toBeGreaterThan(0);
    });

    test('should run in dry-run mode without persisting changes', async () => {
      const response = await adminClient
        .post('/api/admin/revenue/batch-settle')
        .send({
          dry_run: true
        })
        .expect(200);

      expect(response.body.dry_run).toBe(true);
      expect(response.body.total_settled_coins).toBeGreaterThan(0);

      // Verify no actual changes
      const revenue = await CreatorRevenue.findOne({ creatorId: creator.id });
      expect(revenue.pending_coins).toBe(1000); // Still pending
      expect(revenue.balance_coins).toBe(0); // Not settled
    });
  });

  describe('Revenue Analytics After Settlement', () => {
    test('should update creator revenue summary correctly', async () => {
      // Settle 500 coins
      await adminClient
        .post('/api/admin/revenue/settle')
        .send({
          creatorId: creator.id,
          amount_coins: 500
        })
        .expect(200);

      // Fetch creator revenue summary
      const response = await creatorClient
        .get('/api/creator/revenue')
        .expect(200);

      expect(response.body).toMatchObject({
        available_coins: 500,
        pending_coins: 500,
        withdrawn_coins: 0,
        total_lifetime_earnings: 1000
      });
    });

    test('should reflect settled revenue in withdrawal balance', async () => {
      // Settle all
      await adminClient
        .post('/api/admin/revenue/settle')
        .send({ creatorId: creator.id })
        .expect(200);

      // Creator should now be able to withdraw
      const response = await creatorClient
        .post('/api/creator/revenue/withdraw')
        .send({
          amount_coins: 1000,
          bankDetails: {
            accountNumber: '1234567890',
            bankName: 'Bank BCA',
            accountName: 'Test Creator'
          }
        })
        .expect(200);

      expect(response.body.success).toBe(true);

      // Verify balance deducted
      const revenue = await CreatorRevenue.findOne({ creatorId: creator.id });
      expect(revenue.balance_coins).toBe(0);
      expect(revenue.withdrawn_coins).toBe(1000);
    });
  });

  describe('Revenue Locking During Settlement', () => {
    test('should prevent double settlement via optimistic locking', async () => {
      // Simulate concurrent settlement requests
      const promises = [
        adminClient.post('/api/admin/revenue/settle').send({
          creatorId: creator.id,
          amount_coins: 1000
        }),
        adminClient.post('/api/admin/revenue/settle').send({
          creatorId: creator.id,
          amount_coins: 1000
        })
      ];

      const results = await Promise.allSettled(promises);

      // One should succeed, one should fail
      const successes = results.filter(r => r.status === 'fulfilled' && r.value.status === 200);
      const failures = results.filter(r => r.status === 'fulfilled' && r.value.status !== 200);

      expect(successes.length).toBe(1);
      expect(failures.length).toBe(1);

      // Verify final state
      const revenue = await CreatorRevenue.findOne({ creatorId: creator.id });
      expect(revenue.pending_coins).toBe(0);
      expect(revenue.balance_coins).toBe(1000);
    });
  });

  describe('Socket Events on Settlement', () => {
    test('should emit REVENUE_UPDATED socket event to creator', async () => {
      const socketEvents = [];
      
      // Mock socket emission (in real test, use socket.io-client)
      const originalEmit = app.io?.to;
      if (app.io) {
        app.io.to = jest.fn().mockReturnValue({
          emit: jest.fn((event, data) => {
            socketEvents.push({ event, data });
          })
        });
      }

      await adminClient
        .post('/api/admin/revenue/settle')
        .send({
          creatorId: creator.id,
          amount_coins: 500
        })
        .expect(200);

      // Verify socket event emitted
      const revenueEvent = socketEvents.find(e => e.event === 'REVENUE_UPDATED');
      expect(revenueEvent).toBeTruthy();
      expect(revenueEvent.data).toMatchObject({
        type: 'settlement',
        amount_coins: 500,
        available_coins: 500,
        pending_coins: 500
      });

      // Restore original emit
      if (originalEmit) app.io.to = originalEmit;
    });
  });
});
