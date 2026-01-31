const express = require("express");
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require("multer");
const DiscountBanner = require("../models/DiscountBanner");

const router = express.Router();

// 1. Cloudinary Configuration
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// 2. Cloudinary Storage Setup
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'discount_banners', // Cloudinary par alag folder
    allowed_formats: ['jpg', 'png', 'jpeg', 'webp'],
  },
});

const upload = multer({ storage });

// ✅ Create Discount Banner
router.post("/", upload.single("image"), async (req, res) => {
  try {
    const { title, subtitle, discount, category, isActive } = req.body;

    if (!req.file) {
      return res.status(400).json({ message: "Image is required" });
    }

    const banner = new DiscountBanner({
      title,
      subtitle,
      discount,
      category,
      image: req.file.path, // ✅ Cloudinary URL
      isActive: isActive !== undefined ? isActive : true,
    });

    await banner.save();
    res.status(201).json(banner);
  } catch (err) {
    console.error("Error creating discount banner:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ✅ Get all discount banners
router.get("/", async (req, res) => {
  try {
    const banners = await DiscountBanner.find().sort({ createdAt: -1 });
    res.json(banners);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

// ✅ Get active banner
router.get("/active", async (req, res) => {
  try {
    const banner = await DiscountBanner.findOne({ isActive: true }).sort({ createdAt: -1 });
    if (!banner) return res.status(404).json({ message: "No active discount banner" });
    res.json(banner);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

// ✅ Update Discount Banner
router.put("/:id", upload.single("image"), async (req, res) => {
  try {
    const { title, subtitle, discount, category, isActive } = req.body;
    const updateData = { title, subtitle, discount, category, isActive };

    if (req.file) {
      updateData.image = req.file.path; // ✅ Cloudinary URL update
    }

    const updatedBanner = await DiscountBanner.findByIdAndUpdate(req.params.id, updateData, { new: true });

    if (!updatedBanner) {
      return res.status(404).json({ message: "Discount banner not found" });
    }

    res.json(updatedBanner);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

// ✅ Delete Discount Banner
router.delete("/:id", async (req, res) => {
  try {
    const banner = await DiscountBanner.findByIdAndDelete(req.params.id);
    if (!banner) {
      return res.status(404).json({ message: "Discount banner not found" });
    }
    res.json({ message: "Discount banner deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;