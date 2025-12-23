const express = require("express");
const router = express.Router();
const auth = require("../middleware/authMiddleware");
const admin = require("../middleware/adminMiddleware");

const {
  createOrder,
  getUserOrders,
  getAllOrders,
  updateOrderStatus,
  deleteOrder,
  downloadInvoice,
  trackOrder,
  cancelOrder,
  deleteCancelledOrder,
} = require("../controllers/orderController");

const Order = require("../models/Order");

// 🟢 USER ROUTES
// Create new order
router.post("/", auth, createOrder);

// Get all orders for logged-in user
router.get("/", auth, getUserOrders);

// Cancel order (Customer)
router.put("/:id/cancel", auth, cancelOrder);

// Delete cancelled order (optional cleanup by user)
router.delete("/cancelled/:id", auth, deleteCancelledOrder);

// 🆕 Public route — Track order by tracking ID (no auth required)
router.get("/track/:trackingId", trackOrder);

// 🛡️ ADMIN ROUTES
// Get all orders (Admin only)
router.get("/admin", auth, admin, getAllOrders);

// Update order status (Admin)
router.put("/:id/status", auth, admin, updateOrderStatus);

// Delete order (Admin) — only if Cancelled or Delivered
router.delete("/:id", auth, admin, deleteOrder);

// Download invoice (Admin)
router.get("/:orderId/invoice", auth, admin, downloadInvoice);

// 📊 ORDER STATISTICS (Admin Dashboard)
router.get("/stats", auth, admin, async (req, res) => {
  try {
    const range = parseInt(req.query.range) || 7; // Default = last 7 days
    const sinceDate = new Date();
    sinceDate.setDate(sinceDate.getDate() - range);

    const stats = await Order.aggregate([
      { $match: { createdAt: { $gte: sinceDate } } },
      {
        $group: {
          _id: { $dayOfMonth: "$createdAt" },
          orders: { $sum: 1 },
        },
      },
      { $sort: { "_id": 1 } },
    ]);

    const formatted = stats.map((s) => ({
      name: `Day ${s._id}`,
      orders: s.orders,
    }));

    res.json(formatted);
  } catch (err) {
    console.error("❌ Order stats error:", err);
    res.status(500).json({ message: "Error fetching order stats" });
  }
});

module.exports = router;
