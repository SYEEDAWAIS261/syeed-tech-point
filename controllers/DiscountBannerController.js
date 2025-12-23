// import Banner from "../models/DiscountBanner.js";

// // Get all banners
// export const getBanners = async (req, res) => {
//   try {
//     const banners = await Banner.find();
//     res.json(banners);
//   } catch (err) {
//     res.status(500).json({ message: "Error fetching banners", error: err.message });
//   }
// };

// // Get only active banner (for homepage)
// export const getActiveBanner = async (req, res) => {
//   try {
//     const banner = await Banner.findOne({ isActive: true }).sort({ createdAt: -1 });
//     if (!banner) return res.status(404).json({ message: "No active banner found" });
//     res.json(banner);
//   } catch (err) {
//     res.status(500).json({ message: "Error fetching active banner", error: err.message });
//   }
// };

// // Add new banner
// export const createBanner = async (req, res) => {
//   try {
//     const banner = new Banner(req.body);
//     await banner.save();
//     res.status(201).json(banner);
//   } catch (err) {
//     res.status(400).json({ message: "Error creating banner", error: err.message });
//   }
// };

// // Update banner
// export const updateBanner = async (req, res) => {
//   try {
//     const banner = await Banner.findByIdAndUpdate(req.params.id, req.body, { new: true });
//     res.json(banner);
//   } catch (err) {
//     res.status(400).json({ message: "Error updating banner", error: err.message });
//   }
// };

// // Delete banner
// export const deleteBanner = async (req, res) => {
//   try {
//     await Banner.findByIdAndDelete(req.params.id);
//     res.json({ message: "Banner deleted" });
//   } catch (err) {
//     res.status(400).json({ message: "Error deleting banner", error: err.message });
//   }
// };
