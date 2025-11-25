const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const FinancialReport = require('../models/FinancialReport');
const { ProductTemplate, ProductDescription } = require('../models/ProductTemplate');
const { Chatbot, ChatbotInteraction } = require('../models/Chatbot');
const { CVTemplate, CV, FreelancerScore } = require('../models/CVTemplate');
const { RecommendationScore, UserPreference } = require('../models/RecommendationScore');
const Transaction = require('../models/Transaction');
const UserProgress = require('../models/UserProgress');
const User = require('../models/User');
const Event = require('../models/Event');
const Content = require('../models/Content');
const LiveStream = require('../models/LiveStream');

// ==================== AI FINANCIAL ASSISTANT ====================

// Generate Financial Report
router.post('/ai/financial-assistant', authenticateToken, async (req, res) => {
  try {
    const { userId, month, year } = req.body;
    const targetUserId = userId || req.user.id;
    
    // Calculate income from transactions
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);
    
    const transactions = await Transaction.find({
      userId: targetUserId,
      createdAt: { $gte: startDate, $lte: endDate }
    });
    
    const income = {
      liveStreamGifts: 0,
      boostRevenue: 0,
      premiumContent: 0,
      marketplace: 0,
      affiliate: 0,
      freelanceJobs: 0,
      other: 0
    };
    
    const expenses = {
      giftsSent: 0,
      boostPurchases: 0,
      premiumSubscriptions: 0,
      marketplacePurchases: 0,
      platformFees: 0,
      other: 0
    };
    
    // Categorize transactions
    transactions.forEach(t => {
      if (t.amount > 0) {
        switch(t.type) {
          case 'gift_received':
            income.liveStreamGifts += t.amount;
            break;
          case 'earn_reward':
            income.other += t.amount;
            break;
          case 'level_up':
            income.other += t.amount;
            break;
          default:
            income.other += t.amount;
        }
      } else {
        const absAmount = Math.abs(t.amount);
        switch(t.type) {
          case 'gift_sent':
            expenses.giftsSent += absAmount;
            break;
          case 'boost_stream':
            expenses.boostPurchases += absAmount;
            break;
          default:
            expenses.other += absAmount;
        }
      }
    });
    
    income.total = Object.values(income).reduce((a, b) => a + b, 0);
    expenses.total = Object.values(expenses).reduce((a, b) => a + b, 0);
    const netBalance = income.total - expenses.total;
    
    // Find top categories
    const topIncomeSource = Object.entries(income)
      .filter(([key]) => key !== 'total')
      .sort((a, b) => b[1] - a[1])[0][0];
    
    const topExpenseCategory = Object.entries(expenses)
      .filter(([key]) => key !== 'total')
      .sort((a, b) => b[1] - a[1])[0][0];
    
    // Calculate savings rate
    const savingsRate = income.total > 0 ? ((netBalance / income.total) * 100).toFixed(2) : 0;
    
    // Get last month report for growth calculation
    const lastMonth = month === 1 ? 12 : month - 1;
    const lastYear = month === 1 ? year - 1 : year;
    const lastReport = await FinancialReport.findOne({
      userId: targetUserId,
      month: lastMonth,
      year: lastYear
    });
    
    const growthRate = lastReport && lastReport.income.total > 0
      ? (((income.total - lastReport.income.total) / lastReport.income.total) * 100).toFixed(2)
      : 0;
    
    // Generate recommendations
    const recommendations = [];
    if (savingsRate < 20) {
      recommendations.push('Tingkatkan live streaming untuk income lebih banyak');
    }
    if (expenses.giftsSent > income.liveStreamGifts * 0.5) {
      recommendations.push('Kurangi pengiriman gift, fokus pada earning');
    }
    if (growthRate < 0) {
      recommendations.push('Income menurun, coba boost stream atau ikut event premium');
    }
    if (income.liveStreamGifts === 0) {
      recommendations.push('Mulai live streaming untuk earning tambahan');
    }
    
    // Create or update report
    const report = await FinancialReport.findOneAndUpdate(
      { userId: targetUserId, month, year },
      {
        income,
        expenses,
        netBalance,
        insights: {
          topIncomeSource,
          topExpenseCategory,
          savingsRate: parseFloat(savingsRate),
          growthRate: parseFloat(growthRate),
          recommendations
        },
        isGenerated: true
      },
      { upsert: true, new: true }
    );
    
    res.json({ success: true, report });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get Financial Report
router.get('/ai/financial-report/:userId', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;
    const { month, year } = req.query;
    
    const query = { userId };
    if (month) query.month = parseInt(month);
    if (year) query.year = parseInt(year);
    
    const reports = await FinancialReport.find(query).sort({ year: -1, month: -1 }).limit(12);
    res.json({ success: true, reports });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Set Financial Targets
router.post('/ai/financial-targets', authenticateToken, async (req, res) => {
  try {
    const { userId, month, year, incomeTarget, expenseLimit } = req.body;
    const targetUserId = userId || req.user.id;
    
    const report = await FinancialReport.findOneAndUpdate(
      { userId: targetUserId, month, year },
      { 
        targets: { incomeTarget, expenseLimit }
      },
      { upsert: true, new: true }
    );
    
    res.json({ success: true, report });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== AI PRODUCT DESCRIPTION GENERATOR ====================

// Seed Product Templates
router.post('/ai/seed-product-templates', async (req, res) => {
  try {
    const templates = [
      {
        category: 'electronics',
        template: '{{productName}} adalah {{adjective}} yang {{benefit}}. Dengan {{feature1}} dan {{feature2}}, produk ini {{advantage}}. Cocok untuk {{targetAudience}}.',
        variables: ['productName', 'adjective', 'benefit', 'feature1', 'feature2', 'advantage', 'targetAudience'],
        synonyms: new Map([
          ['great', ['hebat', 'luar biasa', 'canggih', 'modern']],
          ['fast', ['cepat', 'responsif', 'instan', 'kilat']],
          ['quality', ['berkualitas', 'premium', 'terbaik', 'unggulan']]
        ])
      },
      {
        category: 'fashion',
        template: 'Dapatkan {{productName}} yang {{style}} untuk penampilan {{occasion}}. Terbuat dari {{material}} {{quality}}, dengan design {{design}}. {{callToAction}}',
        variables: ['productName', 'style', 'occasion', 'material', 'quality', 'design', 'callToAction'],
        synonyms: new Map([
          ['stylish', ['stylish', 'modis', 'trendy', 'fashionable']],
          ['comfortable', ['nyaman', 'comfortable', 'pas', 'enak dipakai']]
        ])
      },
      {
        category: 'food',
        template: '{{productName}} - {{taste}} yang {{texture}}! Dibuat dari {{ingredients}} {{quality}}. {{benefit}} dan {{advantage}}. Order sekarang!',
        variables: ['productName', 'taste', 'texture', 'ingredients', 'quality', 'benefit', 'advantage'],
        synonyms: new Map([
          ['delicious', ['lezat', 'enak', 'nikmat', 'mantap']],
          ['fresh', ['segar', 'fresh', 'baru', 'alami']]
        ])
      },
      {
        category: 'services',
        template: 'Layanan {{productName}} profesional untuk {{targetAudience}}. Kami menawarkan {{benefit1}}, {{benefit2}}, dan {{benefit3}}. {{experience}} dan {{guarantee}}.',
        variables: ['productName', 'targetAudience', 'benefit1', 'benefit2', 'benefit3', 'experience', 'guarantee'],
        synonyms: new Map([
          ['professional', ['profesional', 'ahli', 'berpengalaman', 'expert']],
          ['fast', ['cepat', 'efisien', 'tepat waktu', 'responsif']]
        ])
      },
      {
        category: 'digital',
        template: '{{productName}} - solusi digital {{benefit}} untuk {{targetAudience}}. Fitur unggulan: {{feature1}}, {{feature2}}, {{feature3}}. {{advantage}} dan mudah digunakan!',
        variables: ['productName', 'benefit', 'targetAudience', 'feature1', 'feature2', 'feature3', 'advantage'],
        synonyms: new Map([
          ['easy', ['mudah', 'simple', 'praktis', 'user-friendly']],
          ['powerful', ['powerful', 'handal', 'kuat', 'optimal']]
        ])
      }
    ];
    
    await ProductTemplate.deleteMany({});
    await ProductTemplate.insertMany(templates);
    
    res.json({ success: true, message: 'Product templates seeded', count: templates.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Generate Product Description
router.post('/ai/product-description', authenticateToken, async (req, res) => {
  try {
    const { productName, category, inputs } = req.body;
    
    // Find template for category
    const templates = await ProductTemplate.find({ category });
    if (templates.length === 0) {
      return res.status(404).json({ error: 'No template found for category' });
    }
    
    // Pick random template
    const template = templates[Math.floor(Math.random() * templates.length)];
    
    // Replace variables in template
    let description = template.template;
    
    // Apply synonyms for variation
    template.synonyms.forEach((synonymList, key) => {
      if (description.includes(key)) {
        const randomSynonym = synonymList[Math.floor(Math.random() * synonymList.length)];
        description = description.replace(new RegExp(key, 'g'), randomSynonym);
      }
    });
    
    // Replace variables with user inputs
    Object.entries(inputs).forEach(([key, value]) => {
      description = description.replace(new RegExp(`{{${key}}}`, 'g'), value);
    });
    
    // Remove unreplaced variables
    description = description.replace(/{{[^}]+}}/g, '[isi disini]');
    
    // Save generated description
    const productDesc = new ProductDescription({
      userId: req.user.id,
      productName,
      category,
      inputs: new Map(Object.entries(inputs)),
      generatedDescription: description,
      templateUsed: template._id
    });
    
    await productDesc.save();
    
    // Update template usage count
    template.usageCount += 1;
    await template.save();
    
    res.json({ 
      success: true, 
      description,
      productId: productDesc._id
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get User's Product Descriptions
router.get('/ai/product-descriptions', authenticateToken, async (req, res) => {
  try {
    const descriptions = await ProductDescription.find({ userId: req.user.id })
      .sort({ createdAt: -1 })
      .limit(50);
    
    res.json({ success: true, descriptions });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


// ==================== AI CHATBOT GENERATOR ====================

// Create Chatbot
router.post('/ai/chatbot-generator', authenticateToken, async (req, res) => {
  try {
    const { name, description, flows, defaultResponse, deploymentType } = req.body;
    
    const chatbot = new Chatbot({
      userId: req.user.id,
      name,
      description,
      flows: flows || [],
      defaultResponse: defaultResponse || 'Maaf, saya tidak mengerti. Coba ketik "help" untuk bantuan.',
      deploymentType: deploymentType || 'private',
      isActive: true
    });
    
    await chatbot.save();
    
    res.json({ 
      success: true, 
      chatbot,
      message: 'Chatbot created successfully'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get User's Chatbots
router.get('/ai/chatbots', authenticateToken, async (req, res) => {
  try {
    const chatbots = await Chatbot.find({ userId: req.user.id }).sort({ createdAt: -1 });
    res.json({ success: true, chatbots });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update Chatbot Flows
router.put('/ai/chatbot/:chatbotId', authenticateToken, async (req, res) => {
  try {
    const { chatbotId } = req.params;
    const updates = req.body;
    
    const chatbot = await Chatbot.findOneAndUpdate(
      { _id: chatbotId, userId: req.user.id },
      updates,
      { new: true }
    );
    
    if (!chatbot) {
      return res.status(404).json({ error: 'Chatbot not found' });
    }
    
    res.json({ success: true, chatbot });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Process Chatbot Message (for testing/interaction)
router.post('/ai/chatbot/:chatbotId/message', authenticateToken, async (req, res) => {
  try {
    const { chatbotId } = req.params;
    const { message } = req.body;
    
    const startTime = Date.now();
    
    const chatbot = await Chatbot.findById(chatbotId);
    if (!chatbot || !chatbot.isActive) {
      return res.status(404).json({ error: 'Chatbot not found or inactive' });
    }
    
    let matchedFlow = null;
    let response = chatbot.defaultResponse;
    
    // Pattern matching
    for (const flow of chatbot.flows) {
      let isMatch = false;
      
      switch(flow.triggerType) {
        case 'exact':
          isMatch = message.toLowerCase() === flow.trigger.toLowerCase();
          break;
        case 'contains':
          isMatch = message.toLowerCase().includes(flow.trigger.toLowerCase());
          break;
        case 'startsWith':
          isMatch = message.toLowerCase().startsWith(flow.trigger.toLowerCase());
          break;
        case 'regex':
          try {
            const regex = new RegExp(flow.trigger, 'i');
            isMatch = regex.test(message);
          } catch (e) {
            isMatch = false;
          }
          break;
      }
      
      if (isMatch) {
        matchedFlow = flow._id;
        response = flow.response;
        break;
      }
    }
    
    const responseTime = Date.now() - startTime;
    
    // Save interaction
    const interaction = new ChatbotInteraction({
      chatbotId,
      userId: req.user.id,
      userMessage: message,
      botResponse: response,
      matchedFlow,
      responseTime
    });
    
    await interaction.save();
    
    // Update chatbot stats
    chatbot.stats.totalInteractions += 1;
    await chatbot.save();
    
    res.json({ 
      success: true, 
      response,
      matchedFlow,
      responseTime
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get Chatbot Stats
router.get('/ai/chatbot/:chatbotId/stats', authenticateToken, async (req, res) => {
  try {
    const { chatbotId } = req.params;
    
    const chatbot = await Chatbot.findOne({ _id: chatbotId, userId: req.user.id });
    if (!chatbot) {
      return res.status(404).json({ error: 'Chatbot not found' });
    }
    
    const interactions = await ChatbotInteraction.find({ chatbotId })
      .sort({ createdAt: -1 })
      .limit(100);
    
    const uniqueUsers = new Set(interactions.map(i => i.userId.toString())).size;
    const avgResponseTime = interactions.length > 0
      ? interactions.reduce((sum, i) => sum + i.responseTime, 0) / interactions.length
      : 0;
    
    res.json({ 
      success: true, 
      stats: {
        ...chatbot.stats.toObject(),
        uniqueUsers,
        averageResponseTime: Math.round(avgResponseTime)
      },
      recentInteractions: interactions.slice(0, 20)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== AI CV GENERATOR & FREELANCER HELPER ====================

// Seed CV Templates
router.post('/ai/seed-cv-templates', async (req, res) => {
  try {
    const templates = [
      {
        name: 'Modern Professional',
        category: 'modern',
        htmlTemplate: `
          <div class="cv-modern">
            <header>
              <h1>{{fullName}}</h1>
              <p>{{email}} | {{phone}} | {{location}}</p>
            </header>
            <section class="summary">{{summary}}</section>
            <section class="skills">
              <h2>Skills</h2>
              <ul>{{skills}}</ul>
            </section>
            <section class="experience">
              <h2>Experience</h2>
              {{experience}}
            </section>
            <section class="education">
              <h2>Education</h2>
              {{education}}
            </section>
            <section class="badges">
              <h2>Achievements & Badges</h2>
              {{badges}}
            </section>
          </div>
        `,
        cssStyles: '.cv-modern { font-family: Arial; padding: 20px; } header { text-align: center; }',
        variables: ['fullName', 'email', 'phone', 'location', 'summary', 'skills', 'experience', 'education', 'badges']
      },
      {
        name: 'Creative Designer',
        category: 'creative',
        htmlTemplate: `
          <div class="cv-creative">
            <div class="sidebar">
              <h1>{{fullName}}</h1>
              <div class="contact">{{email}}<br>{{phone}}</div>
              <div class="skills">{{skills}}</div>
            </div>
            <div class="main">
              <section>{{summary}}</section>
              <section>{{experience}}</section>
              <section>{{portfolio}}</section>
            </div>
          </div>
        `,
        cssStyles: '.cv-creative { display: flex; } .sidebar { width: 30%; background: #f0f0f0; padding: 20px; }',
        variables: ['fullName', 'email', 'phone', 'skills', 'summary', 'experience', 'portfolio']
      }
    ];
    
    await CVTemplate.deleteMany({});
    await CVTemplate.insertMany(templates);
    
    res.json({ success: true, message: 'CV templates seeded', count: templates.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Generate CV
router.post('/ai/generate-cv', authenticateToken, async (req, res) => {
  try {
    const { templateId, data } = req.body;
    
    // Get user progress for auto-fill
    const userProgress = await UserProgress.findOne({ userId: req.user.id }).populate('badges');
    const user = await User.findById(req.user.id);
    
    // Auto-populate data from user profile
    const cvData = {
      fullName: data.fullName || user.fullName || user.username,
      email: data.email || user.email || '',
      phone: data.phone || user.phoneNumber || '',
      location: data.location || '',
      summary: data.summary || '',
      skills: data.skills || [],
      experience: data.experience || [],
      education: data.education || [],
      achievements: data.achievements || [],
      badges: userProgress ? userProgress.badges.map(b => ({
        name: b.name,
        earnedAt: b.earnedAt,
        iconUrl: b.iconUrl
      })) : [],
      events: data.events || [],
      portfolio: data.portfolio || []
    };
    
    // Get template
    const template = await CVTemplate.findById(templateId);
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }
    
    // Generate HTML
    let html = template.htmlTemplate;
    
    // Replace simple variables
    html = html.replace(/{{fullName}}/g, cvData.fullName);
    html = html.replace(/{{email}}/g, cvData.email);
    html = html.replace(/{{phone}}/g, cvData.phone);
    html = html.replace(/{{location}}/g, cvData.location);
    html = html.replace(/{{summary}}/g, cvData.summary);
    
    // Replace skills
    const skillsHtml = cvData.skills.map(s => `<li>${s}</li>`).join('');
    html = html.replace(/{{skills}}/g, skillsHtml);
    
    // Replace experience
    const experienceHtml = cvData.experience.map(e => `
      <div class="exp-item">
        <h3>${e.title}</h3>
        <p>${e.company} | ${e.duration}</p>
        <p>${e.description}</p>
      </div>
    `).join('');
    html = html.replace(/{{experience}}/g, experienceHtml);
    
    // Replace education
    const educationHtml = cvData.education.map(e => `
      <div class="edu-item">
        <h3>${e.degree}</h3>
        <p>${e.institution} | ${e.year}</p>
      </div>
    `).join('');
    html = html.replace(/{{education}}/g, educationHtml);
    
    // Replace badges
    const badgesHtml = cvData.badges.map(b => `
      <div class="badge-item">
        <img src="${b.iconUrl}" alt="${b.name}" />
        <span>${b.name}</span>
      </div>
    `).join('');
    html = html.replace(/{{badges}}/g, badgesHtml);
    
    // Save CV
    const cv = new CV({
      userId: req.user.id,
      templateId,
      data: cvData,
      generatedHtml: html,
      isPublic: false
    });
    
    await cv.save();
    
    // Update template usage
    template.usageCount += 1;
    await template.save();
    
    res.json({ 
      success: true, 
      cv: {
        id: cv._id,
        html,
        createdAt: cv.createdAt
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get User CVs
router.get('/ai/cvs', authenticateToken, async (req, res) => {
  try {
    const cvs = await CV.find({ userId: req.user.id })
      .populate('templateId')
      .sort({ createdAt: -1 });
    
    res.json({ success: true, cvs });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Calculate Freelancer Score
router.post('/ai/calculate-freelancer-score', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.body;
    const targetUserId = userId || req.user.id;
    
    const userProgress = await UserProgress.findOne({ userId: targetUserId }).populate('badges');
    const user = await User.findById(targetUserId);
    
    if (!userProgress || !user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Calculate scores
    const scores = {
      skillMatch: 0,
      eventParticipation: 0,
      badgeQuality: 0,
      userRating: 0,
      completionRate: 0,
      responseTime: 0,
      totalScore: 0
    };
    
    // Skill match score (based on number of skills/badges)
    scores.skillMatch = Math.min(userProgress.badges.length * 10, 100);
    
    // Event participation score
    scores.eventParticipation = Math.min(userProgress.stats.totalEventsJoined * 5, 100);
    
    // Badge quality score (legendary=40, epic=30, rare=20, common=10)
    const badgePoints = userProgress.badges.reduce((sum, badge) => {
      switch(badge.rarity) {
        case 'legendary': return sum + 40;
        case 'epic': return sum + 30;
        case 'rare': return sum + 20;
        default: return sum + 10;
      }
    }, 0);
    scores.badgeQuality = Math.min(badgePoints, 100);
    
    // User rating (default 4.5 if no rating system)
    scores.userRating = 4.5;
    
    // Completion rate (placeholder - 85%)
    scores.completionRate = 85;
    
    // Response time (placeholder - 2 hours)
    scores.responseTime = 2;
    
    // Calculate total score (weighted average)
    scores.totalScore = Math.round(
      (scores.skillMatch * 0.25) +
      (scores.eventParticipation * 0.20) +
      (scores.badgeQuality * 0.25) +
      (scores.userRating * 15) + // out of 5, so multiply by 15 to get max 75
      (scores.completionRate * 0.15)
    );
    
    // Extract skills from badges
    const skills = userProgress.badges.map(badge => ({
      name: badge.name,
      level: badge.rarity === 'legendary' ? 5 : badge.rarity === 'epic' ? 4 : badge.rarity === 'rare' ? 3 : 2,
      verifiedBy: [badge.name]
    }));
    
    // Update or create freelancer score
    const freelancerScore = await FreelancerScore.findOneAndUpdate(
      { userId: targetUserId },
      {
        skills,
        scores,
        lastUpdated: new Date()
      },
      { upsert: true, new: true }
    );
    
    res.json({ success: true, freelancerScore });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get Freelancer Rankings
router.get('/ai/freelancer-rankings', authenticateToken, async (req, res) => {
  try {
    const { skill, limit = 20 } = req.query;
    
    let query = {};
    if (skill) {
      query['skills.name'] = new RegExp(skill, 'i');
    }
    
    const rankings = await FreelancerScore.find(query)
      .populate('userId', 'username fullName profilePicture')
      .sort({ 'scores.totalScore': -1 })
      .limit(parseInt(limit));
    
    res.json({ success: true, rankings });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== AI SMART RECOMMENDATION ====================

// Update User Preferences
router.post('/ai/update-preferences', authenticateToken, async (req, res) => {
  try {
    const { interests, preferredEventTypes, preferredContentTypes, preferredStreamCategories } = req.body;
    
    const preferences = await UserPreference.findOneAndUpdate(
      { userId: req.user.id },
      {
        interests: interests || [],
        preferredEventTypes: preferredEventTypes || [],
        preferredContentTypes: preferredContentTypes || [],
        preferredStreamCategories: preferredStreamCategories || [],
        lastUpdated: new Date()
      },
      { upsert: true, new: true }
    );
    
    res.json({ success: true, preferences });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Smart Recommendation - Events
router.get('/ai/recommend/events', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const limit = parseInt(req.query.limit) || 10;
    
    // Get user preferences
    let preferences = await UserPreference.findOne({ userId });
    if (!preferences) {
      preferences = { interests: [], interactionHistory: { joinedEvents: [] } };
    }
    
    // Get user progress for skill matching
    const userProgress = await UserProgress.findOne({ userId });
    
    // Get all active events
    const events = await Event.find({ 
      date: { $gte: new Date() },
      status: { $ne: 'cancelled' }
    }).populate('createdBy', 'username');
    
    // Calculate scores for each event
    const scoredEvents = await Promise.all(events.map(async (event) => {
      let score = 0;
      const factors = {
        skillMatch: 0,
        interestMatch: 0,
        historyMatch: 0,
        popularityScore: 0,
        recencyScore: 0,
        socialScore: 0
      };
      
      // Skill match (25 points)
      if (userProgress && preferences.interests) {
        const matchingInterests = preferences.interests.filter(interest => 
          event.title.toLowerCase().includes(interest.toLowerCase()) ||
          event.description.toLowerCase().includes(interest.toLowerCase())
        );
        factors.skillMatch = Math.min(matchingInterests.length * 10, 25);
      }
      
      // Interest match (20 points)
      if (preferences.preferredEventTypes && preferences.preferredEventTypes.includes(event.category)) {
        factors.interestMatch = 20;
      }
      
      // History match (15 points)
      const joinedSimilarEvents = preferences.interactionHistory?.joinedEvents?.filter(je => 
        events.find(e => e._id.equals(je.eventId))?.category === event.category
      ).length || 0;
      factors.historyMatch = Math.min(joinedSimilarEvents * 5, 15);
      
      // Popularity score (20 points)
      factors.popularityScore = Math.min((event.participants?.length || 0) * 2, 20);
      
      // Recency score (10 points) - prefer events happening soon
      const daysUntilEvent = (event.date - new Date()) / (1000 * 60 * 60 * 24);
      factors.recencyScore = daysUntilEvent < 7 ? 10 : daysUntilEvent < 30 ? 5 : 0;
      
      // Social score (10 points) - if creator is followed
      factors.socialScore = 0; // Placeholder for follower check
      
      score = Object.values(factors).reduce((a, b) => a + b, 0);
      
      return {
        event,
        score,
        factors
      };
    }));
    
    // Sort by score and get top recommendations
    const recommendations = scoredEvents
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
    
    // Save recommendations
    for (const rec of recommendations) {
      await RecommendationScore.findOneAndUpdate(
        { userId, itemId: rec.event._id, itemType: 'event' },
        {
          score: rec.score,
          factors: rec.factors,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
        },
        { upsert: true }
      );
    }
    
    res.json({ 
      success: true, 
      recommendations: recommendations.map(r => ({
        event: r.event,
        score: r.score,
        factors: r.factors
      }))
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Smart Recommendation - Content
router.get('/ai/recommend/content', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const limit = parseInt(req.query.limit) || 10;
    
    const preferences = await UserPreference.findOne({ userId }) || {};
    const userProgress = await UserProgress.findOne({ userId });
    
    const contents = await Content.find({})
      .populate('userId', 'username profilePicture')
      .sort({ createdAt: -1 })
      .limit(100);
    
    const scoredContents = contents.map(content => {
      let score = 0;
      const factors = {
        skillMatch: 0,
        interestMatch: 0,
        historyMatch: 0,
        popularityScore: 0,
        recencyScore: 0,
        socialScore: 0
      };
      
      // Interest match
      if (preferences.interests) {
        const matchingInterests = preferences.interests.filter(interest => 
          content.caption?.toLowerCase().includes(interest.toLowerCase())
        );
        factors.interestMatch = Math.min(matchingInterests.length * 15, 30);
      }
      
      // Popularity (likes)
      factors.popularityScore = Math.min((content.likes?.length || 0), 30);
      
      // Recency
      const daysOld = (new Date() - content.createdAt) / (1000 * 60 * 60 * 24);
      factors.recencyScore = daysOld < 1 ? 20 : daysOld < 7 ? 10 : 5;
      
      score = Object.values(factors).reduce((a, b) => a + b, 0);
      
      return { content, score, factors };
    });
    
    const recommendations = scoredContents
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
    
    res.json({ 
      success: true, 
      recommendations: recommendations.map(r => ({
        content: r.content,
        score: r.score
      }))
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Smart Recommendation - Live Streams
router.get('/ai/recommend/streams', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const limit = parseInt(req.query.limit) || 10;
    
    const preferences = await UserPreference.findOne({ userId }) || {};
    
    const streams = await LiveStream.find({ status: 'live' })
      .populate('userId', 'username profilePicture')
      .sort({ viewerCount: -1 });
    
    const scoredStreams = streams.map(stream => {
      let score = 0;
      const factors = {
        skillMatch: 0,
        interestMatch: 0,
        historyMatch: 0,
        popularityScore: 0,
        recencyScore: 0,
        socialScore: 0
      };
      
      // Category match
      if (preferences.preferredStreamCategories?.includes(stream.category)) {
        factors.interestMatch = 30;
      }
      
      // Popularity
      factors.popularityScore = Math.min(stream.viewerCount * 2, 30);
      
      // Boosted streams get bonus
      if (stream.isBoosted) {
        factors.recencyScore = 20;
      }
      
      // History match - watched similar categories
      const watchedSimilar = preferences.interactionHistory?.watchedStreams?.filter(ws => {
        // Would need to lookup stream category - simplified here
        return true;
      }).length || 0;
      factors.historyMatch = Math.min(watchedSimilar * 5, 20);
      
      score = Object.values(factors).reduce((a, b) => a + b, 0);
      
      return { stream, score, factors };
    });
    
    const recommendations = scoredStreams
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
    
    res.json({ 
      success: true, 
      recommendations: recommendations.map(r => ({
        stream: r.stream,
        score: r.score
      }))
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Smart Recommendation - Users to Follow
router.get('/ai/recommend/users', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const limit = parseInt(req.query.limit) || 10;
    
    const currentUser = await User.findById(userId);
    const preferences = await UserPreference.findOne({ userId }) || {};
    const userProgress = await UserProgress.findOne({ userId });
    
    // Get potential users (exclude self and already following)
    const users = await User.find({
      _id: { $ne: userId, $nin: currentUser.following || [] }
    }).limit(100);
    
    const scoredUsers = await Promise.all(users.map(async (user) => {
      let score = 0;
      const factors = {
        skillMatch: 0,
        interestMatch: 0,
        historyMatch: 0,
        popularityScore: 0,
        recencyScore: 0,
        socialScore: 0
      };
      
      const targetProgress = await UserProgress.findOne({ userId: user._id });
      
      // Skill match - similar badges
      if (userProgress && targetProgress) {
        const myBadges = userProgress.badges.map(b => b.name);
        const theirBadges = targetProgress.badges.map(b => b.name);
        const commonBadges = myBadges.filter(b => theirBadges.includes(b));
        factors.skillMatch = Math.min(commonBadges.length * 10, 30);
      }
      
      // Activity level
      factors.popularityScore = Math.min((user.followers?.length || 0), 25);
      
      // Recent activity
      if (user.isOnline) {
        factors.recencyScore = 20;
      } else if (user.lastActive) {
        const hoursInactive = (new Date() - user.lastActive) / (1000 * 60 * 60);
        factors.recencyScore = hoursInactive < 24 ? 15 : hoursInactive < 168 ? 10 : 5;
      }
      
      // Level similarity
      if (userProgress && targetProgress) {
        const levelDiff = Math.abs(userProgress.level - targetProgress.level);
        factors.interestMatch = levelDiff <= 2 ? 25 : levelDiff <= 5 ? 15 : 5;
      }
      
      score = Object.values(factors).reduce((a, b) => a + b, 0);
      
      return { user, score, factors };
    }));
    
    const recommendations = scoredUsers
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
    
    res.json({ 
      success: true, 
      recommendations: recommendations.map(r => ({
        user: {
          _id: r.user._id,
          username: r.user.username,
          fullName: r.user.fullName,
          profilePicture: r.user.profilePicture,
          isOnline: r.user.isOnline
        },
        score: r.score
      }))
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Track Interaction (for improving recommendations)
router.post('/ai/track-interaction', authenticateToken, async (req, res) => {
  try {
    const { itemId, itemType, action } = req.body; // action: 'view', 'join', 'like', 'follow'
    
    const preferences = await UserPreference.findOne({ userId: req.user.id });
    if (!preferences) {
      return res.json({ success: true, message: 'Preferences not initialized' });
    }
    
    // Update interaction history based on action and itemType
    switch(itemType) {
      case 'event':
        if (action === 'view') {
          preferences.interactionHistory.viewedEvents.push({ eventId: itemId, viewedAt: new Date() });
        } else if (action === 'join') {
          preferences.interactionHistory.joinedEvents.push({ eventId: itemId, joinedAt: new Date() });
        }
        break;
      case 'content':
        if (action === 'like') {
          preferences.interactionHistory.likedContent.push({ contentId: itemId, likedAt: new Date() });
        }
        break;
      case 'livestream':
        if (action === 'watch') {
          preferences.interactionHistory.watchedStreams.push({ 
            streamId: itemId, 
            watchedAt: new Date(),
            duration: 0 // Would be updated on leave
          });
        }
        break;
      case 'user':
        if (action === 'follow') {
          preferences.interactionHistory.followedUsers.push({ userId: itemId, followedAt: new Date() });
        }
        break;
    }
    
    await preferences.save();
    
    // Mark recommendation as interacted
    await RecommendationScore.updateOne(
      { userId: req.user.id, itemId, itemType },
      { isInteracted: true }
    );
    
    res.json({ success: true, message: 'Interaction tracked' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// AI Content Analysis
router.post('/ai/analyze-content', authenticateToken, async (req, res) => {
  try {
    const { contentId, contentText, contentType } = req.body;
    
    // Placeholder for AI analysis
    // Future: Sentiment analysis, topic extraction, quality scoring
    res.json({ 
      success: true, 
      message: 'AI Content Analysis endpoint ready for Phase 3',
      placeholder: true,
      analysis: {
        sentiment: null,
        topics: [],
        qualityScore: null,
        suggestions: []
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// AI Skill Matching - Phase 3 Preparation
router.post('/ai/skill-match', authenticateToken, async (req, res) => {
  try {
    const { skillQuery, userSkills } = req.body;
    
    // Placeholder for AI skill matching
    // Future: Match users based on complementary skills for collaboration
    res.json({ 
      success: true, 
      message: 'AI Skill Matching endpoint ready for Phase 3',
      placeholder: true,
      matches: []
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
