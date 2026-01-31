const express = require('express');
const router = express.Router();
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

// Models aur Middleware lazmi import karein
const Cms = require('../models/Cms');
const auth = require('../middleware/authMiddleware'); // <--- Ensure these paths are correct
const admin = require('../middleware/adminMiddleware');

// 1. Cloudinary Configuration
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// 2. Professional Storage Setup (No more fs.mkdirSync!)
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'cms_uploads',
    allowed_formats: ['jpg', 'png', 'jpeg'],
  },
});

const upload = multer({ storage });

/* =========================
   ROUTES
========================= */

// 1️⃣ PUBLIC GET
router.get('/home-content', async (req, res) => {
  try {
    const content = await Cms.findOne({ pageName: 'home' });
    res.json(content || {});
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 2️⃣ ADMIN PUT (Professional Cloud Upload)
router.put('/home-content', auth, admin, upload.single('heroImage'), async (req, res) => {
  try {
    const updateData = { ...req.body };

    // Agar image upload hui hai, to Cloudinary ka URL milega
    if (req.file) {
      updateData.heroImage = req.file.path; // Ye Cloudinary ka secure URL hoga
    }

    const updatedContent = await Cms.findOneAndUpdate(
      { pageName: 'home' },
      updateData,
      { new: true, upsert: true }
    );

    res.json(updatedContent);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

module.exports = router;