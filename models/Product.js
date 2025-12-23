const mongoose = require("mongoose");

// ✅ Sub-schema for reviews
const reviewSchema = new mongoose.Schema(
  {
    name: { type: String, required: true }, // reviewer name
    rating: { type: Number, required: true }, // star rating
    comment: { type: String, required: true }, // make required to ensure meaningful feedback
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    userImage: { type: String, default: "" }, // avatar or profile photo
    // ✅ ADD THIS
    isFeatured: {
      type: Boolean,
      default: false,
    },
  },
  
  { timestamps: true }
);

// ✅ Main product schema
const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    brand: { type: String },
    description: { type: String },
    price: { type: Number, required: true },
    category: { type: String },
    image: { type: String }, // main product image
    images: [{ type: String }], // gallery of images

    // 🧠 Technical details (optional)
    processor: { type: String },
    ram: { type: String },
    storage: { type: String },
    display: { type: String },

    // 🎯 Offer / Sale info
    offerMessage: { type: String, default: "" },
    onSale: { type: Boolean, default: false },

    // 📦 Inventory
    quantity: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },

    // 💰 Discount system
    discountPercentage: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    discountPrice: { type: Number, default: null },

    // 🌟 Ratings & Reviews (AGGREGATED)
rating: {
  type: Number,
  default: 0,     // no reviews yet
  min: 0,
  max: 5,
},

numReviews: {
  type: Number,
  default: 0,
},

reviews: [reviewSchema],

  },
  { timestamps: true }
);

// 🧮 Virtual field: calculate discounted or final price
productSchema.virtual("finalPrice").get(function () {
  if (this.discountPercentage > 0) {
    return (this.price - (this.price * this.discountPercentage) / 100).toFixed(2);
  }
  return this.discountPrice || this.price;
});

module.exports = mongoose.model("Product", productSchema);
