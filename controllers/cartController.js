const Cart = require('../models/Cart');
const Product = require('../models/Product');

// ✅ Add to Cart
const addToCart = async (req, res) => {
  const { productId, quantity } = req.body;
  const userId = req.user._id;

  try {
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    // 🚫 BLOCK out of stock products
    if (product.quantity === 0) {
      return res.status(400).json({ message: "Product is out of stock" });
    }

    // 🚫 Block if requested quantity > available stock
    if (quantity > product.quantity) {
      return res.status(400).json({ message: `Only ${product.quantity} items available` });
    }

    // Check if item already in cart
    let cartItem = await Cart.findOne({ user: userId, product: productId });

    if (cartItem) {
      // 🚫 Prevent exceeding stock
      if (cartItem.quantity + quantity > product.quantity) {
        return res.status(400).json({
          message: `Only ${product.quantity} items available in stock`
        });
      }
      cartItem.quantity += quantity;
    } else {
      cartItem = new Cart({ user: userId, product: productId, quantity });
    }

    await cartItem.save();
    res.status(200).json({ message: 'Item added to cart', cartItem });
  } catch (err) {
    console.error('❌ Add to cart failed:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// ✅ Get Cart Items
const getCart = async (req, res) => {
  try {
    const cartItems = await Cart.find({ user: req.user._id }).populate('product');
    res.status(200).json(cartItems);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch cart', error: err.message });
  }
};

// ✅ Delete Item from Cart
const deleteCartItem = async (req, res) => {
  try {
    const cartItem = await Cart.findById(req.params.id);

    if (!cartItem) return res.status(404).json({ message: 'Item not found' });

    if (cartItem.user.toString() !== req.user._id.toString())
      return res.status(403).json({ message: 'Unauthorized' });

    await cartItem.deleteOne();
    res.status(200).json({ message: 'Item removed from cart' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete item', error: err.message });
  }
};

module.exports = { addToCart, getCart, deleteCartItem };
