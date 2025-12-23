const dotenv = require('dotenv');
dotenv.config(); // ✅ ensure environment variables are available


const express = require('express');
const router = express.Router();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY); // ✅ uses env variable
const auth = require('../middleware/authMiddleware');
router.post('/create-checkout-session', auth, async (req, res) => {
  try {
    const { cartItems } = req.body;

    if (!Array.isArray(cartItems) || cartItems.length === 0) {
      return res.status(400).json({ error: 'Cart is empty or invalid format' });
    }

    const line_items = cartItems.map(item => {
      if (!item.product || typeof item.product.price !== 'number') {
        throw new Error('Invalid product structure');
      }

      return {
        price_data: {
          currency: 'usd',
          product_data: {
            name: item.product.brand || 'Product',
          },
          unit_amount: Math.round(item.product.price * 100), // in cents
        },
        quantity: item.quantity,
      };
    });

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items,
      mode: 'payment',
      success_url: 'http://localhost:5173/success',
      cancel_url: 'http://localhost:5173/cancel',
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error('❌ Stripe error:', err.message);
    res.status(500).json({ error: 'Stripe session creation failed' });
  }
});

module.exports = router;
