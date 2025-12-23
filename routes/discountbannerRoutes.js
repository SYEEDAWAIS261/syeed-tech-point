const express = require("express");
const multer = require("multer");
const path = require("path");
const DiscountBanner = require("../models/DiscountBanner");

const router = express.Router();

// Setup multer storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/banners"); // same folder as banners
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + "-" + file.originalname.replace(/\s+/g, "_"));
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
      image: `/uploads/banners/${req.file.filename}`,
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
    console.error("Error fetching discount banners:", err);
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
    console.error("Error fetching active banner:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ✅ Update Discount Banner
router.put("/:id", upload.single("image"), async (req, res) => {
  try {
    const { title, subtitle, discount, category, isActive } = req.body;
    const updateData = { title, subtitle, discount, category, isActive };

    if (req.file) {
      updateData.image = `/uploads/banners/${req.file.filename}`;
    }

    const updatedBanner = await DiscountBanner.findByIdAndUpdate(req.params.id, updateData, { new: true });

    if (!updatedBanner) {
      return res.status(404).json({ message: "Discount banner not found" });
    }

    res.json(updatedBanner);
  } catch (err) {
    console.error("Error updating discount banner:", err);
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
    console.error("Error deleting discount banner:", err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
