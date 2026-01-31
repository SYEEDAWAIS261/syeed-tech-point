const express = require('express');
const router = express.Router();
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

const { 
  addProduct, getProducts, updateProduct, deleteProduct, 
  getProductById, getLimitedProducts, getHighestDiscountProduct, 
  getTopSellingProducts, toggleWishlist  
} = require('../controllers/productController');

const auth = require('../middleware/authMiddleware');
const admin = require('../middleware/adminMiddleware');
const { createProductReview } = require('../controllers/createProductReview');

// 1. Cloudinary Configuration
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// 2. Cloudinary Storage Setup for Products (Multiple Images)
const productStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'products',
    allowed_formats: ['jpg', 'png', 'jpeg', 'webp'],
  },
});

const upload = multer({ storage: productStorage });

/* =========================
   ROUTES
========================= */

router.get('/', getProducts);
router.get('/limited', getLimitedProducts);
router.get("/top-products", getTopSellingProducts);
router.get("/highest-discount", getHighestDiscountProduct);
router.get('/:id', getProductById);
router.post('/wishlist/toggle/:productId', auth, toggleWishlist);
router.post('/:id/reviews', auth, upload.array('images', 3), createProductReview);
router.post('/', auth, admin, upload.array('images', 4), addProduct);
router.put('/:id', auth, admin, upload.array('images', 4), updateProduct);
router.delete('/:id', auth, admin, deleteProduct);

module.exports = router;