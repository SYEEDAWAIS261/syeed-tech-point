const mongoose = require("mongoose");

const discountBannerSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    subtitle: { type: String },
    discount: { type: String },
    category: { type: String },
    image: { type: String, required: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("DiscountBanner", discountBannerSchema);
