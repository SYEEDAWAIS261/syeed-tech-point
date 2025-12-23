const mongoose = require('mongoose');
const crypto = require('crypto');

const subscriberSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
  },
  unsubscribeToken: {
    type: String,
    unique: true,       // keep unique
    default: null,      // allow it to be null initially
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Automatically generate an unsubscribe token before saving
subscriberSchema.pre('save', function (next) {
  if (!this.unsubscribeToken) {
    this.unsubscribeToken = crypto.randomBytes(32).toString('hex');
  }
  next();
});

module.exports = mongoose.model('Subscriber', subscriberSchema);
