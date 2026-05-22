const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const passport = require('passport');
const http = require('http');
const path = require('path');
const User = require('./models/User');

// Load environment variables
dotenv.config();

// Connect DB
const connectDB = require('./config/db');
connectDB();

// Import routes
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
const reviewRoutes = require('./routes/reviewRoutes')
const cmsRoutes = require('./routes/cmsRoutes'); 
const chatRoutes = require ("./routes/chatRoutes.js");
const articleRoutes = require('./routes/articleRoutes');
require('./config/passport'); // Google strategy

// Initialize app
const app = express();
const server = http.createServer(app);

// ✅ Advanced & Permanent CORS Fix
const allowedOrigins = [
  "http://localhost:3000", 
  "http://localhost:5173", // Default Vite
  "http://localhost:5174", // Aapka current port
  "https://ai-ecommerce-4a2c6.web.app", // Aapka purana frontend
  process.env.CLIENT_URL // Render par ja karke ye set karenge
];

app.use(cors({
  origin: function (origin, callback) {
    // Postman ya Mobile App se agar request aaye toh origin undefined hota hai, use allow karo
    if (!origin) return callback(null, true);

    // Agar origin allowed list mein hai toh allow karo
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
      callback(new Error(msg), false);
    }
  },
  credentials: true, // Cookies ke liye zaroori hai
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"]
}));
app.use(express.json());
app.set("trust proxy", 1);
app.use(passport.initialize());

// Serve static uploads folder
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/uploads/articles', express.static(path.join(__dirname, 'uploads/articles')));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/cart', cardRoutes);
app.use('/api/orders', orderRoutes); // ✅ Includes new /track/:trackingId route
app.use('/api/contact', contactRoute);
app.use('/api/stripe', paymentRoutes);
app.use('/api/banners', bannerRoutes);
app.use('/api/discountbanner', discountbannerRoutes);
app.use('/api/subscribers', subscriberRoutes);
app.use('/api/unsubscribe', unsubscribeRoutes);
app.use('/api/coupons', couponRoutes);
app.use("/api/reviews", reviewRoutes);
app.use('/api/cms', cmsRoutes);
app.use("/api/chat", chatRoutes);
app.use('/api/articles', articleRoutes);
// ⚙️ Global Error Handler (optional, but useful)
app.use((err, req, res, next) => {
  console.error('🔥 Server Error:', err.stack);
  res.status(500).json({ message: 'Internal Server Error' });
});

// Start Server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
