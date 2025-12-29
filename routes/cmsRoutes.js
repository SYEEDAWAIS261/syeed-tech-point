const express = require('express');
const router = express.Router();
const Cms = require('../models/Cms');
const auth = require('../middleware/authMiddleware');
const admin = require('../middleware/adminMiddleware');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

/* =========================
   MULTER SETUP
========================= */

const uploadDir = 'uploads/cms';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, `hero-${Date.now()}${path.extname(file.originalname)}`);
  },
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed'), false);
  }
};

const upload = multer({ storage, fileFilter });

/* =========================
   ROUTES
========================= */

// 1️⃣ PUBLIC GET (Website + Admin both use this)
router.get('/home-content', async (req, res) => {
  try {
    const content = await Cms.findOne({ pageName: 'home' });
    res.json(content || {});
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 2️⃣ ADMIN PUT (Text + Image)
router.put(
  '/home-content',
  auth,
  admin,
  upload.single('heroImage'),
  async (req, res) => {
    try {
      const updateData = { ...req.body };

      // ✅ If image uploaded
      if (req.file) {
        updateData.heroImage = `/uploads/cms/${req.file.filename}`;
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
  }
);

module.exports = router;
