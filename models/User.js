const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: { type: String, required: true },
  email: {
    type: String,
    required: function () {
      return !this.googleId;
    },
    unique: true,
  },
  password: {
    type: String,
    required: function () {
      return !this.googleId;
    },
  },
  googleId: { type: String, unique: true, sparse: true },
  isAdmin: { type: Boolean, default: false },
  isVerified: { type: Boolean, default: false },
  // isOnline: { type: Boolean, default: false },
  // lastSeen: { type: Date, default: null },

  isBlocked: { type: Boolean, default: false },
  profileImage: {
    type: String,
    default: '',
  },

  // ✅ Add this line
  isLoggedIn: { type: Boolean, default: false },

  // ✅ Email verification fields
  verificationCode: String,
  verificationCodeExpires: Date,
  
  // userSchema addition
unsubscribeStatus: {
  type: Boolean,
  default: false, // false = subscribed, true = unsubscribed
},
unsubscribeToken: {
  type: String,
  default: null,
},


});

module.exports = mongoose.model('User', userSchema);
