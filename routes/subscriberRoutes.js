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

    // Professional Email Design
    const emailHTML = `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; background:#f4f4f7; padding:30px;">
        <div style="max-width:650px; margin:0 auto; background:#ffffff; padding:30px; border-radius:10px; box-shadow:0 4px 15px rgba(0,0,0,0.08);">
          
          <div style="text-align:center; margin-bottom:25px;">
            <h1 style="color:#2b6cb0; margin:0;">🎉 Welcome to the Family!</h1>
            <p style="color:#718096; font-size:14px; margin-top:8px;">
              You've successfully subscribed to our newsletter.
            </p>
          </div>

          <div style="color:#2d3748; line-height:1.6; font-size:15px;">
            <p>Hi there,</p>
            <p>Thank you for subscribing to <strong>Syeed E-commerce</strong>! We're thrilled to have you with us.</p>
            <p>From now on, you'll be the first to know about:</p>
            <ul style="color:#4a5568;">
              <li>🔥 Exclusive discounts and flash sales</li>
              <li>🆕 New product arrivals</li>
              <li>🎁 Special rewards for our community</li>
            </ul>
            
            <div style="text-align:center; margin-top:30px;">
              <a href="https://ai-ecommerce-4a2c6.web.app" 
                 style="display:inline-block; padding:12px 25px; background:#2b6cb0; color:white; text-decoration:none; border-radius:6px; font-weight:bold;">
                 Visit Our Store
              </a>
            </div>
          </div>

          <p style="font-size:15px; color:#2d3748; margin-top:30px; border-top:1px solid #edf2f7; padding-top:20px;">
            Best Regards,<br/>
            <strong>Syeed E-commerce Team</strong>
          </p>
        </div>

        <div style="text-align:center; font-size:12px; color:#a0aec0; margin-top:15px;">
          <p>© ${new Date().getFullYear()} Syeed E-commerce. All rights reserved.</p>
          <p>You are receiving this email because you subscribed on our website.<br/>
          <a href="#" style="color:#a0aec0; text-decoration:underline;">Unsubscribe</a></p>
        </div>
      </div>
    `;

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.SMTP_EMAIL,
        pass: process.env.SMTP_PASS,
      },
    });

    await transporter.sendMail({
      from: `"Syeed E-commerce" <${process.env.SMTP_EMAIL}>`,
      to: email,
      subject: '🎉 Welcome to Our Newsletter!',
      html: emailHTML
    });

    res.json({ message: 'Subscribed successfully!' });
  } catch (err) {
    console.error('Error subscribing:', err);
    res.status(500).json({ message: 'Failed to subscribe', error: err.message });
  }
});

module.exports = router;