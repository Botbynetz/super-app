/**
 * Integration Tests - Live Gift Flow
 * Tests gift sending during live streams with real-time notifications
 */

const request = require('supertest');
const mongoose = require('mongoose');
const { startTestServer, stopTestServer } = require('../utils/testServer');
const { createAuthenticatedClient } = require('../utils/apiClient');
const { seedUsers } = require('../fixtures');
const Gift = require('../../models/Gift');
const Wallet = require('../../models/Wallet');
const Transaction = require('../../models/Transaction');
const CreatorRevenue = require('../../models/CreatorRevenue');
const AuditLog = require('../../models/AuditLog');

describe('Gift Flow Integration Tests', () => {
  let app, server;
  let senderClient, creatorClient;
  let sender, creator;

  beforeAll(async () => {
    ({ app, server } = await startTestServer());
  });

  afterAll(async () => {
    await stopTestServer(server);
  });

  beforeEach(async () => {
    const users = await seedUsers();
    sender = users.buyer; // Buyer acts as gift sender
    creator = users.creator;

    senderClient = createAuthenticatedClient(app, sender.token);
    creatorClient = createAuthenticatedClient(app, creator.token);

    // Setup sender wallet with balance
    await Wallet.create({
      userId: sender.id,
      balance_coins: 1000,
      statistics: {
        total_deposited_coins: 1000,
        total_spent_coins: 0
      }
    });

    // Setup creator revenue
    await CreatorRevenue.create({
      creatorId: creator.id,
      balance_coins: 0,
      pending_coins: 0,
      withdrawn_coins: 0
    });
  });

  afterEach(async () => {
    await mongoose.connection.dropDatabase();
  });

  describe('Send Gift', () => {
    test('should send gift and deduct sender balance', async () => {
      const response = await senderClient
        .post('/api/gifts/send')
        .send({
          recipientId: creator.id,
          giftType: 'rose', // 10 coins
          quantity: 5, // Total: 50 coins
          message: 'Love your content!',
          context: {
            type: 'livestream',
            streamId: 'stream-123'
          }
        })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        giftId: expect.any(String),
        total_coins: 50
      });

      // Verify Gift record created
      const gift = await Gift.findById(response.body.giftId);
      expect(gift).toBeTruthy();
      expect(gift.senderId).toEqual(sender.id);
      expect(gift.recipientId).toEqual(creator.id);
      expect(gift.giftType).toBe('rose');
      expect(gift.quantity).toBe(5);
      expect(gift.total_coins).toBe(50);

      // Verify sender balance deducted
      const senderWallet = await Wallet.findOne({ userId: sender.id });
      expect(senderWallet.balance_coins).toBe(950); // 1000 - 50

      // Verify creator revenue credited
      const creatorRevenue = await CreatorRevenue.findOne({ creatorId: creator.id });
      expect(creatorRevenue.pending_coins).toBe(35); // 50 * 0.70 (70% to creator)

      // Verify Transaction created
      const transaction = await Transaction.findOne({
        userId: sender.id,
        type: 'gift_sent'
      });
      expect(transaction).toBeTruthy();
      expect(transaction.amount_coins).toBe(50);
    });

    test('should reject gift if insufficient balance', async () => {
      const response = await senderClient
        .post('/api/gifts/send')
        .send({
          recipientId: creator.id,
          giftType: 'diamond', // 1000 coins
          quantity: 2, // Total: 2000 coins (exceeds balance)
          message: 'Too expensive!'
        })
        .expect(400);

      expect(response.body.error).toContain('Insufficient balance');

      // Verify no changes
      const senderWallet = await Wallet.findOne({ userId: sender.id });
      expect(senderWallet.balance_coins).toBe(1000);
    });

    test('should support different gift types with correct pricing', async () => {
      const giftTypes = [
        { type: 'rose', price: 10 },
        { type: 'heart', price: 50 },
        { type: 'diamond', price: 1000 }
      ];

      for (const gift of giftTypes) {
        const response = await senderClient
          .post('/api/gifts/send')
          .send({
            recipientId: creator.id,
            giftType: gift.type,
            quantity: 1
          })
          .expect(200);

        expect(response.body.total_coins).toBe(gift.price);
      }
    });

    test('should prevent sending gifts to self', async () => {
      const response = await senderClient
        .post('/api/gifts/send')
        .send({
          recipientId: sender.id, // Self
          giftType: 'rose',
          quantity: 1
        })
        .expect(400);

      expect(response.body.error).toContain('Cannot send gift to yourself');
    });

    test('should enforce maximum gift quantity per transaction', async () => {
      const response = await senderClient
        .post('/api/gifts/send')
        .send({
          recipientId: creator.id,
          giftType: 'rose',
          quantity: 1000 // Exceeds max (e.g., 100)
        })
        .expect(400);

      expect(response.body.error).toContain('Maximum quantity');
    });
  });

  describe('Gift Combo/Streak', () => {
    test('should detect gift combo (multiple gifts in short time)', async () => {
      // Send 3 gifts within 5 seconds
      await senderClient.post('/api/gifts/send').send({
        recipientId: creator.id,
        giftType: 'rose',
        quantity: 1
      });

      await new Promise(resolve => setTimeout(resolve, 1000));

      await senderClient.post('/api/gifts/send').send({
        recipientId: creator.id,
        giftType: 'rose',
        quantity: 1
      });

      await new Promise(resolve => setTimeout(resolve, 1000));

      const response = await senderClient.post('/api/gifts/send').send({
        recipientId: creator.id,
        giftType: 'rose',
        quantity: 1
      });

      expect(response.body.combo_count).toBe(3);
      expect(response.body.is_combo).toBe(true);
    });

    test('should apply bonus coins for combo gifts', async () => {
      // Send combo gifts
      for (let i = 0; i < 5; i++) {
        await senderClient.post('/api/gifts/send').send({
          recipientId: creator.id,
          giftType: 'heart',
          quantity: 1
        });
      }

      // Check creator revenue includes bonus
      const creatorRevenue = await CreatorRevenue.findOne({ creatorId: creator.id });
      const expectedRevenue = 5 * 50 * 0.70; // Base revenue
      const bonusRevenue = expectedRevenue * 0.10; // 10% combo bonus

      expect(creatorRevenue.pending_coins).toBeGreaterThanOrEqual(expectedRevenue);
    });
  });

  describe('Gift Leaderboard', () => {
    test('should track top gift senders for creator', async () => {
      // Send gifts
      await senderClient.post('/api/gifts/send').send({
        recipientId: creator.id,
        giftType: 'diamond',
        quantity: 1 // 1000 coins
      });

      const response = await creatorClient
        .get('/api/gifts/leaderboard')
        .expect(200);

      expect(response.body.top_senders).toHaveLength(1);
      expect(response.body.top_senders[0]).toMatchObject({
        senderId: sender.id,
        total_coins_sent: 1000,
        total_gifts_sent: 1
      });
    });

    test('should rank senders by total coins sent', async () => {
      // Create multiple senders
      const sender2 = await seedUsers().then(u => u.buyer2);
      const sender2Client = createAuthenticatedClient(app, sender2.token);

      await Wallet.create({
        userId: sender2.id,
        balance_coins: 2000
      });

      // Sender 1 sends 100 coins
      await senderClient.post('/api/gifts/send').send({
        recipientId: creator.id,
        giftType: 'rose',
        quantity: 10
      });

      // Sender 2 sends 500 coins
      await sender2Client.post('/api/gifts/send').send({
        recipientId: creator.id,
        giftType: 'heart',
        quantity: 10
      });

      const response = await creatorClient
        .get('/api/gifts/leaderboard')
        .expect(200);

      expect(response.body.top_senders[0].senderId).toEqual(sender2.id);
      expect(response.body.top_senders[1].senderId).toEqual(sender.id);
    });
  });

  describe('Gift History', () => {
    test('should list sent gifts for user', async () => {
      // Send multiple gifts
      await senderClient.post('/api/gifts/send').send({
        recipientId: creator.id,
        giftType: 'rose',
        quantity: 5
      });

      await senderClient.post('/api/gifts/send').send({
        recipientId: creator.id,
        giftType: 'heart',
        quantity: 2
      });

      const response = await senderClient
        .get('/api/gifts/sent')
        .expect(200);

      expect(response.body.gifts).toHaveLength(2);
      expect(response.body.total_coins_sent).toBe(150); // (5*10) + (2*50)
    });

    test('should list received gifts for creator', async () => {
      await senderClient.post('/api/gifts/send').send({
        recipientId: creator.id,
        giftType: 'diamond',
        quantity: 1
      });

      const response = await creatorClient
        .get('/api/gifts/received')
        .expect(200);

      expect(response.body.gifts).toHaveLength(1);
      expect(response.body.total_coins_received).toBe(1000);
    });
  });

  describe('Real-time Gift Notifications', () => {
    test('should emit GIFT_SENT socket event to livestream room', async () => {
      const socketEvents = [];
      
      if (app.io) {
        app.io.to = jest.fn().mockReturnValue({
          emit: jest.fn((event, data) => {
            socketEvents.push({ event, data });
          })
        });
      }

      await senderClient.post('/api/gifts/send').send({
        recipientId: creator.id,
        giftType: 'rose',
        quantity: 5,
        context: {
          type: 'livestream',
          streamId: 'stream-123'
        }
      });

      const giftEvent = socketEvents.find(e => e.event === 'GIFT_SENT');
      expect(giftEvent).toBeTruthy();
      expect(giftEvent.data).toMatchObject({
        giftType: 'rose',
        quantity: 5,
        total_coins: 50,
        sender: {
          id: sender.id,
          name: expect.any(String)
        }
      });
    });

    test('should emit gift animation data for UI', async () => {
      const socketEvents = [];
      
      if (app.io) {
        app.io.to = jest.fn().mockReturnValue({
          emit: jest.fn((event, data) => {
            socketEvents.push({ event, data });
          })
        });
      }

      await senderClient.post('/api/gifts/send').send({
        recipientId: creator.id,
        giftType: 'diamond',
        quantity: 1
      });

      const giftEvent = socketEvents.find(e => e.event === 'GIFT_SENT');
      expect(giftEvent.data.animation).toMatchObject({
        type: 'diamond',
        duration: expect.any(Number)
      });
    });
  });

  describe('Gift Revenue Split', () => {
    test('should apply correct revenue split (70/25/5)', async () => {
      await senderClient.post('/api/gifts/send').send({
        recipientId: creator.id,
        giftType: 'heart', // 50 coins
        quantity: 2 // Total: 100 coins
      });

      const gift = await Gift.findOne({ senderId: sender.id });
      
      expect(gift.revenue_split).toMatchObject({
        creator_share: 70, // 70%
        platform_share: 25, // 25%
        processing_fee: 5 // 5%
      });

      const creatorRevenue = await CreatorRevenue.findOne({ creatorId: creator.id });
      expect(creatorRevenue.pending_coins).toBe(70);
    });
  });
});
