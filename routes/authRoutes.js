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
} = require('../controllers/authController');
const { loginLimiter } = require('../middleware/rateLimiter');


const authMiddleware = require('../middleware/authMiddleware');
const admin = require('../middleware/adminMiddleware')
const upload = require('../middleware/upload');
const User = require('../models/User');

// 🔐 Manual Auth Routes
router.post('/signup', signup);
router.post('/verify', verifyEmail);
router.post('/resend', resendVerificationCode);
router.post('/login', loginLimiter, login);

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
router.get('/all-users', admin, authMiddleware, getAllUsers);
router.put('/block/:id', admin, authMiddleware, toggleBlockUser);

// 🌐 Google OAuth Routes
router.get(
  '/google/login',
  passport.authenticate('google', {
    scope: ['profile', 'email'],
    prompt: 'select_account',
    state: 'login',
  })
);

router.get(
  '/google/signup',
  passport.authenticate('google', {
    scope: ['profile', 'email'],
    prompt: 'consent',
    state: 'signup',
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
          'https://ai-ecommerce-4a2c6.web.app/login?error=blocked_account'
        );
      }

      // ✅ Generate JWT token
      const token = jwt.sign(
        { id: user._id, isAdmin: user.isAdmin },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );

      res.redirect(`https://ai-ecommerce-4a2c6.web.app/login?token=${token}`);
    } catch (err) {
      console.error('Google callback error:', err);
      res.redirect('https://ai-ecommerce-4a2c6.web.app/login?error=server_error');
    }
  }
);

// ❌ Google failure
router.get('/google/failure', (req, res) => {
  res.redirect('https://ai-ecommerce-4a2c6.web.app/login?error=account_not_found');
});

module.exports = router;
