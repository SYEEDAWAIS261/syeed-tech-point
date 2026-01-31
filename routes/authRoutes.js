const express = require('express');
const router = express.Router();
// Cloudinary Imports
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

const {
  signup, login, logout, getProfile, updateProfile, verifyEmail,
  resendVerificationCode, getAllUsers, toggleBlockUser,
  forgotPassword, resetPassword, getUserStats,
} = require('../controllers/authController');

const authMiddleware = require('../middleware/authMiddleware');
const admin = require('../middleware/adminMiddleware');
const User = require('../models/User');

// 1. Cloudinary Config
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// 2. Profile Image Storage Setup
const profileStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'profile_images',
    allowed_formats: ['jpg', 'png', 'jpeg'],
    transformation: [{ width: 500, height: 500, crop: 'limit' }] // Profile pic optimized ho jayegi
  },
});

const uploadProfile = multer({ storage: profileStorage });

/* =========================
   ROUTES
========================= */

// ... (signup, login, etc. routes same rahenge)

// 🔒 Updated Profile Image Upload
router.put(
  '/upload-profile',
  authMiddleware,
  uploadProfile.single('profileImage'), // Naya Cloudinary middleware
  async (req, res) => {
    try {
      const user = await User.findById(req.user._id);
      if (!user) return res.status(404).json({ message: 'User not found' });

      if (!req.file) return res.status(400).json({ message: 'No image uploaded' });

      // ✅ req.file.path ab Cloudinary ka URL hai
      user.profileImage = req.file.path; 
      await user.save();

      res.json({
        message: 'Profile image uploaded successfully',
        imageUrl: user.profileImage, // Direct URL bhej rahe hain
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'Upload failed' });
    }
  }
);
module.exports = router;
// ... (Admin aur Google routes same rahenge)