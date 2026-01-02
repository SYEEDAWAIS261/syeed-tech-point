// config/db.js
const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    // Naye Mongoose versions mein options ki zaroorat nahi
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ MongoDB connected successfully');
  } catch (error) {
    console.error('❌ MongoDB Connection Error:', error.message);
    process.exit(1);
  }
};

module.exports = connectDB;