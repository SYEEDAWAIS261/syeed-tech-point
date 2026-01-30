const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const sendEmail = require('../utils/sendEmail');
const crypto = require("crypto");
const Order = require('../models/Order');
const Wishlist = require('../models/Wishlist');

// POST /signup
exports.signup = async (req, res) => {
  try {
    const { username, email, password, isAdmin } = req.body;

    // 1. Dono Email aur Username check karein (Duplicate prevention)
    const existing = await User.findOne({ $or: [{ email }, { username }] });
    if (existing) {
      const field = existing.email === email ? 'Email' : 'Username';
      return res.status(400).json({ message: `${field} already exists` });
    }

    const hashed = await bcrypt.hash(password, 10);
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiry = new Date(Date.now() + 15 * 60 * 1000);

    const user = new User({
      username,
      email,
      password: hashed,
      isAdmin: isAdmin || false,
      verificationCode,
      verificationCodeExpires: expiry,
      isVerified: false,
    });

    await user.save();

    // 2. Email ko Try-Catch mein rakhein taaki main process fail na ho
    try {
      await sendEmail(
        email,
        'Verify your Email - Awais E-Commerce',
        `<h3>Hello ${username},</h3>
         <p>Your verification code is: <strong>${verificationCode}</strong></p>`
      );
    } catch (emailErr) {
      console.error('Email sending failed:', emailErr);
      // User ko register hone dein, unhe batayein code resend karein agar nahi mila
      return res.status(201).json({ 
        message: 'Account created, but failed to send email. Please click resend code.',
        email: email 
      });
    }

    res.status(201).json({ message: 'User registered. Verification code sent to email.' });
  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({ message: 'Server error during signup. Please try again.' });
  }
};

// POST /verify
exports.verifyEmail = async (req, res) => {
  const { email, code } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (user.isVerified) return res.status(400).json({ message: 'Email already verified' });

    if (user.verificationCode !== code)
      return res.status(400).json({ message: 'Invalid verification code' });

    if (user.verificationCodeExpires < Date.now())
      return res.status(400).json({ message: 'Verification code expired' });

    user.isVerified = true;
    user.verificationCode = undefined;
    user.verificationCodeExpires = undefined;
    await user.save();

    res.json({ message: 'Email verified successfully!' });
  } catch (err) {
    console.error('Verification error:', err);
    res.status(500).json({ message: 'Server error during verification' });
  }
};

// POST /resend
exports.resendVerificationCode = async (req, res) => {
  const { email } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (user.isVerified) {
      return res.status(400).json({ message: 'Email is already verified' });
    }

    const newCode = Math.floor(100000 + Math.random() * 900000).toString();
    const newExpiry = new Date(Date.now() + 15 * 60 * 1000); // 15 mins

    user.verificationCode = newCode;
    user.verificationCodeExpires = newExpiry;
    await user.save();

    await sendEmail(
      email,
      'New Verification Code - Awais E-Commerce',
      `<h3>Hello ${user.username},</h3>
      <p>Your new verification code is: <strong>${newCode}</strong></p>
      <p>This code will expire in 15 minutes.</p>`
    );

    res.json({ message: 'New verification code sent to email.' });
  } catch (err) {
    console.error('Resend error:', err);
    res.status(500).json({ message: 'Server error while resending code' });
  }
};

// POST /login
exports.login = async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    // 🚫 Block check
    if (user.isBlocked) {
      return res.status(403).json({ message: "Your account has been blocked by Syeed Tech Point Team. Please contact support." });
    }

    // 🔍 Password check (skip if Google login user)
    if (user.password) {
      if (!password) {
        return res.status(400).json({ message: "Password is required" });
      }

      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        return res.status(400).json({ message: "Invalid credentials" });
      }
    } else {
      // For Google login users, password should not be checked
      console.log("Google user login — password check skipped.");
    }

    // ✅ Email verification check
    if (!user.isVerified) {
      return res.status(401).json({ message: "Please verify your email before logging in." });
    }

    // ✅ Update user status
    user.isLoggedIn = true;
    user.isOnline = true;
    user.lastSeen = new Date();
    await user.save();

    // 🔔 Emit socket event if needed
    // const io = req.app.get("io");
    // if (io) {
    //   io.emit("userStatusChange", { userId: user._id, isOnline: true });
    // }

    // 🎟 Generate JWT token
    const token = jwt.sign(
      { id: user._id, isAdmin: user.isAdmin },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      message: "Login successful",
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        isAdmin: user.isAdmin,
        isOnline: user.isOnline,
      },
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ message: "Server error during login" });
  }
};

// POST /forgot-password
exports.forgotPassword = async (req, res) => {
  const { email } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) {
      // 🔐 Security: same message even if user not found
      return res.json({
        message: "If an account exists, a reset link has been sent to your email."
      });
    }

    // 🔑 Generate reset token
    const resetToken = crypto.randomBytes(32).toString("hex");

    user.resetPasswordToken = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");

    user.resetPasswordExpires = Date.now() + 15 * 60 * 1000; // 15 minutes

    await user.save();

    const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;

    await sendEmail(
      user.email,
      "Reset Your Password - Syeed Tech Point",
      `
        <h3>Hello ${user.username},</h3>
        <p>You requested a password reset.</p>
        <p>Click the link below to reset your password:</p>
        <a href="${resetUrl}">${resetUrl}</a>
        <p>This link will expire in 15 minutes.</p>
      `
    );

    res.json({
      message: "If an account exists, a reset link has been sent to your email."
    });
  } catch (err) {
    console.error("Forgot password error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// POST /reset-password/:token
exports.resetPassword = async (req, res) => {
  const { password } = req.body;

  try {
    const hashedToken = crypto
      .createHash("sha256")
      .update(req.params.token)
      .digest("hex");

    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({
        message: "Invalid or expired reset token"
      });
    }

    // 🔐 Hash new password
    user.password = await bcrypt.hash(password, 10);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;

    await user.save();

    res.json({ message: "Password reset successful. You can now login." });
  } catch (err) {
    console.error("Reset password error:", err);
    res.status(500).json({ message: "Server error" });
  }
};



exports.logout = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: "User not found" });

    // user.isLoggedIn = false;
    // user.isOnline = false;
    // user.lastSeen = new Date();
    // await user.save();

    const io = req.app.get("io");
    io.emit("userStatusChange", { userId: user._id, isOnline: false });

    res.json({ message: "Logout successful" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error during logout" });
  }
};



// GET /profile
exports.getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });

    res.json({
      _id: user._id,
      username: user.username,
      email: user.email,
      isAdmin: user.isAdmin,
      isVerified: user.isVerified,
      profileImage: user.profileImage ? `/uploads/profile/${user.profileImage}` : '',
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch profile' });
  }
};

// PUT /profile
exports.updateProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    user.username = req.body.username || user.username;
    user.email = req.body.email || user.email;

    if (req.body.password) {
      user.password = await bcrypt.hash(req.body.password, 10);
    }

    const updatedUser = await user.save();

    res.json({
      _id: user._id,
      username: user.username,
      email: user.email,
      isAdmin: user.isAdmin,
      profileImage: user.profileImage ? `/uploads/profile/${user.profileImage}` : '',
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to update profile' });
  }
};

// ✅ GET /all-users
exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.find().select('-password');
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch users' });
  }
};

// ✅ PUT /block/:id
exports.toggleBlockUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    user.isBlocked = !user.isBlocked;

    // 🚫 If blocked, mark them as logged out
    if (user.isBlocked) {
      user.isLoggedIn = false;
    }

    await user.save();

    res.json({
      message: `User has been ${user.isBlocked ? 'blocked and logged out' : 'unblocked'}`,
      isBlocked: user.isBlocked,
    });
  } catch (err) {
    console.error('Error blocking/unblocking user:', err);
    res.status(500).json({ message: 'Failed to block/unblock user' });
  }
};

exports.getUserStats = async (req, res) => {
  try {
    const userId = req.user._id;

    // 1. Wishlist Fetching
    const wishlist = await Wishlist.findOne({ user: userId });
    const wishlistArray = wishlist ? wishlist.products : [];

    // 2. Orders Counting (Total and Active)
    // Hum Order database se counts nikalenge
    const totalOrders = await Order.countDocuments({ userId: userId });
    
    // Active orders wo hain jo abhi tak 'Delivered' ya 'Cancelled' nahi hue
    const activeOrders = await Order.countDocuments({ 
      userId: userId, 
      status: { $in: ['Placed', 'Pending', 'Processing', 'Shipped'] } 
    });

    res.json({
      wishlistCount: wishlistArray.length,
      wishlist: wishlistArray, 
      totalOrders: totalOrders, // Asli count database se
      activeOrders: activeOrders // Asli active count database se
    });

  } catch (error) {
    console.error("Stats Error:", error);
    res.status(500).json({ 
      message: "Error fetching stats", 
      error: error.message 
    }); 
  }
};