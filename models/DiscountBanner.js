const mongoose = require("mongoose");

const discountBannerSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    subtitle: { type: String },
    discount: { type: String },
    category: { type: String },
    image: { type: String, required: true },
    isActive: { type: Boolean, default: true },
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' }
  },
  { timestamps: true }
);

module.exports = mongoose.model("DiscountBanner", discountBannerSchema);
