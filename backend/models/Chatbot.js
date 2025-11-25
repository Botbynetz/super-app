const mongoose = require('mongoose');

const chatbotFlowSchema = new mongoose.Schema({
  trigger: {
    type: String,
    required: true // keyword or pattern
  },
  triggerType: {
    type: String,
    enum: ['exact', 'contains', 'startsWith', 'regex'],
    default: 'contains'
  },
  response: {
    type: String,
    required: true
  },
  nextFlowId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ChatbotFlow'
  },
  options: [{
    text: String,
    nextFlowId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ChatbotFlow'
    }
  }]
});

const chatbotSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  name: {
    type: String,
    required: true
  },
  description: String,
  flows: [chatbotFlowSchema],
  defaultResponse: {
    type: String,
    default: 'Maaf, saya tidak mengerti. Coba ketik "help" untuk bantuan.'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  deploymentType: {
    type: String,
    enum: ['private', 'group', 'channel', 'public'],
    default: 'private'
  },
  stats: {
    totalInteractions: { type: Number, default: 0 },
    uniqueUsers: { type: Number, default: 0 },
    averageResponseTime: { type: Number, default: 0 }
  }
}, {
  timestamps: true
});

const chatbotInteractionSchema = new mongoose.Schema({
  chatbotId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Chatbot',
    required: true,
    index: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  userMessage: String,
  botResponse: String,
  matchedFlow: {
    type: mongoose.Schema.Types.ObjectId
  },
  responseTime: Number // milliseconds
}, {
  timestamps: true
});

const Chatbot = mongoose.model('Chatbot', chatbotSchema);
const ChatbotInteraction = mongoose.model('ChatbotInteraction', chatbotInteractionSchema);

module.exports = { Chatbot, ChatbotInteraction };
