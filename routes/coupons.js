const express = require("express");
const router = express.Router();
const Coupon = require("../models/Coupon");

// @desc  Validate coupon
// @route POST /api/coupons/validate
router.post("/validate", async (req, res) => {
  try {
    const { code, userId } = req.body; // pass userId if you want single-use per user
    if (!code) return res.status(400).json({ valid: false, message: "Coupon code required" });

    const coupon = await Coupon.findOne({ code: code.toUpperCase() });
    if (!coupon) return res.json({ valid: false, message: "Invalid coupon code" });

    // Check expiration
    if (coupon.expiresAt && coupon.expiresAt < new Date()) {
      return res.json({ valid: false, message: "Coupon expired" });
    }

    // Check usage limit
    if (coupon.usageLimit && coupon.usedBy.length >= coupon.usageLimit) {
      return res.json({ valid: false, message: "Coupon usage limit reached" });
    }

    // Check if user already used it
    if (userId && coupon.usedBy.includes(userId)) {
      return res.json({ valid: false, message: "Coupon already used by this user" });
    }

    // Coupon is valid
    res.json({ valid: true, discount: coupon.discount });
  } catch (err) {
    console.error(err);
    res.status(500).json({ valid: false, message: "Server error" });
  }
});

// @desc  Create coupon (admin only)
// @route POST /api/coupons
router.post("/", async (req, res) => {
  try {
    const { code, discount, expiresAt, usageLimit } = req.body;
    const coupon = await Coupon.create({ code, discount, expiresAt, usageLimit });
    res.status(201).json(coupon);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to create coupon" });
  }
});

module.exports = router;
