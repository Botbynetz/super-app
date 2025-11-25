const mongoose = require('mongoose');

const cvTemplateSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  category: {
    type: String,
    enum: ['modern', 'professional', 'creative', 'minimal'],
    default: 'professional'
  },
  htmlTemplate: {
    type: String,
    required: true
  },
  cssStyles: String,
  variables: [String], // e.g., ['fullName', 'email', 'phone', 'skills', 'experience']
  thumbnail: String,
  usageCount: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

const cvSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  templateId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CVTemplate'
  },
  data: {
    fullName: String,
    email: String,
    phone: String,
    location: String,
    summary: String,
    skills: [String],
    experience: [{
      title: String,
      company: String,
      duration: String,
      description: String
    }],
    education: [{
      degree: String,
      institution: String,
      year: String
    }],
    achievements: [String],
    badges: [{
      name: String,
      earnedAt: Date,
      iconUrl: String
    }],
    events: [{
      name: String,
      role: String,
      date: Date
    }],
    portfolio: [String] // URLs
  },
  generatedHtml: String,
  pdfUrl: String,
  isPublic: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

const freelancerScoreSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
    index: true
  },
  skills: [{
    name: String,
    level: { type: Number, min: 0, max: 5 }, // 0-5 stars
    verifiedBy: [String] // event names, badge names
  }],
  scores: {
    skillMatch: { type: Number, default: 0, min: 0, max: 100 },
    eventParticipation: { type: Number, default: 0, min: 0, max: 100 },
    badgeQuality: { type: Number, default: 0, min: 0, max: 100 },
    userRating: { type: Number, default: 0, min: 0, max: 5 },
    completionRate: { type: Number, default: 0, min: 0, max: 100 },
    responseTime: { type: Number, default: 0 }, // average hours
    totalScore: { type: Number, default: 0, min: 0, max: 100 }
  },
  portfolio: [{
    title: String,
    description: String,
    url: String,
    category: String
  }],
  availability: {
    type: String,
    enum: ['available', 'busy', 'unavailable'],
    default: 'available'
  },
  hourlyRate: Number,
  lastUpdated: Date
}, {
  timestamps: true
});

const CVTemplate = mongoose.model('CVTemplate', cvTemplateSchema);
const CV = mongoose.model('CV', cvSchema);
const FreelancerScore = mongoose.model('FreelancerScore', freelancerScoreSchema);

module.exports = { CVTemplate, CV, FreelancerScore };
