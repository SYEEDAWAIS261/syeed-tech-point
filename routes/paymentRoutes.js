require("dotenv").config();

const express = require("express");
const router = express.Router();
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const Cart = require("../models/Cart");
const Order = require("../models/Order");
const crypto = require("crypto");
const auth = require("../middleware/authMiddleware");
const Product = require("../models/Product");

// CREATE STRIPE CHECKOUT SESSION
// CREATE STRIPE CHECKOUT SESSION
router.post("/create-checkout-session", auth, async (req, res) => {
  try {

    const { cartItems, shippingCost, shippingAddress, total } = req.body;

    if (!Array.isArray(cartItems) || cartItems.length === 0) {
      return res.status(400).json({ error: "Cart is empty" });
    }

    // STEP 1: Calculate subtotal
    const subtotal = cartItems.reduce((acc, item) => {

      const basePrice = parseFloat(item.product.price);
      const discount = parseFloat(item.product.discountPercentage || 0);
      const discountedBase = basePrice * (1 - discount / 100);

      const variationPrice = item.selectedVariation?.price
        ? parseFloat(item.selectedVariation.price)
        : 0;

      const finalPrice = discountedBase + variationPrice;

      return acc + (finalPrice * item.quantity);

    }, 0);

    // STEP 2: Create Stripe line items
    const line_items = cartItems.map(item => {

      const basePrice = parseFloat(item.product.price);
      const discount = parseFloat(item.product.discountPercentage || 0);
      const discountedBase = basePrice * (1 - discount / 100);

      const variationPrice = item.selectedVariation?.price
        ? parseFloat(item.selectedVariation.price)
        : 0;

      const finalPrice = Math.round((discountedBase + variationPrice) * 100);

      return {
        price_data: {
          currency: "aed",
          product_data: {
            name: item.product.name,
            description: item.selectedVariation?.label || "Standard Model",
          },
          unit_amount: finalPrice,
        },
        quantity: item.quantity,
      };

    });

    // VAT
    const vat = subtotal * 0.05;

    line_items.push({
      price_data: {
        currency: "aed",
        product_data: {
          name: "VAT (5%)",
        },
        unit_amount: Math.round(vat * 100),
      },
      quantity: 1,
    });

    // Shipping
    if (shippingCost && shippingCost > 0) {
      line_items.push({
        price_data: {
          currency: "aed",
          product_data: {
            name: "Shipping Fee",
          },
          unit_amount: Math.round(shippingCost * 100),
        },
        quantity: 1,
      });
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items,
      mode: "payment",

      success_url: `http://localhost:3000/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `http://localhost:3000/checkout`,

      billing_address_collection: "required",

      metadata: {
        userId: req.user._id.toString(),
        shippingAddress: JSON.stringify(shippingAddress),
        total: total.toString(),
        shippingCost: shippingCost.toString()
      }
    });

    res.json({ url: session.url });

  } catch (err) {
    console.error("Stripe session error:", err);
    res.status(500).json({ error: err.message });
  }
});

// CONFIRM STRIPE ORDER
router.post("/confirm", auth, async (req, res) => {
  try {

    const { sessionId } = req.body;

    const session = await stripe.checkout.sessions.retrieve(sessionId);
    // Prevent duplicate orders
const existingOrder = await Order.findOne({
  stripeSessionId: session.id
});

if (existingOrder) {
  return res.json({
    message: "Order already confirmed",
    order: existingOrder
  });
}

    if (!session) {
      return res.status(400).json({ message: "Invalid session" });
    }

    const cartItems = await Cart.find({ user: session.metadata.userId }).populate("product");
    const shippingAddress = JSON.parse(session.metadata.shippingAddress);
    const total = parseFloat(session.metadata.total);
    const shippingCost = parseFloat(session.metadata.shippingCost || 0);
let calculatedSubtotal = 0;
  const orderProducts = cartItems.map(item => {
      const basePrice = parseFloat(item.product.price);
      const discount = parseFloat(item.product.discountPercentage || 0);
      const discountedBase = basePrice * (1 - discount / 100);
      const variationPrice = item.selectedVariation?.price ? parseFloat(item.selectedVariation.price) : 0;

      const finalPrice = discountedBase + variationPrice;
      
      // Subtotal mein add karein
      calculatedSubtotal += (finalPrice * item.quantity);

      return {
        productId: item.product._id,
        quantity: item.quantity,
        priceAtOrder: finalPrice,
        selectedVariation: item.selectedVariation || null
      };
    });

    // ✅ STEP 2: VAT calculate karein
    const calculatedTax = calculatedSubtotal * 0.05;

    // ✅ STEP 3: Order create karte waqt ye keys lazmi pass karein
    const order = new Order({
      userId: session.metadata.userId,
      stripeSessionId: session.id,
      products: orderProducts,
      subtotal: calculatedSubtotal, // 👈 Missing tha, ab save hoga
      tax: calculatedTax,           // 👈 Missing tha, ab save hoga
      total,
      shippingCost,
      paymentMethod: "Stripe",
      shippingAddress,
      status: "Placed",
      trackingId: "ORD-" + crypto.randomBytes(4).toString("hex").toUpperCase()
    });

    await order.save();
// 🔽 UPDATE PRODUCT & VARIATION STOCK
for (const item of cartItems) {

  const product = await Product.findById(item.product._id);

  if (!product) continue;

  // Reduce main product stock
  product.quantity -= item.quantity;

  // Reduce variation stock
  if (item.selectedVariation) {

    const variation = product.variations.find(
      v => String(v._id) === String(item.selectedVariation.id)
    );

    if (variation) {
      variation.quantity -= item.quantity;
    }
  }

  await product.save();
}

// Clear cart after stock update
await Cart.deleteMany({ user: session.metadata.userId });

    res.json({
      message: "Stripe order confirmed",
      order
    });

  } catch (error) {
    console.error("Stripe confirm error:", error);
    res.status(500).json({ error: "Order confirmation failed" });
  }
});

module.exports = router;