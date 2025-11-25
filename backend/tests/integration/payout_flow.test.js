/**
 * Integration Tests - Creator Payout Flow
 * Tests payout request, admin approval/rejection, fund locking
 */

const request = require('supertest');
const mongoose = require('mongoose');
const { startTestServer, stopTestServer } = require('../utils/testServer');
const { createAuthenticatedClient } = require('../utils/apiClient');
const { seedUsers } = require('../fixtures');
const CreatorRevenue = require('../../models/CreatorRevenue');
const PayoutRequest = require('../../models/PayoutRequest');
const Wallet = require('../../models/Wallet');
const Transaction = require('../../models/Transaction');
const AuditLog = require('../../models/AuditLog');

describe('Payout Flow Integration Tests', () => {
  let app, server;
  let creatorClient, adminClient;
  let creator, admin;

  beforeAll(async () => {
    ({ app, server } = await startTestServer());
  });

  afterAll(async () => {
    await stopTestServer(server);
  });

  beforeEach(async () => {
    const users = await seedUsers();
    creator = users.creator;
    admin = users.admin;

    creatorClient = createAuthenticatedClient(app, creator.token);
    adminClient = createAuthenticatedClient(app, admin.token);

    // Setup creator with available balance
    await CreatorRevenue.create({
      creatorId: creator.id,
      balance_coins: 2000, // Available for withdrawal
      pending_coins: 500,
      withdrawn_coins: 0,
      lifetime: {
        total_earned_coins: 2500
      },
      payment_info_verified: true // KYC verified
    });
  });

  afterEach(async () => {
    await mongoose.connection.dropDatabase();
  });

  describe('Request Payout', () => {
    test('should create payout request and lock funds', async () => {
      const response = await creatorClient
        .post('/api/creator/revenue/withdraw')
        .send({
          amount_coins: 1000,
          bankDetails: {
            accountNumber: '1234567890',
            bankName: 'Bank BCA',
            accountName: 'Test Creator',
            accountType: 'savings'
          }
        })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        payoutRequestId: expect.any(String),
        status: 'pending',
        amount_coins: 1000
      });

      // Verify PayoutRequest created
      const payoutRequest = await PayoutRequest.findById(response.body.payoutRequestId);
      expect(payoutRequest).toBeTruthy();
      expect(payoutRequest.status).toBe('pending');
      expect(payoutRequest.amount_coins).toBe(1000);
      expect(payoutRequest.bankDetails.accountNumber).toBe('1234567890');

      // Verify funds locked in CreatorRevenue
      const revenue = await CreatorRevenue.findOne({ creatorId: creator.id });
      expect(revenue.balance_coins).toBe(1000); // 2000 - 1000
      expect(revenue.locked_coins).toBe(1000); // Locked for payout

      // Verify AuditLog
      const auditLog = await AuditLog.findOne({
        userId: creator.id,
        action: 'PAYOUT_REQUESTED'
      });
      expect(auditLog).toBeTruthy();
    });

    test('should reject payout if insufficient balance', async () => {
      const response = await creatorClient
        .post('/api/creator/revenue/withdraw')
        .send({
          amount_coins: 5000, // More than 2000 available
          bankDetails: {
            accountNumber: '1234567890',
            bankName: 'Bank BCA',
            accountName: 'Test Creator'
          }
        })
        .expect(400);

      expect(response.body.error).toContain('Insufficient balance');

      // Verify no changes
      const revenue = await CreatorRevenue.findOne({ creatorId: creator.id });
      expect(revenue.balance_coins).toBe(2000);
      expect(revenue.locked_coins).toBe(0);
    });

    test('should reject payout if KYC not verified', async () => {
      // Set KYC to false
      await CreatorRevenue.updateOne(
        { creatorId: creator.id },
        { $set: { payment_info_verified: false } }
      );

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
        .expect(403);

      expect(response.body.error).toContain('KYC verification required');
    });

    test('should enforce minimum withdrawal amount', async () => {
      const response = await creatorClient
        .post('/api/creator/revenue/withdraw')
        .send({
          amount_coins: 50, // Below minimum (100)
          bankDetails: {
            accountNumber: '1234567890',
            bankName: 'Bank BCA',
            accountName: 'Test Creator'
          }
        })
        .expect(400);

      expect(response.body.error).toContain('Minimum withdrawal');
    });

    test('should prevent multiple pending payouts', async () => {
      // First payout
      await creatorClient
        .post('/api/creator/revenue/withdraw')
        .send({
          amount_coins: 500,
          bankDetails: {
            accountNumber: '1234567890',
            bankName: 'Bank BCA',
            accountName: 'Test Creator'
          }
        })
        .expect(200);

      // Second payout while first is pending
      const response = await creatorClient
        .post('/api/creator/revenue/withdraw')
        .send({
          amount_coins: 500,
          bankDetails: {
            accountNumber: '1234567890',
            bankName: 'Bank BCA',
            accountName: 'Test Creator'
          }
        })
        .expect(400);

      expect(response.body.error).toContain('pending payout request');
    });
  });

  describe('Admin Approve Payout', () => {
    let payoutRequestId;

    beforeEach(async () => {
      // Create payout request
      const response = await creatorClient
        .post('/api/creator/revenue/withdraw')
        .send({
          amount_coins: 1000,
          bankDetails: {
            accountNumber: '1234567890',
            bankName: 'Bank BCA',
            accountName: 'Test Creator'
          }
        });

      payoutRequestId = response.body.payoutRequestId;
    });

    test('should approve payout and process withdrawal', async () => {
      const response = await adminClient
        .post(`/api/admin/payouts/${payoutRequestId}/approve`)
        .send({
          transaction_reference: 'TXN-12345',
          notes: 'Approved and processed'
        })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        status: 'approved'
      });

      // Verify PayoutRequest updated
      const payoutRequest = await PayoutRequest.findById(payoutRequestId);
      expect(payoutRequest.status).toBe('approved');
      expect(payoutRequest.processed_at).toBeTruthy();
      expect(payoutRequest.admin_notes).toBe('Approved and processed');
      expect(payoutRequest.transaction_reference).toBe('TXN-12345');

      // Verify funds deducted from CreatorRevenue
      const revenue = await CreatorRevenue.findOne({ creatorId: creator.id });
      expect(revenue.balance_coins).toBe(1000); // Already deducted on request
      expect(revenue.locked_coins).toBe(0); // Unlocked after approval
      expect(revenue.withdrawn_coins).toBe(1000);

      // Verify Transaction created
      const transaction = await Transaction.findOne({
        userId: creator.id,
        type: 'withdrawal',
        status: 'completed'
      });
      expect(transaction).toBeTruthy();
      expect(transaction.amount_coins).toBe(1000);

      // Verify AuditLog
      const auditLog = await AuditLog.findOne({
        userId: creator.id,
        action: 'PAYOUT_APPROVED'
      });
      expect(auditLog).toBeTruthy();
    });

    test('should reject approval if payout already processed', async () => {
      // Approve once
      await adminClient
        .post(`/api/admin/payouts/${payoutRequestId}/approve`)
        .send({
          transaction_reference: 'TXN-12345'
        })
        .expect(200);

      // Try to approve again
      const response = await adminClient
        .post(`/api/admin/payouts/${payoutRequestId}/approve`)
        .send({
          transaction_reference: 'TXN-67890'
        })
        .expect(400);

      expect(response.body.error).toContain('already processed');
    });

    test('should emit PAYOUT_APPROVED socket event to creator', async () => {
      const socketEvents = [];
      
      if (app.io) {
        app.io.to = jest.fn().mockReturnValue({
          emit: jest.fn((event, data) => {
            socketEvents.push({ event, data });
          })
        });
      }

      await adminClient
        .post(`/api/admin/payouts/${payoutRequestId}/approve`)
        .send({
          transaction_reference: 'TXN-12345'
        })
        .expect(200);

      const payoutEvent = socketEvents.find(e => e.event === 'PAYOUT_APPROVED');
      expect(payoutEvent).toBeTruthy();
      expect(payoutEvent.data).toMatchObject({
        payoutRequestId,
        amount_coins: 1000,
        status: 'approved'
      });
    });
  });

  describe('Admin Reject Payout', () => {
    let payoutRequestId;

    beforeEach(async () => {
      const response = await creatorClient
        .post('/api/creator/revenue/withdraw')
        .send({
          amount_coins: 1000,
          bankDetails: {
            accountNumber: '1234567890',
            bankName: 'Bank BCA',
            accountName: 'Test Creator'
          }
        });

      payoutRequestId = response.body.payoutRequestId;
    });

    test('should reject payout and return locked funds', async () => {
      const response = await adminClient
        .post(`/api/admin/payouts/${payoutRequestId}/reject`)
        .send({
          reason: 'Invalid bank details'
        })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        status: 'rejected'
      });

      // Verify PayoutRequest updated
      const payoutRequest = await PayoutRequest.findById(payoutRequestId);
      expect(payoutRequest.status).toBe('rejected');
      expect(payoutRequest.rejection_reason).toBe('Invalid bank details');

      // Verify funds returned to available
      const revenue = await CreatorRevenue.findOne({ creatorId: creator.id });
      expect(revenue.balance_coins).toBe(2000); // Funds returned
      expect(revenue.locked_coins).toBe(0);

      // Verify AuditLog
      const auditLog = await AuditLog.findOne({
        userId: creator.id,
        action: 'PAYOUT_REJECTED'
      });
      expect(auditLog).toBeTruthy();
      expect(auditLog.metadata.reason).toBe('Invalid bank details');
    });

    test('should emit PAYOUT_REJECTED socket event to creator', async () => {
      const socketEvents = [];
      
      if (app.io) {
        app.io.to = jest.fn().mockReturnValue({
          emit: jest.fn((event, data) => {
            socketEvents.push({ event, data });
          })
        });
      }

      await adminClient
        .post(`/api/admin/payouts/${payoutRequestId}/reject`)
        .send({
          reason: 'Suspicious activity'
        })
        .expect(200);

      const payoutEvent = socketEvents.find(e => e.event === 'PAYOUT_REJECTED');
      expect(payoutEvent).toBeTruthy();
      expect(payoutEvent.data).toMatchObject({
        payoutRequestId,
        reason: 'Suspicious activity'
      });
    });
  });

  describe('Payout History', () => {
    test('should list all payout requests for creator', async () => {
      // Create multiple payouts
      await creatorClient.post('/api/creator/revenue/withdraw').send({
        amount_coins: 500,
        bankDetails: {
          accountNumber: '1234567890',
          bankName: 'Bank BCA',
          accountName: 'Test Creator'
        }
      });

      await creatorClient.post('/api/creator/revenue/withdraw').send({
        amount_coins: 300,
        bankDetails: {
          accountNumber: '9876543210',
          bankName: 'Bank Mandiri',
          accountName: 'Test Creator'
        }
      });

      const response = await creatorClient
        .get('/api/creator/revenue/payouts')
        .expect(200);

      expect(response.body.payouts).toHaveLength(2);
      expect(response.body.payouts[0]).toMatchObject({
        amount_coins: expect.any(Number),
        status: 'pending',
        bankDetails: expect.any(Object)
      });
    });

    test('should filter payouts by status', async () => {
      const payout1Response = await creatorClient.post('/api/creator/revenue/withdraw').send({
        amount_coins: 500,
        bankDetails: {
          accountNumber: '1234567890',
          bankName: 'Bank BCA',
          accountName: 'Test Creator'
        }
      });

      // Approve first payout
      await adminClient
        .post(`/api/admin/payouts/${payout1Response.body.payoutRequestId}/approve`)
        .send({ transaction_reference: 'TXN-111' });

      // Get only approved payouts
      const response = await creatorClient
        .get('/api/creator/revenue/payouts?status=approved')
        .expect(200);

      expect(response.body.payouts).toHaveLength(1);
      expect(response.body.payouts[0].status).toBe('approved');
    });
  });

  describe('Admin Payout Dashboard', () => {
    test('should list all pending payouts for admin review', async () => {
      // Create payouts from multiple creators
      await creatorClient.post('/api/creator/revenue/withdraw').send({
        amount_coins: 1000,
        bankDetails: {
          accountNumber: '1234567890',
          bankName: 'Bank BCA',
          accountName: 'Test Creator'
        }
      });

      const response = await adminClient
        .get('/api/admin/payouts?status=pending')
        .expect(200);

      expect(response.body.payouts).toHaveLength(1);
      expect(response.body.payouts[0]).toMatchObject({
        amount_coins: 1000,
        status: 'pending',
        creator: {
          id: creator.id,
          name: expect.any(String)
        }
      });
    });

    test('should show payout statistics', async () => {
      // Create and approve payout
      const payoutResponse = await creatorClient.post('/api/creator/revenue/withdraw').send({
        amount_coins: 1000,
        bankDetails: {
          accountNumber: '1234567890',
          bankName: 'Bank BCA',
          accountName: 'Test Creator'
        }
      });

      await adminClient
        .post(`/api/admin/payouts/${payoutResponse.body.payoutRequestId}/approve`)
        .send({ transaction_reference: 'TXN-12345' });

      const response = await adminClient
        .get('/api/admin/payouts/stats')
        .expect(200);

      expect(response.body).toMatchObject({
        total_pending: 0,
        total_approved: 1,
        total_rejected: 0,
        total_amount_pending_coins: 0,
        total_amount_approved_coins: 1000
      });
    });
  });
});
