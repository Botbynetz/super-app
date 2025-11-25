/**
 * PHASE 6 - Telegram Operations Bot
 * Sends alerts for critical errors, fraud detection, and server events
 */

const axios = require('axios');
const { logger } = require('./logger');

class TelegramBot {
  constructor() {
    this.token = process.env.TELEGRAM_BOT_TOKEN;
    this.adminChatId = process.env.TELEGRAM_ADMIN_CHAT_ID;
    this.enabled = process.env.TELEGRAM_ALERTS_ENABLED === 'true';
    
    if (!this.token || !this.adminChatId) {
      logger.warn('⚠️  Telegram bot not configured');
      this.enabled = false;
    } else if (this.enabled) {
      logger.info('✅ Telegram bot initialized');
      this.sendStartupNotification();
    }
  }

  /**
   * Send message to admin
   */
  async sendMessage(text, options = {}) {
    if (!this.enabled) {
      return;
    }

    try {
      const url = `https://api.telegram.org/bot${this.token}/sendMessage`;
      
      await axios.post(url, {
        chat_id: this.adminChatId,
        text,
        parse_mode: options.parseMode || 'HTML',
        disable_notification: options.silent || false,
      });
      
      logger.debug('Telegram message sent successfully');
    } catch (error) {
      logger.error('Failed to send Telegram message:', error.message);
    }
  }

  /**
   * Send startup notification
   */
  async sendStartupNotification() {
    const message = `
🚀 <b>Server Started</b>

Environment: ${process.env.NODE_ENV}
Time: ${new Date().toISOString()}
PID: ${process.pid}
Node Version: ${process.version}

Status: ✅ All systems operational
    `.trim();

    await this.sendMessage(message);
  }

  /**
   * Send critical error alert
   */
  async sendErrorAlert(error, context = {}) {
    const message = `
❌ <b>Critical Error Detected</b>

<b>Error:</b> ${error.message}
<b>Type:</b> ${error.name}
<b>Time:</b> ${new Date().toISOString()}

<b>Context:</b>
${Object.entries(context).map(([key, value]) => `  ${key}: ${value}`).join('\n')}

<b>Stack:</b>
<code>${error.stack?.split('\n').slice(0, 5).join('\n')}</code>
    `.trim();

    await this.sendMessage(message);
  }

  /**
   * Send fraud alert
   */
  async sendFraudAlert(userId, reason, riskScore) {
    const message = `
🚨 <b>Fraud Alert</b>

<b>User ID:</b> ${userId}
<b>Risk Score:</b> ${riskScore}/100
<b>Reason:</b> ${reason}
<b>Time:</b> ${new Date().toISOString()}

Action: ${riskScore > 80 ? '⚠️ AUTO-FREEZE TRIGGERED' : '⚠️ Monitoring'}
    `.trim();

    await this.sendMessage(message);
  }

  /**
   * Send high-value transaction alert
   */
  async sendHighValueAlert(transaction) {
    const message = `
💰 <b>High-Value Transaction</b>

<b>Amount:</b> ${transaction.amount} coins
<b>Type:</b> ${transaction.type}
<b>From:</b> ${transaction.fromUser}
<b>To:</b> ${transaction.toUser}
<b>Time:</b> ${new Date().toISOString()}

Status: ✅ Completed
    `.trim();

    await this.sendMessage(message);
  }

  /**
   * Send payout request notification
   */
  async sendPayoutRequest(creator, amount) {
    const message = `
💵 <b>Payout Request</b>

<b>Creator:</b> ${creator.username} (${creator.id})
<b>Amount:</b> ${amount} coins
<b>Time:</b> ${new Date().toISOString()}

⚠️ Approval required
    `.trim();

    await this.sendMessage(message);
  }

  /**
   * Send database connection error
   */
  async sendDatabaseError() {
    const message = `
🔴 <b>Database Connection Lost</b>

<b>Time:</b> ${new Date().toISOString()}
<b>Environment:</b> ${process.env.NODE_ENV}

Action: Attempting reconnection...
    `.trim();

    await this.sendMessage(message);
  }

  /**
   * Send memory warning
   */
  async sendMemoryWarning(usage) {
    const message = `
⚠️ <b>High Memory Usage</b>

<b>Heap Used:</b> ${usage.heapUsed} MB
<b>Heap Total:</b> ${usage.heapTotal} MB
<b>Usage:</b> ${usage.percentage}%
<b>Time:</b> ${new Date().toISOString()}

Action: Monitoring for memory leaks
    `.trim();

    await this.sendMessage(message);
  }

  /**
   * Send deployment notification
   */
  async sendDeploymentNotification(version, status) {
    const icon = status === 'success' ? '✅' : '❌';
    const message = `
${icon} <b>Deployment ${status}</b>

<b>Version:</b> ${version}
<b>Environment:</b> ${process.env.NODE_ENV}
<b>Time:</b> ${new Date().toISOString()}

${status === 'success' ? 'All systems operational' : 'Check logs for details'}
    `.trim();

    await this.sendMessage(message);
  }

  /**
   * Send daily summary
   */
  async sendDailySummary(metrics) {
    const message = `
📊 <b>Daily Summary</b>

<b>Users Active:</b> ${metrics.activeUsers}
<b>Transactions:</b> ${metrics.totalTransactions}
<b>Revenue:</b> ${metrics.totalRevenue} coins
<b>Premium Unlocks:</b> ${metrics.premiumUnlocks}
<b>Subscriptions:</b> ${metrics.subscriptionPurchases}
<b>Gifts Sent:</b> ${metrics.giftsSent}
<b>Fraud Alerts:</b> ${metrics.fraudAlerts}
<b>Errors:</b> ${metrics.errors}

Date: ${new Date().toLocaleDateString()}
    `.trim();

    await this.sendMessage(message);
  }

  /**
   * Send custom alert
   */
  async sendCustomAlert(title, details, priority = 'normal') {
    const icon = priority === 'high' ? '🚨' : priority === 'medium' ? '⚠️' : 'ℹ️';
    
    const message = `
${icon} <b>${title}</b>

${details}

<b>Time:</b> ${new Date().toISOString()}
    `.trim();

    await this.sendMessage(message, { silent: priority === 'low' });
  }
}

// Create singleton instance
const telegramBot = new TelegramBot();

// Monitor process events
if (telegramBot.enabled) {
  // Uncaught exceptions
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception:', error);
    telegramBot.sendErrorAlert(error, { type: 'uncaughtException' });
    
    // Give time for alert to send before exit
    setTimeout(() => {
      process.exit(1);
    }, 1000);
  });

  // Unhandled promise rejections
  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection:', reason);
    telegramBot.sendErrorAlert(
      reason instanceof Error ? reason : new Error(String(reason)),
      { type: 'unhandledRejection' }
    );
  });

  // Process warnings
  process.on('warning', (warning) => {
    if (warning.name === 'MaxListenersExceededWarning') {
      telegramBot.sendCustomAlert(
        'Process Warning',
        `${warning.name}: ${warning.message}`,
        'medium'
      );
    }
  });

  // Monitor memory usage every 5 minutes
  setInterval(() => {
    const memUsage = process.memoryUsage();
    const heapUsed = Math.round(memUsage.heapUsed / 1024 / 1024);
    const heapTotal = Math.round(memUsage.heapTotal / 1024 / 1024);
    const percentage = Math.round((heapUsed / heapTotal) * 100);

    if (percentage > 90) {
      telegramBot.sendMemoryWarning({
        heapUsed,
        heapTotal,
        percentage,
      });
    }
  }, 5 * 60 * 1000);

  // Send daily summary at midnight
  const scheduleDailySummary = () => {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    
    const timeUntilMidnight = tomorrow - now;
    
    setTimeout(() => {
      const { telemetry } = require('./monitoring');
      telegramBot.sendDailySummary(telemetry.getMetrics());
      scheduleDailySummary(); // Schedule next
    }, timeUntilMidnight);
  };
  
  scheduleDailySummary();
}

module.exports = telegramBot;
