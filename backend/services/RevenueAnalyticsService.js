const CreatorRevenue = require('../models/CreatorRevenue');
const PremiumUnlock = require('../models/PremiumUnlock');
const Subscription = require('../models/Subscription');

/**
 * RevenueAnalyticsService - Analytics and reporting for creator earnings and platform revenue
 * 
 * Features:
 * - Top earners leaderboard (monthly/lifetime)
 * - Creator revenue summary with growth metrics
 * - Platform revenue overview
 * - Performance analytics
 */
class RevenueAnalyticsService {
  /**
   * Get top earning creators
   * 
   * @param {string} period - "monthly" | "lifetime"
   * @param {number} limit - Number of results (default: 10)
   * @returns {array} Top earners with stats and growth rate
   */
  async getTopEarners(period = 'monthly', limit = 10) {
    if (!['monthly', 'lifetime'].includes(period)) {
      throw {
        code: 'INVALID_PERIOD',
        reason: 'Period must be "monthly" or "lifetime"',
        status: 400
      };
    }

    // Get top earners from CreatorRevenue model
    const topEarners = await CreatorRevenue.getTopEarners(limit, period);

    // Enhance with additional stats
    const enrichedEarners = await Promise.all(
      topEarners.map(async (earner) => {
        const creatorId = earner.creatorId._id;

        // Get unlock stats
        const unlockStats = await PremiumUnlock.getCreatorRevenue(creatorId, {
          startDate: period === 'monthly' ? this._getMonthStart() : null
        });

        // Get subscription stats
        const subscriptionStats = await Subscription.getCreatorStats(creatorId);

        // Calculate growth rate (compare current month vs last month)
        let growthRate = 0;
        if (period === 'monthly' && earner.monthly) {
          const currentEarnings = earner.monthly.current_month_earnings || 0;
          const lastEarnings = earner.monthly.last_month_earnings || 0;
          
          if (lastEarnings > 0) {
            growthRate = ((currentEarnings - lastEarnings) / lastEarnings) * 100;
          } else if (currentEarnings > 0) {
            growthRate = 100; // 100% growth if starting from 0
          }
        }

        return {
          rank: topEarners.indexOf(earner) + 1,
          creator: {
            id: earner.creatorId._id,
            username: earner.creatorId.username,
            profilePhoto: earner.creatorId.profilePhoto,
            category: earner.creatorId.category
          },
          earnings: {
            total_coins: period === 'monthly' 
              ? earner.monthly?.current_month_earnings || 0
              : earner.lifetime?.total_earned_coins || 0,
            total_rupiah: (period === 'monthly' 
              ? earner.monthly?.current_month_earnings || 0
              : earner.lifetime?.total_earned_coins || 0) * 100,
            from_unlocks: unlockStats.creatorShare || 0,
            from_subscriptions: subscriptionStats.totalRevenue_coins || 0
          },
          stats: {
            total_unlocks: earner.lifetime?.total_unlocks || 0,
            total_subscribers: subscriptionStats.activeSubscribers || 0,
            subscriber_count: subscriptionStats.totalSubscribers || 0
          },
          growth: {
            rate_percent: Math.round(growthRate * 10) / 10, // Round to 1 decimal
            trend: growthRate > 0 ? 'up' : growthRate < 0 ? 'down' : 'stable'
          },
          period
        };
      })
    );

    return enrichedEarners;
  }

  /**
   * Get creator revenue summary with detailed breakdown
   * 
   * @param {string} creatorId - Creator ID
   * @param {object} options - { startDate, endDate } for filtering
   * @returns {object} Comprehensive revenue summary
   */
  async getCreatorRevenueSummary(creatorId, options = {}) {
    if (!creatorId) {
      throw {
        code: 'INVALID_INPUT',
        reason: 'creatorId is required',
        status: 400
      };
    }

    // Get creator revenue account
    const creatorRevenue = await CreatorRevenue.getOrCreate(creatorId);

    // Get unlock revenue with filters
    const unlockRevenue = await PremiumUnlock.getCreatorRevenue(creatorId, options);

    // Get subscription stats
    const subscriptionStats = await Subscription.getCreatorStats(creatorId);

    // Calculate total withdrawable
    const totalWithdrawable = creatorRevenue.balance.available_coins;

    // Get monthly comparison
    const currentMonthEarnings = creatorRevenue.monthly?.current_month_earnings || 0;
    const lastMonthEarnings = creatorRevenue.monthly?.last_month_earnings || 0;
    const monthOverMonthChange = lastMonthEarnings > 0 
      ? ((currentMonthEarnings - lastMonthEarnings) / lastMonthEarnings) * 100
      : 0;

    // Get recent withdrawal history (last 5)
    const recentWithdrawals = creatorRevenue.withdrawals
      .slice(-5)
      .reverse()
      .map(w => ({
        amount_coins: w.amount_coins,
        amount_rupiah: w.amount_coins * 100,
        status: w.status,
        withdrawnAt: w.withdrawnAt
      }));

    return {
      creatorId,
      balance: {
        available_coins: creatorRevenue.balance.available_coins,
        available_rupiah: creatorRevenue.balance.available_coins * 100,
        pending_coins: creatorRevenue.balance.pending_coins,
        pending_rupiah: creatorRevenue.balance.pending_coins * 100,
        withdrawn_coins: creatorRevenue.balance.withdrawn_coins,
        withdrawn_rupiah: creatorRevenue.balance.withdrawn_coins * 100,
        total_coins: totalWithdrawable + creatorRevenue.balance.pending_coins,
        total_rupiah: (totalWithdrawable + creatorRevenue.balance.pending_coins) * 100
      },
      lifetime: {
        total_earned_coins: creatorRevenue.lifetime.total_earned_coins,
        total_earned_rupiah: creatorRevenue.lifetime.total_earned_coins * 100,
        total_unlocks: creatorRevenue.lifetime.total_unlocks,
        total_subscribers: creatorRevenue.lifetime.total_subscribers
      },
      monthly: {
        current_month_earnings_coins: currentMonthEarnings,
        current_month_earnings_rupiah: currentMonthEarnings * 100,
        last_month_earnings_coins: lastMonthEarnings,
        last_month_earnings_rupiah: lastMonthEarnings * 100,
        month_over_month_change_percent: Math.round(monthOverMonthChange * 10) / 10,
        trend: monthOverMonthChange > 0 ? 'up' : monthOverMonthChange < 0 ? 'down' : 'stable'
      },
      sources: {
        unlocks: {
          total_unlocks: unlockRevenue.totalUnlocks || 0,
          total_revenue_coins: unlockRevenue.totalRevenue || 0,
          creator_share_coins: unlockRevenue.creatorShare || 0,
          creator_share_rupiah: (unlockRevenue.creatorShare || 0) * 100
        },
        subscriptions: {
          active_subscribers: subscriptionStats.activeSubscribers || 0,
          total_subscribers: subscriptionStats.totalSubscribers || 0,
          total_revenue_coins: subscriptionStats.totalRevenue_coins || 0,
          total_revenue_rupiah: (subscriptionStats.totalRevenue_coins || 0) * 100,
          average_price_coins: subscriptionStats.averagePrice_coins || 0
        }
      },
      withdrawals: {
        recent: recentWithdrawals,
        total_withdrawn_coins: creatorRevenue.balance.withdrawn_coins,
        total_withdrawn_rupiah: creatorRevenue.balance.withdrawn_coins * 100
      },
      payment_info: {
        verified: creatorRevenue.paymentInfo?.verified || false,
        has_bank_details: !!(creatorRevenue.paymentInfo?.bankName && creatorRevenue.paymentInfo?.accountNumber)
      },
      settings: {
        auto_withdraw_enabled: creatorRevenue.settings?.autoWithdrawEnabled || false,
        auto_withdraw_threshold_coins: creatorRevenue.settings?.autoWithdrawThreshold_coins || 1000
      }
    };
  }

  /**
   * Get platform revenue overview (admin only)
   * 
   * @param {object} options - { startDate, endDate }
   * @returns {object} Platform revenue summary
   */
  async getPlatformRevenue(options = {}) {
    // Get platform revenue from unlocks (25% platform share)
    const unlockRevenue = await PremiumUnlock.getPlatformRevenue(options);

    // Get total subscription revenue (25% platform share)
    const allSubscriptions = await Subscription.aggregate([
      {
        $match: {
          status: { $in: ['active', 'expired', 'cancelled'] },
          ...(options.startDate && { createdAt: { $gte: new Date(options.startDate) } }),
          ...(options.endDate && { createdAt: { $lte: new Date(options.endDate) } })
        }
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$price_coins' },
          totalSubscriptions: { $sum: 1 }
        }
      }
    ]);

    const subscriptionTotalRevenue = allSubscriptions[0]?.totalRevenue || 0;
    const subscriptionPlatformShare = Math.floor(subscriptionTotalRevenue * 0.25);

    // Calculate totals
    const totalPlatformRevenue = (unlockRevenue.platformShare || 0) + subscriptionPlatformShare;
    const totalProcessingFees = unlockRevenue.processingFees || 0;
    const totalCreatorPayouts = (unlockRevenue.creatorShare || 0) + Math.floor(subscriptionTotalRevenue * 0.70);

    return {
      platform_revenue: {
        total_coins: totalPlatformRevenue,
        total_rupiah: totalPlatformRevenue * 100,
        from_unlocks: unlockRevenue.platformShare || 0,
        from_subscriptions: subscriptionPlatformShare
      },
      processing_fees: {
        total_coins: totalProcessingFees,
        total_rupiah: totalProcessingFees * 100
      },
      creator_payouts: {
        total_coins: totalCreatorPayouts,
        total_rupiah: totalCreatorPayouts * 100
      },
      transactions: {
        total_unlocks: unlockRevenue.totalUnlocks || 0,
        total_subscriptions: allSubscriptions[0]?.totalSubscriptions || 0,
        total_transactions: (unlockRevenue.totalUnlocks || 0) + (allSubscriptions[0]?.totalSubscriptions || 0)
      },
      period: {
        startDate: options.startDate || null,
        endDate: options.endDate || null
      }
    };
  }

  /**
   * Get top performing content by revenue
   * 
   * @param {string} creatorId - Optional creator filter
   * @param {number} limit - Number of results (default: 10)
   * @param {number} days - Days to look back (default: 30)
   * @returns {array} Top content by unlocks and revenue
   */
  async getTopContent(creatorId = null, limit = 10, days = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const matchStage = {
      txStatus: 'completed',
      createdAt: { $gte: startDate }
    };

    if (creatorId) {
      matchStage.creatorId = creatorId;
    }

    const topContent = await PremiumUnlock.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: '$contentId',
          total_unlocks: { $sum: 1 },
          total_revenue: { $sum: '$amount_coins' },
          creator_earnings: { $sum: '$creator_share' }
        }
      },
      { $sort: { total_revenue: -1 } },
      { $limit: limit }
    ]);

    // Populate content details
    const enrichedContent = await Promise.all(
      topContent.map(async (item) => {
        const content = await require('../models/PremiumContent')
          .findById(item._id)
          .populate('creatorId', 'username profilePhoto')
          .lean();

        if (!content) return null;

        return {
          rank: topContent.indexOf(item) + 1,
          content: {
            id: content._id,
            title: content.title,
            category: content.category,
            mediaType: content.mediaType,
            thumbnailUrl: content.thumbnailUrl
          },
          creator: {
            id: content.creatorId._id,
            username: content.creatorId.username,
            profilePhoto: content.creatorId.profilePhoto
          },
          performance: {
            total_unlocks: item.total_unlocks,
            total_revenue_coins: item.total_revenue,
            total_revenue_rupiah: item.total_revenue * 100,
            creator_earnings_coins: item.creator_earnings,
            creator_earnings_rupiah: item.creator_earnings * 100,
            average_price_coins: Math.round(item.total_revenue / item.total_unlocks)
          },
          period_days: days
        };
      })
    );

    return enrichedContent.filter(item => item !== null);
  }

  /**
   * Get revenue growth chart data
   * 
   * @param {string} creatorId - Creator ID
   * @param {number} months - Number of months to look back (default: 6)
   * @returns {array} Monthly revenue data points
   */
  async getRevenueGrowthChart(creatorId, months = 6) {
    const chartData = [];
    const now = new Date();

    for (let i = months - 1; i >= 0; i--) {
      const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const nextMonthDate = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
      
      const monthKey = monthDate.toISOString().slice(0, 7); // "2025-11"

      // Get unlock revenue for this month
      const unlockRevenue = await PremiumUnlock.getCreatorRevenue(creatorId, {
        startDate: monthDate,
        endDate: nextMonthDate
      });

      // Get subscription revenue for this month
      const subscriptionRevenue = await Subscription.aggregate([
        {
          $match: {
            creatorId: require('mongoose').Types.ObjectId(creatorId),
            createdAt: { $gte: monthDate, $lt: nextMonthDate }
          }
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$price_coins' }
          }
        }
      ]);

      const subscriptionTotal = subscriptionRevenue[0]?.total || 0;
      const subscriptionCreatorShare = Math.floor(subscriptionTotal * 0.70);

      chartData.push({
        month: monthKey,
        month_name: monthDate.toLocaleString('default', { month: 'long', year: 'numeric' }),
        unlocks: {
          count: unlockRevenue.totalUnlocks || 0,
          revenue_coins: unlockRevenue.creatorShare || 0
        },
        subscriptions: {
          count: 0, // Could add subscription count if needed
          revenue_coins: subscriptionCreatorShare
        },
        total_revenue_coins: (unlockRevenue.creatorShare || 0) + subscriptionCreatorShare,
        total_revenue_rupiah: ((unlockRevenue.creatorShare || 0) + subscriptionCreatorShare) * 100
      });
    }

    return chartData;
  }

  /**
   * Helper: Get start of current month
   * @private
   */
  _getMonthStart() {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  }
}

module.exports = new RevenueAnalyticsService();
