const PremiumUnlock = require('../models/PremiumUnlock');
const Subscription = require('../models/Subscription');
const Wallet = require('../models/Wallet');
const AuditLog = require('../models/AuditLog');

/**
 * FraudGuard - Anti-fraud protection for monetization system
 * 
 * Features:
 * - Velocity limiting (max unlocks per time period)
 * - High-value transaction alerts
 * - Subscription abuse detection
 * - Risk scoring and auto-freeze
 * - Suspicious activity logging
 */
class FraudGuard {
  constructor() {
    // Configuration
    this.config = {
      maxUnlocksPerMinute: 10,
      maxUnlocksPerHour: 50,
      maxSubscriptionsPerDay: 5,
      highValueThreshold: 10000, // coins
      riskScoreThreshold: 80, // 0-100 scale
      autoFreezeThreshold: 90
    };

    // In-memory rate limiting cache (in production, use Redis)
    this.unlockCache = new Map(); // userId -> [timestamps]
    this.subscriptionCache = new Map(); // userId -> [timestamps]
  }

  /**
   * Check if user is allowed to unlock content (velocity + risk checks)
   * 
   * @param {string} userId - User attempting unlock
   * @param {string} contentId - Content to unlock
   * @param {number} priceCoins - Content price
   * @returns {object} { allowed: boolean, reason: string, riskScore: number }
   */
  async checkUnlockAllowed(userId, contentId, priceCoins) {
    const checks = [];

    // 1. Velocity check - unlocks per minute
    const velocityMinute = await this._checkVelocity(userId, 'unlock', 60, this.config.maxUnlocksPerMinute);
    checks.push({
      name: 'velocity_minute',
      passed: velocityMinute.allowed,
      score: velocityMinute.allowed ? 0 : 30
    });

    // 2. Velocity check - unlocks per hour
    const velocityHour = await this._checkVelocity(userId, 'unlock', 3600, this.config.maxUnlocksPerHour);
    checks.push({
      name: 'velocity_hour',
      passed: velocityHour.allowed,
      score: velocityHour.allowed ? 0 : 25
    });

    // 3. High-value transaction check
    const isHighValue = priceCoins >= this.config.highValueThreshold;
    if (isHighValue) {
      checks.push({
        name: 'high_value',
        passed: true, // Allow but flag
        score: 20
      });
    }

    // 4. Check for duplicate unlock attempts (same content, short time)
    const duplicateAttempt = await this._checkDuplicateUnlock(userId, contentId);
    checks.push({
      name: 'duplicate_attempt',
      passed: !duplicateAttempt,
      score: duplicateAttempt ? 40 : 0
    });

    // 5. Check user wallet history for suspicious patterns
    const walletRisk = await this._checkWalletRisk(userId);
    checks.push({
      name: 'wallet_risk',
      passed: walletRisk.score < 30,
      score: walletRisk.score
    });

    // Calculate total risk score
    const totalRiskScore = checks.reduce((sum, check) => sum + check.score, 0);
    const failed = checks.filter(check => !check.passed);

    // Determine if allowed
    const allowed = totalRiskScore < this.config.riskScoreThreshold && failed.length === 0;
    const shouldFreeze = totalRiskScore >= this.config.autoFreezeThreshold;

    // Log suspicious activity
    if (!allowed || totalRiskScore > 50) {
      await this._logSuspiciousActivity(userId, 'unlock', {
        contentId,
        priceCoins,
        riskScore: totalRiskScore,
        checks,
        action: shouldFreeze ? 'auto_freeze' : 'blocked'
      });
    }

    // Auto-freeze if risk too high
    if (shouldFreeze) {
      await this._freezeUserAccount(userId, `High risk score: ${totalRiskScore}`);
    }

    return {
      allowed,
      reason: !allowed ? this._buildReason(failed) : 'Allowed',
      riskScore: totalRiskScore,
      checks,
      action: shouldFreeze ? 'account_frozen' : (allowed ? 'approved' : 'blocked')
    };
  }

  /**
   * Check if user is allowed to subscribe (abuse detection)
   * 
   * @param {string} userId - User attempting subscription
   * @param {string} creatorId - Creator to subscribe to
   * @returns {object} { allowed: boolean, reason: string }
   */
  async checkSubscriptionAbuse(userId, creatorId) {
    const checks = [];

    // 1. Velocity check - subscriptions per day
    const velocityDay = await this._checkVelocity(userId, 'subscription', 86400, this.config.maxSubscriptionsPerDay);
    checks.push({
      name: 'velocity_day',
      passed: velocityDay.allowed,
      score: velocityDay.allowed ? 0 : 40
    });

    // 2. Check for rapid subscribe/cancel pattern
    const rapidCancelPattern = await this._checkRapidCancelPattern(userId);
    checks.push({
      name: 'rapid_cancel_pattern',
      passed: !rapidCancelPattern,
      score: rapidCancelPattern ? 50 : 0
    });

    // 3. Check for duplicate subscription attempt
    const existingSubscription = await Subscription.getActiveSubscription(userId, creatorId);
    const isDuplicate = !!existingSubscription;
    checks.push({
      name: 'duplicate_subscription',
      passed: !isDuplicate,
      score: isDuplicate ? 30 : 0
    });

    // Calculate risk
    const totalRiskScore = checks.reduce((sum, check) => sum + check.score, 0);
    const failed = checks.filter(check => !check.passed);
    const allowed = totalRiskScore < this.config.riskScoreThreshold && failed.length === 0;

    // Log if suspicious
    if (!allowed || totalRiskScore > 40) {
      await this._logSuspiciousActivity(userId, 'subscription', {
        creatorId,
        riskScore: totalRiskScore,
        checks
      });
    }

    return {
      allowed,
      reason: !allowed ? this._buildReason(failed) : 'Allowed',
      riskScore: totalRiskScore,
      checks
    };
  }

  /**
   * Check velocity limits (rate limiting)
   * @private
   */
  async _checkVelocity(userId, type, windowSeconds, maxCount) {
    const cache = type === 'unlock' ? this.unlockCache : this.subscriptionCache;
    const now = Date.now();
    const windowMs = windowSeconds * 1000;

    // Get user's recent attempts
    let attempts = cache.get(userId) || [];
    
    // Remove old attempts outside window
    attempts = attempts.filter(timestamp => now - timestamp < windowMs);
    
    // Check if exceeded limit
    const allowed = attempts.length < maxCount;
    
    // Add current attempt if allowed
    if (allowed) {
      attempts.push(now);
      cache.set(userId, attempts);
    }

    return {
      allowed,
      count: attempts.length,
      limit: maxCount,
      window: windowSeconds
    };
  }

  /**
   * Check for duplicate unlock attempts (same content, recent)
   * @private
   */
  async _checkDuplicateUnlock(userId, contentId) {
    const recentWindow = new Date(Date.now() - 60000); // Last 1 minute
    
    const recentAttempts = await PremiumUnlock.countDocuments({
      userId,
      contentId,
      createdAt: { $gte: recentWindow }
    });

    return recentAttempts > 0;
  }

  /**
   * Check wallet history for suspicious patterns
   * @private
   */
  async _checkWalletRisk(userId) {
    let riskScore = 0;

    // Get user wallet
    const wallet = await Wallet.findOne({ userId });
    if (!wallet) {
      return { score: 10, reason: 'No wallet found' };
    }

    // Check 1: Very low balance (potential account compromise)
    const balanceCents = wallet.getBalanceCents();
    if (balanceCents < 10000) { // Less than 1 coin
      riskScore += 5;
    }

    // Check 2: Recent large deposits (potential fraud)
    const recentDeposits = wallet.statistics?.recent_deposits_cents || 0;
    if (recentDeposits > 1000000) { // More than 100 coins recently
      riskScore += 15;
    }

    // Check 3: High spend rate
    const totalSpent = wallet.statistics?.total_spent_cents || 0;
    const walletAge = Date.now() - wallet.createdAt.getTime();
    const daysSinceCreation = walletAge / (1000 * 60 * 60 * 24);
    
    if (daysSinceCreation < 1 && totalSpent > 500000) { // More than 50 coins spent in first day
      riskScore += 20;
    }

    return { score: riskScore };
  }

  /**
   * Check for rapid subscribe/cancel pattern (abuse)
   * @private
   */
  async _checkRapidCancelPattern(userId) {
    const last7Days = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    
    const recentCancellations = await Subscription.countDocuments({
      subscriberId: userId,
      status: 'cancelled',
      'metadata.cancelledAt': { $gte: last7Days }
    });

    // Flag if more than 3 cancellations in 7 days
    return recentCancellations >= 3;
  }

  /**
   * Log suspicious activity
   * @private
   */
  async _logSuspiciousActivity(userId, activityType, details) {
    await AuditLog.create({
      userId,
      action: 'SUSPICIOUS_ACTIVITY_DETECTED',
      resource: 'FraudGuard',
      resourceId: null,
      changes: {
        activityType,
        ...details,
        timestamp: new Date()
      }
    });

    console.warn(`[FraudGuard] Suspicious activity detected:`, {
      userId,
      activityType,
      riskScore: details.riskScore
    });
  }

  /**
   * Freeze user account (high risk)
   * @private
   */
  async _freezeUserAccount(userId, reason) {
    // TODO: Implement user account freeze in User model
    // For now, just log
    await AuditLog.create({
      userId,
      action: 'ACCOUNT_AUTO_FREEZE',
      resource: 'User',
      resourceId: userId,
      changes: {
        reason,
        timestamp: new Date(),
        automated: true
      }
    });

    console.error(`[FraudGuard] Account auto-frozen: ${userId}, Reason: ${reason}`);
    
    // TODO: Send notification to user and admin
  }

  /**
   * Build human-readable reason from failed checks
   * @private
   */
  _buildReason(failedChecks) {
    const reasons = {
      velocity_minute: 'Too many unlocks per minute. Please wait.',
      velocity_hour: 'Hourly unlock limit reached. Try again later.',
      velocity_day: 'Daily subscription limit reached.',
      high_value: 'High-value transaction flagged for review.',
      duplicate_attempt: 'Duplicate unlock attempt detected.',
      duplicate_subscription: 'Already subscribed to this creator.',
      rapid_cancel_pattern: 'Suspicious subscription pattern detected.',
      wallet_risk: 'Wallet activity flagged for review.'
    };

    if (failedChecks.length === 0) {
      return 'Request blocked due to risk score';
    }

    return failedChecks.map(check => reasons[check.name] || check.name).join(' ');
  }

  /**
   * Clear rate limit cache for user (admin/testing use)
   */
  clearUserCache(userId) {
    this.unlockCache.delete(userId);
    this.subscriptionCache.delete(userId);
  }

  /**
   * Get user risk profile (admin dashboard)
   */
  async getUserRiskProfile(userId) {
    const unlockHistory = await PremiumUnlock.getUserUnlocks(userId, { limit: 50 });
    const subscriptionHistory = await Subscription.getUserSubscriptions(userId);
    const walletRisk = await this._checkWalletRisk(userId);

    const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentUnlocks = unlockHistory.unlocks.filter(u => u.createdAt >= last24Hours).length;
    const recentSubscriptions = subscriptionHistory.subscriptions.filter(s => s.createdAt >= last24Hours).length;

    return {
      userId,
      risk_score: walletRisk.score + (recentUnlocks > 20 ? 30 : 0) + (recentSubscriptions > 3 ? 20 : 0),
      activity: {
        unlocks_24h: recentUnlocks,
        subscriptions_24h: recentSubscriptions,
        total_unlocks: unlockHistory.pagination.total,
        total_subscriptions: subscriptionHistory.pagination.total
      },
      wallet: walletRisk,
      alerts: []
    };
  }
}

module.exports = new FraudGuard();
