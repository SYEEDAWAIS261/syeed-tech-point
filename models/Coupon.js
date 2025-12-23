const mongoose = require("mongoose");

const couponSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true, uppercase: true },
  discount: { type: Number, required: true }, // e.g., 0.1 = 10%
  expiresAt: { type: Date },                  // optional expiration
  usageLimit: { type: Number },               // optional max usage total
  usedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }], // users who used it
}, { timestamps: true });

module.exports = mongoose.model("Coupon", couponSchema);
