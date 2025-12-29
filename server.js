const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const passport = require('passport');
const path = require('path');

// Load env
dotenv.config();

// Connect DB
const connectDB = require('./config/db');
connectDB();

// Init app
const app = express();

// Allowed origins
const allowedOrigins = [
  'https://ai-ecommerce-4a2c6.web.app',
  'http://localhost:5173',
  'http://localhost:3000'
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (!allowedOrigins.includes(origin)) {
      return callback(new Error('CORS not allowed'), false);
    }
    return callback(null, true);
  },
  credentials: true
}));

app.use(express.json());
app.use(passport.initialize());
require('./config/passport');

// Static uploads (⚠️ see note below)
// app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/products', require('./routes/productRoutes'));
app.use('/api/cart', require('./routes/cardRoutes'));
app.use('/api/orders', require('./routes/orderRoutes'));
app.use('/api/contact', require('./routes/contact'));
app.use('/api/payments', require('./routes/paymentRoutes'));
app.use('/api/banners', require('./routes/bannerRoutes'));
app.use('/api/discountbanner', require('./routes/discountbannerRoutes'));
app.use('/api/subscribers', require('./routes/subscriberRoutes'));
app.use('/api/unsubscribe', require('./routes/unsubscribeRoutes'));
app.use('/api/coupons', require('./routes/coupons'));
app.use('/api/reviews', require('./routes/reviewRoutes'));
app.use('/api/cms', require('./routes/cmsRoutes'));

// Global error handler
app.use((err, req, res, next) => {
  console.error('🔥 Server Error:', err);
  res.status(500).json({ message: 'Internal Server Error' });
});

// ✅ EXPORT APP FOR VERCEL
module.exports = app;
