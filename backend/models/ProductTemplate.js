const mongoose = require('mongoose');

const productTemplateSchema = new mongoose.Schema({
  category: {
    type: String,
    required: true,
    enum: ['electronics', 'fashion', 'food', 'services', 'digital', 'handmade', 'education', 'health', 'other']
  },
  template: {
    type: String,
    required: true
  },
  variables: [String], // e.g., ['productName', 'keyFeature1', 'keyFeature2']
  synonyms: {
    type: Map,
    of: [String] // e.g., 'great' -> ['excellent', 'amazing', 'outstanding']
  },
  usageCount: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

const productDescriptionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  productName: {
    type: String,
    required: true
  },
  category: {
    type: String,
    required: true
  },
  inputs: {
    type: Map,
    of: String
  },
  generatedDescription: {
    type: String,
    required: true
  },
  templateUsed: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ProductTemplate'
  },
  isPublished: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

const ProductTemplate = mongoose.model('ProductTemplate', productTemplateSchema);
const ProductDescription = mongoose.model('ProductDescription', productDescriptionSchema);

module.exports = { ProductTemplate, ProductDescription };
