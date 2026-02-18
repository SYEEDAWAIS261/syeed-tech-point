const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  products: [
    {
      productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
      quantity: { type: Number, required: true },
      priceAtOrder: { type: Number, required: true },
      selectedVariation: {
      label: { type: String },
      price: { type: Number, default: 0 }
    },
    },
  ],
  total: { type: Number, required: true },
  
  // SHIPPING DETAILS
  shippingMethod: { type: String, default: 'Standard' }, 
  shippingCost: { type: Number, default: 0 },
  paymentMethod: { type: String, default: 'Cash on Delivery' },
  trackingId: { type: String, unique: true, index: true },
  
  status: {
    type: String,
    enum: ['Placed', 'Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled'],
    default: 'Placed',
  },

  // Status History (Great for tracking progress)
  statusHistory: [
    {
      status: String,
      timestamp: { type: Date, default: Date.now },
      comment: String 
    }
  ],

  // Important Timestamps
  deliveredAt: { type: Date },
  cancelledAt: { type: Date },
  statusUpdatedAt: { type: Date, default: Date.now }, 
  createdAt: { type: Date, default: Date.now },

  shippingAddress: {
    fullName: { type: String, required: true },
    phone: { type: String, required: true },
    street: { type: String, required: true },
    city: { type: String, required: true },
    state: { type: String },
    postalCode: { type: String, required: true },
    country: { type: String, required: true },
  },

  // Soft delete for users
  hiddenForUser: {
    type: Boolean,
    default: false,
  },
});

module.exports = mongoose.model('Order', orderSchema);