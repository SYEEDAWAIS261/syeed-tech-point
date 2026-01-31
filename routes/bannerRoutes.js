const express = require("express");
const multer = require("multer");
const path = require("path");
const Banner = require("../models/Banner");

const router = express.Router();

// Setup multer storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/banners");
  },
  filename: function (req, file, cb) {
    cb(
      null,
      Date.now() + "-" + file.originalname.replace(/\s+/g, "_")
    );
  },
});
const upload = multer({ storage });

// ✅ Create Banner
router.post("/", upload.single("image"), async (req, res) => {
  try {
    const { title, desc, isActive } = req.body;
    if (!req.file) {
      return res.status(400).json({ message: "Image is required" });
    }

    const banner = new Banner({
      title,
      desc,
      image: `/uploads/banners/${req.file.filename}`,
      isActive: isActive !== undefined ? isActive : true,
    });

    await banner.save();
    res.status(201).json(banner);
  } catch (err) {
    console.error("Error creating banner:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ✅ Get all banners
router.get("/", async (req, res) => {
  try {
    const banners = await Banner.find().sort({ createdAt: -1 });
    res.json(banners);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

// ✅ Update Banner
router.put("/:id", upload.single("image"), async (req, res) => {
  try {
    const { title, desc, isActive } = req.body;
    const updateData = { title, desc, isActive };

    if (req.file) {
      updateData.image = `/uploads/banners/${req.file.filename}`;
    }

    const updatedBanner = await Banner.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    );

    if (!updatedBanner) {
      return res.status(404).json({ message: "Banner not found" });
    }

    res.json(updatedBanner);
  } catch (err) {
    console.error("Error updating banner:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ✅ Delete Banner
router.delete("/:id", async (req, res) => {
  try {
    const banner = await Banner.findByIdAndDelete(req.params.id);
    if (!banner) {
      return res.status(404).json({ message: "Banner not found" });
    }
    res.json({ message: "Banner deleted successfully" });
  } catch (err) {
    console.error("Error deleting banner:", err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
