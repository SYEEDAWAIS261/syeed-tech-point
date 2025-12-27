const mongoose = require('mongoose');

const cmsSchema = new mongoose.Schema({
    pageName: { type: String, default: 'home' }, // Future mein baqi pages ke liye bhi kaam ayega
    heroTitle: { type: String, required: true },
    heroDescription: { type: String, required: true },
    seoFooterTitle: { type: String, required: true },
    seoFooterDescription: { type: String, required: true }
}, { timestamps: true });

module.exports = mongoose.model('Cms', cmsSchema);