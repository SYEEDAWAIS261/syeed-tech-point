const express = require('express');
const router = express.Router();
const Subscriber = require('../models/Subscriber');
const nodemailer = require('nodemailer');

// ✅ Subscribe endpoint
router.post('/subscribe', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) return res.status(400).json({ message: 'Email is required' });

    const existing = await Subscriber.findOne({ email });
    if (existing) {
      return res.status(400).json({ message: 'You are already subscribed!' });
    }

    const subscriber = new Subscriber({ email });
    await subscriber.save();

    // Send welcome email
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.SMTP_EMAIL, // your Gmail
        pass: process.env.SMTP_PASS,  // your App password
      },
    });

    await transporter.sendMail({
      from: process.env.SMTP_EMAIL,
      to: email,
      subject: '🎉 Welcome to Our Newsletter!',
      html: `<h3>Thanks for subscribing!</h3>
             <p>You’ll now receive updates when we add new products or offers.</p>`,
    });

    res.json({ message: 'Subscribed successfully!' });
  } catch (err) {
    console.error('Error subscribing:', err);
    res.status(500).json({ message: 'Failed to subscribe', error: err.message });
  }
});

module.exports = router;
