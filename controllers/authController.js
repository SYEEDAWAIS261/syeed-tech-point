const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const sendEmail = require('../utils/sendEmail');

// POST /signup
exports.signup = async (req, res) => {
  try {
    const { username, email, password, isAdmin } = req.body;

    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ message: 'User already exists' });

    const hashed = await bcrypt.hash(password, 10);

    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiry = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

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

    await sendEmail(
      email,
      'Verify your Email - Awais E-Commerce',
      `<h3>Hello ${username},</h3>
      <p>Your verification code is: <strong>${verificationCode}</strong></p>
      <p>This code will expire in 15 minutes.</p>`
    );

    res.status(201).json({ message: 'User registered. Verification code sent to email.' });
  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({ message: 'Server error during signup' });
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
      return res.status(403).json({ message: "Your account has been blocked." });
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
