const nodemailer = require('nodemailer');

const sendEmail = async (to, subject, html) => {
  console.log("📩 sendEmail() called with:", { to, subject });

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  try {
    console.log("🔍 Verifying transporter...");
    await transporter.verify();
    console.log("✅ Transporter verified successfully");

    const info = await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to,
      subject,
      html,
    });

    console.log("✅ Email sent successfully!");
    console.log("📨 Response:", info.response);
  } catch (err) {
    console.error("❌ Email error:", err);
  }
};

module.exports = sendEmail;
