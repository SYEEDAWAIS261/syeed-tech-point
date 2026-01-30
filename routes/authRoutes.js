const express = require('express');
const router = express.Router();
const passport = require('passport');
const jwt = require('jsonwebtoken');
const {
  signup,
  login,
  logout,
  getProfile,
  updateProfile,
  verifyEmail,
  resendVerificationCode,
  getAllUsers,
  toggleBlockUser,
  forgotPassword,
  resetPassword,
  getUserStats,
} = require('../controllers/authController');

const authMiddleware = require('../middleware/authMiddleware');
const admin = require('../middleware/adminMiddleware')
const upload = require('../middleware/upload');
const User = require('../models/User');

// 🔐 Manual Auth Routes
router.post('/signup', signup);
router.post('/verify', verifyEmail);
router.post('/resend', resendVerificationCode);
router.post('/login', login);

router.post("/forgot-password", forgotPassword);
router.post("/reset-password/:token", resetPassword);

// 🔒 Protected Profile Routes
router.get('/profile', authMiddleware, getProfile);
router.put('/profile', authMiddleware, updateProfile);
router.post('/logout', authMiddleware, logout);

// 🔒 Upload Profile Image
router.put(
  '/upload-profile',
  authMiddleware,
  upload.single('profileImage'),
  async (req, res) => {
    try {
      const user = await User.findById(req.user._id);
      if (!user) return res.status(404).json({ message: 'User not found' });

      user.profileImage = req.file.filename;
      await user.save();

      res.json({
        message: 'Profile image uploaded successfully',
        imageUrl: `/uploads/profile/${user.profileImage}`,
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'Upload failed' });
    }
  }
);

// ✅ Admin-only Routes for User Management
router.get('/all-users', admin, getAllUsers);
router.put('/block/:id', admin, toggleBlockUser);
// Example:
router.get('/stats', authMiddleware, getUserStats);

// 🌐 Google OAuth Routes
router.get(
  '/google/login',
  passport.authenticate('google', {
    scope: ['profile', 'email'],
    prompt: 'select_account',
    state: 'login',
    // Forcefully redirect_uri yahan specify karein
    callbackURL: process.env.GOOGLE_CALLBACK_URL 
  })
);

router.get(
  '/google/signup',
  passport.authenticate('google', {
    scope: ['profile', 'email'],
    prompt: 'consent',
    state: 'signup',
    // Forcefully redirect_uri yahan specify karein
    callbackURL: process.env.GOOGLE_CALLBACK_URL 
  })
);

router.get(
  '/google/signup',
  passport.authenticate('google', {
    scope: ['profile', 'email'],
    prompt: 'consent',
    state: 'signup',
    // Forcefully redirect_uri yahan specify karein
    callbackURL: process.env.GOOGLE_CALLBACK_URL 
  })
);

// ✅ Updated Google Callback — Blocked users cannot log in
router.get(
  '/google/callback',
  passport.authenticate('google', {
    session: false,
    failureRedirect: '/api/auth/google/failure',
  }),
  async (req, res) => {
    try {
      const user = req.user;

      // 🚫 Check if blocked
      if (user.isBlocked) {
        return res.redirect(
          'http://localhost:5173/login?error=blocked_account'
        );
      }

      // ✅ Generate JWT token
      const token = jwt.sign(
        { id: user._id, isAdmin: user.isAdmin },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );

      res.redirect(`http://localhost:5173/login?token=${token}`);
    } catch (err) {
      console.error('Google callback error:', err);
      res.redirect('http://localhost:5173/login?error=server_error');
    }
  }
);

// ❌ Google failure
router.get('/google/failure', (req, res) => {
  res.redirect('http://localhost:5173/login?error=account_not_found');
});

module.exports = router;
