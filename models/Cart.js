const mongoose = require('mongoose');

const cartSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  quantity: { type: Number, default: 1, required: true },
  selectedVariation: {
    id: { type: String, default: null }, // 🟢 Yeh add karna zaroori hai unique check ke liye
    label: { type: String, default: null },
    price: { type: Number, default: 0 }
  }
}, { timestamps: true });

module.exports = mongoose.models.Cart || mongoose.model('Cart', cartSchema);