const mongoose = require('mongoose');

const cartSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  quantity: { type: Number, default: 1, required: true },
  // 🟢 Is section ko bilkul aise hi copy-paste karein
  selectedVariation: {
    label: { type: String, default: null },
    price: { type: Number, default: 0 }
  }
}, { timestamps: true });

// Agar model pehle se bana hai toh usay delete karke naya banayein (sirf cache ke liye)
module.exports = mongoose.models.Cart || mongoose.model('Cart', cartSchema);