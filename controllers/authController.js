const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const sendEmail = require('../utils/sendEmail');

// POST /signup
exports.signup = async (req, res) => {
  try {
    let { username, email, password, isAdmin } = req.body;

    email = email.toLowerCase().trim();

    if (!username || !email || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(400).json({ message: "User already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const hashedCode = hashCode(code);

    const user = new User({
      username,
      email,
      password: hashedPassword,
      isAdmin: isAdmin || false,
      verificationCode: hashedCode,
      verificationCodeExpires: Date.now() + 15 * 60 * 1000,
      isVerified: false,
    });

    await user.save();

    await sendEmail(
      email,
      "Verify your Email - Awais E-Commerce",
      `<h3>Hello ${username},</h3>
       <p>Your verification code is:</p>
       <h2>${code}</h2>
       <p>This code will expire in 15 minutes.</p>`
    );

    res.status(201).json({
      message: "Signup successful. Verification code sent to email.",
    });
  } catch (err) {
    console.error("Signup error:", err);
    res.status(500).json({ message: "Server error during signup" });
  }
};


// POST /verify
exports.verifyEmail = async (req, res) => {
  let { email, code } = req.body;

  email = email.toLowerCase().trim();
  const hashedCode = hashCode(code);

  try {
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.isVerified) {
      return res.status(400).json({ message: "Email already verified" });
    }

    if (
      user.verificationCode !== hashedCode ||
      user.verificationCodeExpires < Date.now()
    ) {
      return res.status(400).json({ message: "Invalid or expired code" });
    }

    user.isVerified = true;
    user.verificationCode = undefined;
    user.verificationCodeExpires = undefined;

    await user.save();

    res.json({ message: "Email verified successfully" });
  } catch (err) {
    console.error("Verify error:", err);
    res.status(500).json({ message: "Server error during verification" });
  }
};

// POST /resend
exports.resendVerificationCode = async (req, res) => {
  let { email } = req.body;
  email = email.toLowerCase().trim();

  try {
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.isVerified) {
      return res.status(400).json({ message: "Email already verified" });
    }

    // ⛔ Prevent spamming (2 min cooldown)
    if (
      user.verificationCodeExpires &&
      user.verificationCodeExpires - Date.now() > 13 * 60 * 1000
    ) {
      return res
        .status(429)
        .json({ message: "Please wait before requesting a new code" });
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    user.verificationCode = hashCode(code);
    user.verificationCodeExpires = Date.now() + 15 * 60 * 1000;

    await user.save();

    await sendEmail(
      email,
      "New Verification Code - Awais E-Commerce",
      `<h3>Hello ${user.username},</h3>
       <h2>${code}</h2>
       <p>This code will expire in 15 minutes.</p>`
    );

    res.json({ message: "New verification code sent" });
  } catch (err) {
    console.error("Resend error:", err);
    res.status(500).json({ message: "Server error while resending code" });
  }
};


/// POST /login
exports.login = async (req, res) => {
  let { email, password } = req.body;
  email = email?.toLowerCase().trim();

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    // 🚫 Blocked account (generic message for security)
    if (user.isBlocked) {
      return res.status(403).json({ message: "Access denied" });
    }

    // 🔐 Password validation
    if (user.password) {
      if (!password) {
        return res.status(400).json({ message: "Invalid credentials" });
      }

      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(400).json({ message: "Invalid credentials" });
      }
    }

    // 📧 Email verification
    if (!user.isVerified) {
      return res.status(401).json({ message: "Please verify your email" });
    }

    // 🟢 Update activity
    user.isLoggedIn = true;
    user.isOnline = true;
    user.lastSeen = new Date();
    await user.save();

    // 🎟 JWT
    const token = jwt.sign(
      { id: user._id },
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
        isAdmin: user.isAdmin, // frontend convenience only
      },
    });
  } catch (err) {
    console.error("Login error:", err);
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
