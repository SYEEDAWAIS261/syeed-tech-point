const express = require('express');
const router = express.Router();
const Cms = require('../models/Cms');

// 1. Get Home Content
router.get('/home-content', async (req, res) => {
    try {
        const content = await Cms.findOne({ pageName: 'home' });
        res.json(content);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// 2. Update Home Content (Admin Only - Add your auth middleware here)
router.put('/home-content', async (req, res) => {
    try {
        const updatedContent = await Cms.findOneAndUpdate(
            { pageName: 'home' },
            req.body,
            { new: true, upsert: true } // Upsert matlab agar nahi hai to bana do
        );
        res.json(updatedContent);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

module.exports = router;