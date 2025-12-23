const express = require('express');
const router = express.Router();
const { addProduct, getProducts, updateProduct, deleteProduct, getProductById, getLimitedProducts, getHighestDiscountProduct, getTopSellingProducts  } = require('../controllers/productController');
const auth = require('../middleware/authMiddleware');
const upload = require('../middleware/upload'); // ✅ fixed path
const admin = require('../middleware/adminMiddleware');
const { createProductReview } = require('../controllers/createProductReview');
const multer = require('multer');


// Add product with image upload
router.post('/', auth, admin, upload.array('images', 4), addProduct);

router.get('/limited', getLimitedProducts);

// Get all products (public)
router.get('/', getProducts);

// 🆕 Get top 3 best-selling products for banner
router.get("/top-products", getTopSellingProducts);

router.get("/highest-discount", getHighestDiscountProduct);

// Add this to fix the 404 error
router.put('/:id', auth, admin, upload.array('images', 4), updateProduct);

router.delete('/:id', auth, admin, deleteProduct);
router.get('/:id', getProductById);
router.post('/:id/reviews', auth, upload.array('images', 3), createProductReview);

// router.post("/:id/reviews",  createProductReview);
module.exports = router;
