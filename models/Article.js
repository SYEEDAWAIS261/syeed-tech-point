const mongoose = require('mongoose');

const articleSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  slug: { type: String, required: true, unique: true }, // SEO friendly URL
  content: { type: String, required: true },
  category: { 
    type: String, 
    required: true, 
    enum: ['Laptops', 'Tech News', 'Buying Guide', 'Reviews'] 
  },
  image: { type: String, required: true },
  author: { type: String, default: 'Admin' },
  views: { type: Number, default: 0 }, // Popularity track karne ke liye
  status: { type: String, enum: ['draft', 'published'], default: 'published' }
}, { timestamps: true });

// Title se pehle slug banane ke liye index optimize karein
articleSchema.index({ title: 'text', content: 'text' });

module.exports = mongoose.model('Article', articleSchema);