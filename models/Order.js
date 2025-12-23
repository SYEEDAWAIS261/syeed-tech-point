const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  products: [
    {
      productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
      quantity: { type: Number, required: true },
    },
  ],
  total: { type: Number, required: true },
  paymentMethod: { type: String, default: 'Cash on Delivery' },
  trackingId: { type: String, unique: true, index: true },
  status: {
    type: String,
    enum: ['Placed', 'Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled'],
    default: 'Placed',
  },
  cancelledAt: { type: Date },
  statusUpdatedAt: { type: Date, default: Date.now }, // 🆕 Add this line
  shippingAddress: {
    fullName: { type: String, required: true },
    phone: { type: String, required: true },
    street: { type: String, required: true },
    city: { type: String, required: true },
    state: { type: String },
    postalCode: { type: String, required: true },
    country: { type: String, required: true },
  },
  createdAt: { type: Date, default: Date.now },
  hiddenForUser: {
  type: Boolean,
  default: false,
},

});

module.exports = mongoose.model('Order', orderSchema);
