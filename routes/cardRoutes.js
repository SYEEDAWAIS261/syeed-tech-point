const express = require('express');
const router = express.Router();
const { addToCart, getCart, deleteCartItem } = require('../controllers/cartController');
const protect = require('../middleware/authMiddleware');

// POST /api/cart/add
router.post('/add', protect, addToCart);

// GET /api/cart/
router.get('/', protect, getCart);

// DELETE /api/cart/:id
router.delete('/:id', protect, deleteCartItem);

module.exports = router;
