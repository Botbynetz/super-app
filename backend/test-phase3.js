#!/usr/bin/env node
/**
 * Phase 3 Automated Testing Script
 * Tests all AI features without external dependencies
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:5000/api';
let authToken = '';
let userId = '';
let chatbotId = '';
let eventId = '';

// Test results tracker
const results = {
  passed: 0,
  failed: 0,
  tests: []
};

// Helper functions
const log = (message, type = 'info') => {
  const colors = {
    info: '\x1b[36m',
    success: '\x1b[32m',
    error: '\x1b[31m',
    warning: '\x1b[33m'
  };
  console.log(`${colors[type]}${message}\x1b[0m`);
};

const test = async (name, fn) => {
  try {
    await fn();
    log(`✓ ${name}`, 'success');
    results.passed++;
    results.tests.push({ name, status: 'PASS' });
  } catch (error) {
    log(`✗ ${name}: ${error.message}`, 'error');
    results.failed++;
    results.tests.push({ name, status: 'FAIL', error: error.message });
  }
};

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 10000
});

// Add auth token to all requests
api.interceptors.request.use(config => {
  if (authToken) {
    config.headers.Authorization = `Bearer ${authToken}`;
  }
  return config;
});

// ====================
// TEST SUITE
// ====================

async function runTests() {
  log('\n🧪 Starting Phase 3 Automated Tests\n', 'info');
  log('='.repeat(60), 'info');

  // Step 1: Authentication
  log('\n📝 Step 1: Authentication', 'warning');
  await test('Send OTP', async () => {
    const res = await api.post('/auth/send-otp', {
      phoneNumber: '+6281234567890'
    });
    if (!res.data.success) throw new Error('OTP send failed');
  });

  await test('Verify OTP (auto-login)', async () => {
    const res = await api.post('/auth/verify-otp', {
      phoneNumber: '+6281234567890',
      otp: '123456',
      autoLogin: true
    });
    if (!res.data.token) throw new Error('No token received');
    authToken = res.data.token;
    userId = res.data.user._id;
    log(`  → Token: ${authToken.substring(0, 20)}...`, 'info');
    log(`  → User ID: ${userId}`, 'info');
  });

  // Step 2: Seed Data
  log('\n📦 Step 2: Seed Initial Data', 'warning');
  
  await test('Seed Product Templates', async () => {
    const res = await api.post('/ai/seed-product-templates');
    if (!res.data.success || res.data.templates.length < 5) {
      throw new Error('Expected 5+ templates');
    }
    log(`  → ${res.data.templates.length} templates created`, 'info');
  });

  await test('Seed CV Templates', async () => {
    const res = await api.post('/ai/seed-cv-templates');
    if (!res.data.success || res.data.templates.length < 2) {
      throw new Error('Expected 2+ templates');
    }
    log(`  → ${res.data.templates.length} templates created`, 'info');
  });

  await test('Seed Badges', async () => {
    const res = await api.post('/gamification/seed-badges');
    if (!res.data.success) throw new Error('Badge seeding failed');
  });

  // Step 3: Financial Assistant
  log('\n💰 Step 3: Test Financial Assistant', 'warning');

  await test('Create test transaction (add XP)', async () => {
    const res = await api.post('/gamification/add-exp', {
      amount: 100,
      reason: 'Automated test transaction'
    });
    if (!res.data.success) throw new Error('Failed to add XP');
  });

  await test('Generate Financial Report', async () => {
    const res = await api.post('/ai/financial-assistant', {
      userId,
      month: 11,
      year: 2025
    });
    if (!res.data.success || !res.data.report) {
      throw new Error('Report generation failed');
    }
    if (!res.data.report.insights || res.data.report.insights.recommendations.length < 3) {
      throw new Error('Expected 3+ recommendations');
    }
    log(`  → ${res.data.report.insights.recommendations.length} recommendations`, 'info');
  });

  await test('Get Financial Report', async () => {
    const res = await api.get(`/ai/financial-report/${userId}?month=11&year=2025`);
    if (!res.data.success || !res.data.report) {
      throw new Error('Failed to retrieve report');
    }
  });

  await test('Set Financial Targets', async () => {
    const res = await api.post('/ai/financial-targets', {
      userId,
      month: 12,
      year: 2025,
      incomeTarget: 5000,
      expenseLimit: 2000
    });
    if (!res.data.success || !res.data.report.targets) {
      throw new Error('Failed to set targets');
    }
  });

  // Step 4: Product Generator
  log('\n🛍️ Step 4: Test Product Description Generator', 'warning');

  const descriptions = [];
  
  await test('Generate Electronics Product', async () => {
    const res = await api.post('/ai/product-description', {
      productName: 'Smart Watch Pro X',
      category: 'electronics',
      inputs: {
        adjective: 'canggih',
        benefit: 'meningkatkan produktivitas',
        feature1: 'GPS tracking',
        feature2: 'heart rate monitor'
      }
    });
    if (!res.data.success || !res.data.description) {
      throw new Error('Generation failed');
    }
    descriptions.push(res.data.description);
    log(`  → Description: ${res.data.description.substring(0, 60)}...`, 'info');
  });

  await test('Generate Fashion Product', async () => {
    const res = await api.post('/ai/product-description', {
      productName: 'Kaos Premium',
      category: 'fashion',
      inputs: {
        adjective: 'nyaman',
        material: '100% cotton',
        quality: 'premium'
      }
    });
    if (!res.data.success) throw new Error('Generation failed');
    descriptions.push(res.data.description);
  });

  await test('Verify synonym variations', async () => {
    const res = await api.post('/ai/product-description', {
      productName: 'Smart Watch Pro X',
      category: 'electronics',
      inputs: {
        adjective: 'canggih',
        benefit: 'meningkatkan produktivitas',
        feature1: 'GPS tracking',
        feature2: 'heart rate monitor'
      }
    });
    if (res.data.description === descriptions[0]) {
      log('  ⚠ Warning: No synonym variation detected', 'warning');
    } else {
      log('  → Synonym variation confirmed', 'info');
    }
  });

  await test('Get all product descriptions', async () => {
    const res = await api.get('/ai/product-descriptions');
    if (!res.data.success || res.data.descriptions.length < 2) {
      throw new Error('Expected 2+ descriptions');
    }
    log(`  → ${res.data.descriptions.length} descriptions found`, 'info');
  });

  // Step 5: Chatbot Builder
  log('\n🤖 Step 5: Test Chatbot Generator', 'warning');

  await test('Create chatbot with flows', async () => {
    const res = await api.post('/ai/chatbot-generator', {
      name: 'Test Support Bot',
      description: 'Automated test chatbot',
      flows: [
        { trigger: 'hello', triggerType: 'contains', response: 'Hi there!' },
        { trigger: '^price$', triggerType: 'regex', response: 'Prices start from Rp 100k' },
        { trigger: 'thanks', triggerType: 'startsWith', response: 'Welcome!' },
        { trigger: 'help', triggerType: 'exact', response: 'Commands: hello, price, help' }
      ],
      defaultResponse: 'Sorry, I don\'t understand.',
      deploymentType: 'public'
    });
    if (!res.data.success || !res.data.chatbot) {
      throw new Error('Chatbot creation failed');
    }
    chatbotId = res.data.chatbot._id;
    log(`  → Chatbot ID: ${chatbotId}`, 'info');
  });

  await test('Test chatbot - Contains match', async () => {
    const res = await api.post(`/ai/chatbot/${chatbotId}/message`, {
      message: 'Hi hello there'
    });
    if (!res.data.success || res.data.response !== 'Hi there!') {
      throw new Error('Expected "Hi there!"');
    }
  });

  await test('Test chatbot - Regex match', async () => {
    const res = await api.post(`/ai/chatbot/${chatbotId}/message`, {
      message: 'price'
    });
    if (!res.data.success || !res.data.response.includes('100k')) {
      throw new Error('Regex match failed');
    }
  });

  await test('Test chatbot - StartsWith match', async () => {
    const res = await api.post(`/ai/chatbot/${chatbotId}/message`, {
      message: 'thanks for help'
    });
    if (!res.data.success || res.data.response !== 'Welcome!') {
      throw new Error('StartsWith match failed');
    }
  });

  await test('Test chatbot - Default response', async () => {
    const res = await api.post(`/ai/chatbot/${chatbotId}/message`, {
      message: 'xyzabc random'
    });
    if (!res.data.success || !res.data.response.includes('don\'t understand')) {
      throw new Error('Default response failed');
    }
  });

  await test('Get chatbot stats', async () => {
    const res = await api.get(`/ai/chatbot/${chatbotId}/stats`);
    if (!res.data.success || res.data.stats.totalInteractions < 4) {
      throw new Error('Expected 4+ interactions');
    }
    log(`  → ${res.data.stats.totalInteractions} interactions tracked`, 'info');
  });

  // Step 6: CV Generator
  log('\n📄 Step 6: Test CV Generator & Freelancer Scoring', 'warning');

  await test('Award badges for scoring', async () => {
    const res = await api.post(`/gamification/check-badges/${userId}`);
    if (!res.data.success) throw new Error('Badge check failed');
  });

  const cvTemplates = await api.post('/ai/seed-cv-templates');
  const templateId = cvTemplates.data.templates[0]._id;

  await test('Generate CV', async () => {
    const res = await api.post('/ai/generate-cv', {
      templateId,
      data: {
        fullName: 'Test User',
        email: 'test@example.com',
        phone: '+6281234567890',
        summary: 'Full Stack Developer',
        skills: ['JavaScript', 'React', 'Node.js'],
        experience: [{
          title: 'Developer',
          company: 'Tech Corp',
          duration: '2020-Present',
          description: 'Built apps'
        }],
        education: [{
          degree: 'Bachelor CS',
          institution: 'University',
          year: '2020'
        }]
      }
    });
    if (!res.data.success || !res.data.cv.generatedHtml) {
      throw new Error('CV generation failed');
    }
    log(`  → HTML length: ${res.data.cv.generatedHtml.length} chars`, 'info');
  });

  await test('Calculate freelancer score', async () => {
    const res = await api.post('/ai/calculate-freelancer-score', { userId });
    if (!res.data.success || typeof res.data.score.scores.totalScore !== 'number') {
      throw new Error('Score calculation failed');
    }
    log(`  → Total score: ${res.data.score.scores.totalScore}`, 'info');
  });

  await test('Get freelancer rankings', async () => {
    const res = await api.get('/ai/freelancer-rankings?limit=10');
    if (!res.data.success) throw new Error('Rankings fetch failed');
    log(`  → ${res.data.rankings.length} users in rankings`, 'info');
  });

  // Step 7: Smart Recommendations
  log('\n🎯 Step 7: Test Smart Recommendations', 'warning');

  await test('Update user preferences', async () => {
    const res = await api.post('/ai/update-preferences', {
      interests: ['programming', 'design', 'photography'],
      preferredEventTypes: ['workshop', 'webinar'],
      preferredContentTypes: ['tutorial', 'news'],
      preferredStreamCategories: ['coding', 'design']
    });
    if (!res.data.success) throw new Error('Preferences update failed');
  });

  await test('Create test event', async () => {
    const res = await api.post('/event/create', {
      title: 'Web Dev Workshop',
      description: 'Learn React and Node.js programming',
      date: '2025-12-01T10:00:00Z',
      category: 'workshop'
    });
    if (!res.data.success) throw new Error('Event creation failed');
    eventId = res.data.event._id;
  });

  await test('Get event recommendations', async () => {
    const res = await api.get('/ai/recommend/events?limit=5');
    if (!res.data.success) throw new Error('Recommendations failed');
    if (res.data.recommendations.length > 0) {
      const firstRec = res.data.recommendations[0];
      if (!firstRec.score || !firstRec.factors) {
        throw new Error('Missing score or factors');
      }
      log(`  → ${res.data.recommendations.length} events recommended`, 'info');
      log(`  → Top score: ${firstRec.score}`, 'info');
    }
  });

  await test('Get user recommendations', async () => {
    const res = await api.get('/ai/recommend/users?limit=5');
    if (!res.data.success) throw new Error('User recommendations failed');
    log(`  → ${res.data.recommendations.length} users recommended`, 'info');
  });

  await test('Track interaction', async () => {
    const res = await api.post('/ai/track-interaction', {
      itemId: eventId,
      itemType: 'event',
      action: 'view'
    });
    if (!res.data.success) throw new Error('Tracking failed');
  });

  // Summary
  log('\n' + '='.repeat(60), 'info');
  log('\n📊 Test Results Summary\n', 'warning');
  log(`Total Tests: ${results.passed + results.failed}`, 'info');
  log(`✓ Passed: ${results.passed}`, 'success');
  log(`✗ Failed: ${results.failed}`, 'error');
  log(`Success Rate: ${((results.passed / (results.passed + results.failed)) * 100).toFixed(1)}%\n`, 'info');

  if (results.failed > 0) {
    log('Failed Tests:', 'error');
    results.tests
      .filter(t => t.status === 'FAIL')
      .forEach(t => log(`  - ${t.name}: ${t.error}`, 'error'));
  }

  log('\n' + '='.repeat(60), 'info');
  
  process.exit(results.failed > 0 ? 1 : 0);
}

// Run tests
runTests().catch(err => {
  log(`\n❌ Test suite failed: ${err.message}`, 'error');
  process.exit(1);
});
