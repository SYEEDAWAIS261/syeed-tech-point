const express = require("express");
const router = express.Router();
const nodemailer = require("nodemailer");

// POST /api/contact
router.post("/", async (req, res) => {
  const { username, email, subject, textarea } = req.body;

  if (!username || !email || !subject || !textarea) {
    console.warn("⚠️ Missing required fields:", { username, email, subject, textarea });
    return res.status(400).json({ success: false, message: "All fields are required" });
  }

  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER, // ✅ Gmail from .env
        pass: process.env.EMAIL_PASS, // ✅ App password from .env
      },
    });

    const mailOptions = {
      from: `"Website Contact Form" <${process.env.EMAIL_USER}>`,
      to: process.env.EMAIL_USER,
      replyTo: email,
      subject: `New Contact Form Message - ${subject}`,
      text: `You have a new message from your website contact form:\n\nName: ${username}\nEmail: ${email}\n\nMessage:\n${textarea}`,
    };

    const info = await transporter.sendMail(mailOptions);

    // ✅ Success console log
    console.log("✅ Email sent successfully!");
    console.log("📨 Message ID:", info.messageId);
    console.log("📬 SMTP Response:", info.response);

    res.status(200).json({ success: true, message: "Message sent successfully" });
  } catch (error) {
    console.error("❌ Error sending email:", error.message);
    res.status(500).json({ success: false, message: "Failed to send message" });
  }
});

module.exports = router;
