/**
 * Socket.IO Client Utility for Integration Tests
 */

const io = require('socket.io-client');

class SocketClient {
  constructor(url, token) {
    this.url = url;
    this.token = token;
    this.socket = null;
    this.events = new Map();
  }

  /**
   * Connect to Socket.IO server
   */
  async connect() {
    return new Promise((resolve, reject) => {
      this.socket = io(this.url, {
        auth: { token: this.token },
        transports: ['websocket'],
      });

      this.socket.on('connect', () => {
        console.log('[TEST] Socket.IO client connected');
        resolve();
      });

      this.socket.on('connect_error', (error) => {
        console.error('[TEST] Socket.IO connection error:', error.message);
        reject(error);
      });

      // Setup generic event listener
      this.socket.onAny((eventName, ...args) => {
        console.log(`[TEST] Socket event received: ${eventName}`, args);
        if (this.events.has(eventName)) {
          const callbacks = this.events.get(eventName);
          callbacks.forEach(cb => cb(...args));
        }
      });
    });
  }

  /**
   * Disconnect from server
   */
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.events.clear();
      console.log('[TEST] Socket.IO client disconnected');
    }
  }

  /**
   * Listen for specific event
   */
  on(eventName, callback) {
    if (!this.events.has(eventName)) {
      this.events.set(eventName, []);
    }
    this.events.get(eventName).push(callback);
  }

  /**
   * Wait for specific event with timeout
   */
  waitForEvent(eventName, timeout = 5000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Timeout waiting for event: ${eventName}`));
      }, timeout);

      this.on(eventName, (data) => {
        clearTimeout(timer);
        resolve(data);
      });
    });
  }

  /**
   * Emit event to server
   */
  emit(eventName, data) {
    if (!this.socket) {
      throw new Error('Socket not connected');
    }
    this.socket.emit(eventName, data);
  }

  /**
   * Check if connected
   */
  isConnected() {
    return this.socket && this.socket.connected;
  }
}

module.exports = SocketClient;
