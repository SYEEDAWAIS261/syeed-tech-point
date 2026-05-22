const Cart = require('../models/Cart');
const Product = require('../models/Product');

const addToCart = async (req, res) => {
  const { productId, quantity, selectedVariation } = req.body;
  const userId = req.user._id;

  try {
    console.log("Full Request Body:", JSON.stringify(req.body, null, 2));

    // 1. Safety Check: Agar variation nahi hai toh empty object ya null handle karein
    const variationId = selectedVariation?.id || null;

    // 2. Query Logic: Variation ID ke sath check karna
    let cartItem = await Cart.findOne({ 
      user: userId, 
      product: productId,
      'selectedVariation.id': variationId // Ab yeh null ko bhi sahi handle karega
    });

    if (cartItem) {
      // Agar same product + same variation mil gaya
      cartItem.quantity += Number(quantity); // Quantity ensure karein ke number ho
      await cartItem.save();
    } else {
      // Naya item add karna
      cartItem = new Cart({
        user: userId,
        product: productId,
        quantity: Number(quantity),
        selectedVariation: {
            id: variationId,
            label: selectedVariation?.label || null,
            price: selectedVariation?.price || 0
        }
      });
      await cartItem.save();
    }

    // Populate taake frontend ko product ki details (image, name) mil jayein
    const populatedItem = await Cart.findById(cartItem._id).populate('product');
    
    res.status(200).json({ 
        message: 'Added to cart', 
        cartItem: populatedItem 
    });

  } catch (err) {
    console.error('❌ Backend Error:', err);
    res.status(500).json({ message: 'Internal Server Error', error: err.message });
  }
};

// ✅ Get Cart Items (Updated)
const getCart = async (req, res) => {
  try {
    // 1. Cart items dhoondein aur product ki details fill (populate) karein
    const cartItems = await Cart.find({ user: req.user._id }).populate('product');

    // 2. Response bhejne se pehle check karein (Optional Debugging)
    console.log("Fetching Cart for User:", req.user._id, cartItems);

    res.status(200).json(cartItems);
  } catch (err) {
    console.error('❌ Get cart failed:', err);
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
// ✅ Clear Full Cart
const clearCart = async (req, res) => {
  try {
    await Cart.deleteMany({ user: req.user._id });

    res.status(200).json({
      message: "Cart cleared successfully"
    });

  } catch (err) {
    res.status(500).json({
      message: "Failed to clear cart",
      error: err.message
    });
  }
};

module.exports = { addToCart, getCart, deleteCartItem, clearCart };
