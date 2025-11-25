/**
 * Revenue Configuration
 * Centralized revenue splitting logic and fee structures
 */

module.exports = {
  /**
   * Revenue Split Percentages (in basis points - 1/100th of a percent)
   * 10000 basis points = 100%
   */
  REVENUE_SPLIT: {
    // Premium content unlock
    PREMIUM_UNLOCK: {
      PLATFORM_FEE_BPS: 3000,  // 30% to platform
      CREATOR_SHARE_BPS: 7000  // 70% to creator
    },

    // Subscription
    SUBSCRIPTION: {
      PLATFORM_FEE_BPS: 2000,  // 20% to platform
      CREATOR_SHARE_BPS: 8000  // 80% to creator
    },

    // Gift/Tipping
    GIFT: {
      PLATFORM_FEE_BPS: 1000,  // 10% to platform
      CREATOR_SHARE_BPS: 9000  // 90% to creator
    },

    // Livestream donations
    LIVESTREAM_DONATION: {
      PLATFORM_FEE_BPS: 1500,  // 15% to platform
      CREATOR_SHARE_BPS: 8500  // 85% to creator
    }
  },

  /**
   * Transaction Fees (in cents)
   */
  TRANSACTION_FEES: {
    // Withdrawal fees
    WITHDRAWAL: {
      FIXED_FEE_CENTS: 5000,      // Rp 50 fixed fee
      PERCENTAGE_BPS: 200,         // 2% variable fee
      MIN_FEE_CENTS: 5000,         // Min Rp 50
      MAX_FEE_CENTS: 2500000       // Max Rp 25,000
    },

    // Top-up fees (if applicable)
    TOPUP: {
      FIXED_FEE_CENTS: 0,          // No fixed fee
      PERCENTAGE_BPS: 0,           // No percentage fee
      MIN_FEE_CENTS: 0,
      MAX_FEE_CENTS: 0
    },

    // Transfer between users
    TRANSFER: {
      FIXED_FEE_CENTS: 0,          // No fee for P2P transfers
      PERCENTAGE_BPS: 0,
      MIN_FEE_CENTS: 0,
      MAX_FEE_CENTS: 0
    }
  },

  /**
   * Minimum and Maximum Limits (in cents)
   */
  LIMITS: {
    // Content pricing limits
    PREMIUM_CONTENT: {
      MIN_PRICE_CENTS: 500,        // Min Rp 5
      MAX_PRICE_CENTS: 100000000,  // Max Rp 1,000,000
      RECOMMENDED_MIN: 10000,      // Recommended min Rp 100
      RECOMMENDED_MAX: 10000000    // Recommended max Rp 100,000
    },

    // Subscription pricing limits
    SUBSCRIPTION: {
      MIN_PRICE_CENTS: 1000,       // Min Rp 10/month
      MAX_PRICE_CENTS: 50000000,   // Max Rp 500,000/month
      RECOMMENDED_MIN: 50000,      // Recommended min Rp 500
      RECOMMENDED_MAX: 10000000    // Recommended max Rp 100,000
    },

    // Gift amounts
    GIFT: {
      MIN_AMOUNT_CENTS: 100,       // Min Rp 1
      MAX_AMOUNT_CENTS: 100000000, // Max Rp 1,000,000
      RECOMMENDED_AMOUNTS: [       // Recommended gift amounts (in cents)
        10000,   // Rp 100
        50000,   // Rp 500
        100000,  // Rp 1,000
        500000,  // Rp 5,000
        1000000  // Rp 10,000
      ]
    },

    // Wallet limits
    WALLET: {
      MIN_BALANCE_CENTS: 0,
      MAX_BALANCE_CENTS: 1000000000, // Max Rp 10,000,000
      MIN_TOPUP_CENTS: 10000,        // Min Rp 100
      MAX_TOPUP_CENTS: 100000000,    // Max Rp 1,000,000
      MIN_WITHDRAWAL_CENTS: 50000,   // Min Rp 500
      MAX_WITHDRAWAL_CENTS: 50000000 // Max Rp 500,000 per transaction
    },

    // Creator payout limits
    PAYOUT: {
      MIN_PAYOUT_CENTS: 100000,      // Min Rp 1,000
      MAX_PAYOUT_CENTS: 100000000,   // Max Rp 1,000,000 per request
      MIN_PENDING_BALANCE: 50000     // Must have at least Rp 500 pending
    }
  },

  /**
   * Calculate revenue split
   * @param {number} totalAmount_cents - Total transaction amount in cents
   * @param {string} revenueType - Type of revenue (PREMIUM_UNLOCK, SUBSCRIPTION, GIFT, etc.)
   * @returns {object} Split breakdown
   */
  calculateRevenueSplit(totalAmount_cents, revenueType) {
    const split = this.REVENUE_SPLIT[revenueType];
    
    if (!split) {
      throw new Error(`Invalid revenue type: ${revenueType}`);
    }

    const platformFee_cents = Math.floor((totalAmount_cents * split.PLATFORM_FEE_BPS) / 10000);
    const creatorShare_cents = totalAmount_cents - platformFee_cents;

    return {
      totalAmount_cents,
      platformFee_cents,
      creatorShare_cents,
      platformFeeBps: split.PLATFORM_FEE_BPS,
      creatorShareBps: split.CREATOR_SHARE_BPS,
      platformFeePercentage: (split.PLATFORM_FEE_BPS / 100).toFixed(2) + '%',
      creatorSharePercentage: (split.CREATOR_SHARE_BPS / 100).toFixed(2) + '%'
    };
  },

  /**
   * Calculate transaction fee
   * @param {number} amount_cents - Transaction amount in cents
   * @param {string} feeType - Type of fee (WITHDRAWAL, TOPUP, TRANSFER)
   * @returns {object} Fee breakdown
   */
  calculateTransactionFee(amount_cents, feeType) {
    const fee = this.TRANSACTION_FEES[feeType];
    
    if (!fee) {
      throw new Error(`Invalid fee type: ${feeType}`);
    }

    // Calculate percentage fee
    let calculatedFee_cents = fee.FIXED_FEE_CENTS + Math.floor((amount_cents * fee.PERCENTAGE_BPS) / 10000);

    // Apply min/max limits
    calculatedFee_cents = Math.max(calculatedFee_cents, fee.MIN_FEE_CENTS);
    calculatedFee_cents = Math.min(calculatedFee_cents, fee.MAX_FEE_CENTS);

    return {
      amount_cents,
      fee_cents: calculatedFee_cents,
      netAmount_cents: amount_cents - calculatedFee_cents,
      fixedFee_cents: fee.FIXED_FEE_CENTS,
      percentageBps: fee.PERCENTAGE_BPS,
      percentageFeeAmount_cents: Math.floor((amount_cents * fee.PERCENTAGE_BPS) / 10000)
    };
  },

  /**
   * Validate amount against limits
   * @param {number} amount_cents - Amount to validate
   * @param {string} limitType - Type of limit (PREMIUM_CONTENT, SUBSCRIPTION, etc.)
   * @returns {object} Validation result
   */
  validateAmount(amount_cents, limitType) {
    const limit = this.LIMITS[limitType];
    
    if (!limit) {
      throw new Error(`Invalid limit type: ${limitType}`);
    }

    const isValid = amount_cents >= limit.MIN_PRICE_CENTS && amount_cents <= limit.MAX_PRICE_CENTS;
    const isRecommended = limit.RECOMMENDED_MIN && limit.RECOMMENDED_MAX
      ? amount_cents >= limit.RECOMMENDED_MIN && amount_cents <= limit.RECOMMENDED_MAX
      : true;

    return {
      isValid,
      isRecommended,
      amount_cents,
      min_cents: limit.MIN_PRICE_CENTS || limit.MIN_AMOUNT_CENTS,
      max_cents: limit.MAX_PRICE_CENTS || limit.MAX_AMOUNT_CENTS,
      recommended_min_cents: limit.RECOMMENDED_MIN,
      recommended_max_cents: limit.RECOMMENDED_MAX,
      message: isValid 
        ? (isRecommended ? 'Amount is valid and within recommended range' : 'Amount is valid but outside recommended range')
        : 'Amount is outside allowed limits'
    };
  },

  /**
   * Get recommended pricing suggestions
   * @param {string} type - Type of pricing (PREMIUM_CONTENT, SUBSCRIPTION, GIFT)
   * @returns {object} Pricing suggestions
   */
  getPricingSuggestions(type) {
    const limit = this.LIMITS[type];
    
    if (!limit) {
      throw new Error(`Invalid pricing type: ${type}`);
    }

    if (type === 'GIFT' && limit.RECOMMENDED_AMOUNTS) {
      return {
        type,
        recommended: limit.RECOMMENDED_AMOUNTS,
        min: limit.MIN_AMOUNT_CENTS,
        max: limit.MAX_AMOUNT_CENTS,
        currency: 'IDR'
      };
    }

    // Generate tiered pricing for content/subscription
    const tiers = [
      { label: 'Basic', amount_cents: limit.RECOMMENDED_MIN },
      { label: 'Standard', amount_cents: Math.floor((limit.RECOMMENDED_MIN + limit.RECOMMENDED_MAX) / 2) },
      { label: 'Premium', amount_cents: limit.RECOMMENDED_MAX }
    ];

    return {
      type,
      tiers,
      min: limit.MIN_PRICE_CENTS,
      max: limit.MAX_PRICE_CENTS,
      currency: 'IDR'
    };
  },

  /**
   * Currency formatting helper
   * @param {number} cents - Amount in cents
   * @param {string} currency - Currency code (default: IDR)
   * @returns {string} Formatted currency string
   */
  formatCurrency(cents, currency = 'IDR') {
    const amount = cents / 100;
    
    if (currency === 'IDR') {
      return `Rp ${amount.toLocaleString('id-ID')}`;
    } else if (currency === 'USD') {
      return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    
    return `${amount.toLocaleString()} ${currency}`;
  }
};
