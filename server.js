const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const passport = require('passport');
const http = require('http');
const path = require('path');

// Load environment variables
dotenv.config();

// Connect DB
const connectDB = require('./config/db');
connectDB();

// 1. Import routes
const authRoutes = require('./routes/authRoutes');
const productRoutes = require('./routes/productRoutes');
const cardRoutes = require('./routes/cardRoutes');
const orderRoutes = require('./routes/orderRoutes');
const contactRoute = require('./routes/contact');
const paymentRoutes = require('./routes/paymentRoutes');
const bannerRoutes = require('./routes/bannerRoutes');
const discountbannerRoutes = require('./routes/discountbannerRoutes');
const subscriberRoutes = require('./routes/subscriberRoutes');
const unsubscribeRoutes = require('./routes/unsubscribeRoutes');
const couponRoutes = require('./routes/coupons');
const reviewRoutes = require('./routes/reviewRoutes');
const cmsRoutes = require('./routes/cmsRoutes'); 
const chatRoutes = require("./routes/chatRoutes"); // Extension (.js) ki zaroorat nahi hoti
const articleRoutes = require('./routes/articleRoutes');

require('./config/passport'); // Google strategy

// Initialize app
const app = express();
const server = http.createServer(app);

// 2. Middleware
app.use(cors({
  origin: [
    "http://localhost:5173", 
    "http://localhost:5174",
    process.env.FRONTEND_URL, // Firebase/Vercel URL
  ],
  methods: ["GET", "POST", "PUT", "DELETE"],
  credentials: true
}));

app.use(express.json());
app.set("trust proxy", 1);
app.use(passport.initialize());

/* NOTE: Cloudinary use karne ke baad '/uploads' static folder ki zaroorat nahi hai.
   Lekin agar purani images abhi bhi local hain toh ye lines rehne dein:
*/
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// 3. API Routes
// Inko temporarily add karein check karne ke liye
console.log('authRoutes:', typeof authRoutes);
console.log('productRoutes:', typeof productRoutes);
console.log('bannerRoutes:', typeof bannerRoutes);
console.log('discountbannerRoutes:', typeof discountbannerRoutes);
console.log('cmsRoutes:', typeof cmsRoutes);
console.log('articleRoutes:', typeof articleRoutes);

app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/cart', cardRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/contact', contactRoute);
app.use('/api/payments', paymentRoutes);
app.use('/api/banners', bannerRoutes);
app.use('/api/discountbanner', discountbannerRoutes);
app.use('/api/subscribers', subscriberRoutes);
app.use('/api/unsubscribe', unsubscribeRoutes);
app.use('/api/coupons', couponRoutes);
app.use("/api/reviews", reviewRoutes);
app.use('/api/cms', cmsRoutes);
app.use("/api/chat", chatRoutes);
app.use('/api/articles', articleRoutes);

// Root Route for Testing
app.get('/', (req, res) => {
  res.send('🚀 Syeed Tech Point API is Running...');
});

// 4. Global Error Handler
app.use((err, req, res, next) => {
  console.error('🔥 Server Error:', err.stack);
  res.status(500).json({ 
    success: false, 
    message: 'Internal Server Error',
    error: process.env.NODE_ENV === 'development' ? err.message : {} 
  });
});

// Start Server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));