// utils/notifySubscribers.js
const nodemailer = require('nodemailer');
const Subscriber = require('../models/Subscriber');

const notifySubscribers = async (product) => {
  try {
    const subscribers = await Subscriber.find();
    if (!subscribers.length) return console.log('No subscribers to notify.');

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.SMTP_EMAIL,
        pass: process.env.SMTP_PASS,
      },
    });

    const emails = subscribers.map((sub) => sub.email);

    const productUrl = `${process.env.FRONTEND_URL}/product/${product._id}`;

    const mailOptions = {
      from: process.env.SMTP_EMAIL,
      to: emails,
      subject: `🆕 New Product Added: ${product.name}`,
      html: `
        <div style="font-family:Arial,sans-serif;line-height:1.6;">
          <h2 style="color:#333;">${product.name}</h2>
          <p>${product.description}</p>
          <p><strong>Price:</strong> $${product.price}</p>
          ${product.discountPercentage ? `<p><strong>Discount:</strong> ${product.discountPercentage}%</p>` : ''}
          <img src="${process.env.BASE_URL}${product.image}" alt="${product.name}" width="300" style="border-radius:8px;" />
          <br/><br/>
          <a href="${productUrl}"
            style="background:#007bff;color:white;padding:10px 15px;border-radius:5px;text-decoration:none;">
            View Product
          </a>
          <!-- Footer -->
    <p style="text-align:center; font-size:12px; color:#a0aec0; margin-top:15px;">
      © ${new Date().getFullYear()} Syeed E-commerce. All rights reserved.<br />
      You are receiving this email because you made a purchase at our store.
    </p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
    console.log(`✅ Notification emails sent to ${emails.length} subscribers`);
  } catch (error) {
    console.error('❌ Error sending notification emails:', error.message);
  }
};

module.exports = notifySubscribers;
