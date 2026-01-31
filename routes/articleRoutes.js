const express = require('express');
const router = express.Router();
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');
const { 
  createArticle, 
  getAllArticles, 
  getArticleById, 
  deleteArticle 
} = require('../controllers/articleController');

// 1. Cloudinary Configuration
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// 2. Professional Cloudinary Storage for Articles
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'article_images', // Cloudinary par articles ke liye alag folder ban jayega
    allowed_formats: ['jpg', 'png', 'jpeg', 'webp'],
  },
});

const upload = multer({ storage });

/* =========================
   ROUTES
========================= */

// Public Routes
router.get('/', getAllArticles);
router.get('/:id', getArticleById);

// Admin Routes
// Note: Yahan aap 'auth' aur 'admin' middleware bhi add kar sakte hain
router.post('/', upload.single('image'), createArticle);
router.delete('/:id', deleteArticle);

module.exports = router;