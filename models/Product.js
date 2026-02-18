const mongoose = require("mongoose");

// ✅ Review Schema
const reviewSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    rating: { type: Number, required: true },
    comment: { type: String, required: true },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    userImage: { type: String, default: "" },
    isFeatured: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

// ✅ Main Product Schema
const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    brand: { type: String, required: true }, // required kar diya dropdown ke liye
    description: { type: String, required: true },
    category: { type: String, required: true }, // dropdown ke liye required
    price: { type: Number, required: true },
    quantity: { type: Number, required: true, default: 0, min: 0 },
    
    returnPolicy: {
    type: String,
    default: "14 Days" // Aap default value bhi set kar sakte hain
  },
  shippingDetails: {
    type: String,
    default: "Free in UAE"
  },

    // Images
    image: { type: String }, 
    images: [{ type: String }], 

    // ✅ Technical Details (Dropdown selections)
    processor: { type: String },
    ram: { type: String },
    storage: { type: String },
    display: { type: String },

    // ✅ Specifications Table
    specifications: [
      {
        label: { type: String }, 
        value: { type: String }  
      }
    ],

    // ✅ FAQs Section
    faqs: [
      {
        question: { type: String },
        answer: { type: String }
      }
    ],

    // ✅ Variations (e.g., RAM/SSD upgrades)
    variations: [
      {
        label: { type: String }, 
        price: { type: Number }, 
        quantity: { type: Number, default: 0 }
      }
    ],

    // ✅ Key Features (Bullet points)
    keyFeatures: [{ type: String }], // Array of strings

    // ✅ Product Condition
    condition: { 
      type: String, 
      enum: ['new', 'renewed'], 
      default: 'new' 
    },

    // 💰 Discount System
    discountPercentage: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    discountPrice: { type: Number, default: null },

    // ✨ Banner/Hero Product Info
    isBannerProduct: { type: Boolean, default: false },
    bannerTitle: { type: String, default: "" },
    expiryDate: { type: Date }, // Countdown timer ke liye

    // 🌟 Ratings & Reviews
    rating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },
    numReviews: {
      type: Number,
      default: 0,
    },
    reviews: [reviewSchema],

    // 🎯 Sale info
    offerMessage: { type: String, default: "" },
    onSale: { type: Boolean, default: false },

  },
  { 
    timestamps: true,
    toJSON: { virtuals: true }, // Virtuals ko JSON mein dikhane ke liye zaroori hai
    toObject: { virtuals: true }
  }
);

// 🧮 Virtual field: Final Price Calculation
productSchema.virtual("finalPrice").get(function () {
  if (this.discountPercentage > 0) {
    return parseFloat((this.price - (this.price * this.discountPercentage) / 100).toFixed(2));
  }
  return this.discountPrice || this.price;
});

module.exports = mongoose.model("Product", productSchema);