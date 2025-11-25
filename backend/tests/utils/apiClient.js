/**
 * API Client Utility
 * Supertest wrapper with automatic authentication
 */

const request = require('supertest');
const jwt = require('jsonwebtoken');

class ApiClient {
  constructor(app, token = null) {
    this.app = app;
    this.token = token;
  }

  /**
   * Set authentication token
   */
  setToken(token) {
    this.token = token;
    return this;
  }

  /**
   * Generate JWT token for user
   */
  generateToken(userId, expiresIn = '24h') {
    const secret = process.env.JWT_SECRET || 'test-secret-key-123';
    return jwt.sign({ id: userId }, secret, { expiresIn });
  }

  /**
   * Authenticate as user and set token
   */
  async authenticateAs(userId) {
    this.token = this.generateToken(userId);
    return this;
  }

  /**
   * GET request with auto auth
   */
  get(url) {
    const req = request(this.app).get(url);
    if (this.token) {
      req.set('Authorization', `Bearer ${this.token}`);
    }
    return req;
  }

  /**
   * POST request with auto auth
   */
  post(url, body = {}) {
    const req = request(this.app)
      .post(url)
      .send(body);
    if (this.token) {
      req.set('Authorization', `Bearer ${this.token}`);
    }
    return req;
  }

  /**
   * PUT request with auto auth
   */
  put(url, body = {}) {
    const req = request(this.app)
      .put(url)
      .send(body);
    if (this.token) {
      req.set('Authorization', `Bearer ${this.token}`);
    }
    return req;
  }

  /**
   * PATCH request with auto auth
   */
  patch(url, body = {}) {
    const req = request(this.app)
      .patch(url)
      .send(body);
    if (this.token) {
      req.set('Authorization', `Bearer ${this.token}`);
    }
    return req;
  }

  /**
   * DELETE request with auto auth
   */
  delete(url) {
    const req = request(this.app).delete(url);
    if (this.token) {
      req.set('Authorization', `Bearer ${this.token}`);
    }
    return req;
  }

  /**
   * Multipart form data POST (for file uploads)
   */
  postMultipart(url) {
    const req = request(this.app)
      .post(url)
      .type('multipart/form-data');
    if (this.token) {
      req.set('Authorization', `Bearer ${this.token}`);
    }
    return req;
  }
}

module.exports = ApiClient;
