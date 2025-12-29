const express = require('express');
const router = express.Router();
const Cms = require('../models/Cms');
const auth = require('../middleware/authMiddleware');  // your auth middleware
const admin = require('../middleware/adminMiddleware'); // your admin middleware

// 1️⃣ Public GET route (anyone can fetch)
router.get('/home-content', async (req, res) => {
  try {
    let content = await Cms.findOne({ pageName: 'home' });
    if (!content) {
      // If not exists, return defaults
      content = {
        heroTitle: '',
        heroDescription: '',
        seoFooterTitle: '',
        seoFooterDescription: '',
      };
    }
    res.json(content);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 2️⃣ Admin-only PUT route (update content via admin panel)
router.put('/home-content', auth, admin, async (req, res) => {
  try {
    const updatedContent = await Cms.findOneAndUpdate(
      { pageName: 'home' },
      req.body,
      { new: true, upsert: true } // creates if not exists
    );
    res.json(updatedContent);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

module.exports = router;
