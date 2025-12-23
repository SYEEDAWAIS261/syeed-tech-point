// controllers/marketingController.js
const crypto = require("crypto");
const sendEmail = require("../utils/sendEmail");
const User = require("../models/User");

async function sendMarketingEmail(user, subject, message) {
  // If user already unsubscribed — don’t send
  if (user.unsubscribeStatus) {
    console.log(`🚫 ${user.email} has unsubscribed, skipping email.`);
    return;
  }

  // Generate or reuse unsubscribe token
  if (!user.unsubscribeToken) {
    user.unsubscribeToken = crypto.randomBytes(24).toString("hex");
    await user.save();
  }

  // ✅ Frontend unsubscribe link
  const unsubscribeLink = `${process.env.FRONTEND_URL}/api/unsubscribe/${user.unsubscribeToken}`;

  // ✅ Email body with unsubscribe footer
  const html = `
    <div style="font-family:Arial, sans-serif; max-width:600px; margin:auto;">
      <h2 style="color:#0d6efd;">${subject}</h2>
      <p>${message}</p>

      <hr style="margin:20px 0;"/>

      <p style="font-size:12px; color:#777;">
        You’re receiving this email because you subscribed to our product updates.<br/>
        If you no longer wish to receive these emails, you can 
        <a href="${unsubscribeLink}" style="color:#0d6efd; text-decoration:underline;">
          unsubscribe here
        </a>.
      </p>
    </div>
  `;

  await sendEmail(user.email, subject, html);
  console.log(`✅ Marketing email sent to ${user.email}`);
}

module.exports = { sendMarketingEmail };
