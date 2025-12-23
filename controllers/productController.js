const Product = require('../models/Product');
const Subscriber = require('../models/Subscriber');
const path = require('path');
const fs = require('fs');
const nodemailer = require('nodemailer');
const Order = require("../models/Order");
// ✅ ADD NEW PRODUCT & NOTIFY SUBSCRIBERS
exports.addProduct = async (req, res) => {
  try {
    const {
      name,
      brand,
      description,
      price,
      category,
      processor,
      ram,
      storage,
      display,
      quantity,
      discountPercentage,
      discountPrice,
    } = req.body;

    const imagePaths = req.files
      ? req.files.map((file) => `/uploads/products/${file.filename}`)
      : [];

    const product = new Product({
      name,
      brand,
      description,
      price,
      category,
      image: imagePaths[0] || '', // main image
      images: imagePaths, // all images
      processor,
      ram,
      storage,
      display,
      quantity: Number(quantity) || 0,
      discountPercentage: discountPercentage || 0,
      discountPrice: discountPrice || null,
    });

    await product.save();

    // ✅ Notify all subscribers about the new product
    const subscribers = await Subscriber.find();

    if (subscribers.length > 0) {
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.SMTP_EMAIL, // Gmail address
          pass: process.env.SMTP_PASS,  // Gmail App Password
        },
      });

      const productUrl = `http://localhost:5173/products/${product._id}`; // ⚠️ Replace with your actual frontend URL

     for (const s of subscribers) {
  const mailOptions = {
    from: process.env.SMTP_EMAIL,
    to: s.email,
    subject: `🆕 New Product Alert: ${product.name}`,
    html: `
      <div style="font-family: Arial; padding: 10px;">
        <h2>${product.name}</h2>
        <p><strong>Brand:</strong> ${brand}</p>
        <p>${description}</p>
        <p><strong>Price:</strong> $${price}</p>
        <a href="http://localhost:5173/products/${product._id}" 
          style="display:inline-block; padding:10px 20px; background:#007bff; color:#fff; text-decoration:none; border-radius:5px;">
          View Product
        </a>
        <br><br>
       <small>
  You’re receiving this email because you subscribed to our product updates.<br>
  <a href="http://localhost:5000/api/unsubscribe/${s.unsubscribeToken}" 
     style="color:#dc3545;text-decoration:none;">
     Unsubscribe
  </a> anytime.
</small>

      </div>
    `,
  };

  await transporter.sendMail(mailOptions);
}

console.log(`✅ Notification email sent to ${subscribers.length} subscribers`);
    }
    res.json(product);
  } catch (err) {
    console.error('Failed to add product:', err);
    res.status(500).json({ message: 'Failed to add product', error: err.message });
  }
};

// ✅ GET PRODUCT BY ID
exports.getProductById = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: 'Product not found' });
    res.json(product);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// ✅ GET ALL PRODUCTS
exports.getProducts = async (req, res) => {
  try {
    const products = await Product.find();
    res.json(products);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch products', error: err.message });
  }
};

// ✅ UPDATE PRODUCT
exports.updateProduct = async (req, res) => {
  try {
    const updateData = { ...req.body };

    // Handle quantity properly
    if (updateData.quantity !== undefined) {
      updateData.quantity = Number(updateData.quantity);
      if (updateData.quantity < 0) updateData.quantity = 0;
    }

    // Handle uploaded images
    if (req.files && req.files.length > 0) {
      const imagePaths = req.files.map((file) => `/uploads/products/${file.filename}`);
      updateData.image = imagePaths[0];
      updateData.images = imagePaths;
    }

    const product = await Product.findByIdAndUpdate(req.params.id, updateData, { new: true });
    if (!product) return res.status(404).json({ message: 'Product not found' });

    res.json(product);
  } catch (err) {
    console.error('Error updating product:', err);
    res.status(500).json({ message: 'Error updating product', error: err.message });
  }
};

// ✅ DELETE PRODUCT
exports.deleteProduct = async (req, res) => {
  try {
    await Product.findByIdAndDelete(req.params.id);
    res.json({ message: 'Product deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete product', error: err.message });
  }
};

// ✅ CREATE PRODUCT REVIEW
// exports.createProductReview = async (req, res) => {
//   try {
//     const { rating, comment, anonymous } = req.body;
//     const images = req.files || [];

//     if (!rating || rating < 1 || rating > 5)
//       return res.status(400).json({ message: 'Please provide a valid rating (1-5)' });

//     if (!comment || comment.trim() === '')
//       return res.status(400).json({ message: 'Please write a comment for your review' });

//     const product = await Product.findById(req.params.id);
//     if (!product) return res.status(404).json({ message: 'Product not found' });

//     const alreadyReviewed = product.reviews.find(
//       (r) => r.user && r.user.toString() === req.user._id.toString()
//     );
//     if (alreadyReviewed)
//       return res.status(400).json({ message: 'You have already reviewed this product' });

//     const imagePaths = images.map((file) => `/uploads/reviews/${file.filename}`);

//     const review = {
//       name: anonymous === 'true' || anonymous === true ? 'Anonymous' : req.user.name,
//       rating: Number(rating),
//       comment,
//       user: req.user._id,
//       images: imagePaths,
//       createdAt: new Date(),
//     };

//     product.reviews.push(review);
//     product.numReviews = product.reviews.length;
//     product.rating =
//       product.reviews.reduce((acc, item) => acc + item.rating, 0) / product.reviews.length;

//     await product.save();

//     res.status(201).json({
//       message: 'Review added successfully',
//       review,
//       numReviews: product.numReviews,
//       rating: product.rating,
//     });
//   } catch (error) {
//     console.error('Error creating product review:', error);
//     res.status(500).json({ message: 'Server error while adding review' });
//   }
// };

// ✅ GET LIMITED PRODUCTS (for homepage)
exports.getLimitedProducts = async (req, res) => {
  try {
    const products = await Product.find().limit(8);
    res.json(products);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch limited products', error: err.message });
  }
};

// 🆕 Get top 3 best-selling products
exports.getTopSellingProducts = async (req, res) => {
  try {
    const topProducts = await Order.aggregate([
      { $unwind: "$products" },
      { 
        $group: {
          _id: "$products.productId", // ✅ correct field name
          totalSold: { $sum: "$products.quantity" },
        },
      },
      { $sort: { totalSold: -1 } },
      { $limit: 3 },
      {
        $lookup: {
          from: "products",
          localField: "_id",
          foreignField: "_id",
          as: "productDetails"
        }
      },
      { $unwind: "$productDetails" },
      {
        $project: {
          _id: 0,
          totalSold: 1,
          product: "$productDetails"
        }
      }
    ]);

    res.status(200).json(topProducts);
  } catch (error) {
    console.error("Error fetching top products:", error);
    res.status(500).json({ message: "Server error" });
  }
};


// 🆕 Get product with the highest discount
exports.getHighestDiscountProduct = async (req, res) => {
  try {
    // Find product with the maximum discountPercentage
    const product = await Product.findOne({ discountPercentage: { $gt: 0 } })
      .sort({ discountPercentage: -1 }) // highest first
      .limit(1);

    if (!product) return res.status(404).json({ message: "No discounted products found" });

    res.status(200).json(product);
  } catch (error) {
    console.error("Error fetching highest discount product:", error);
    res.status(500).json({ message: "Server error" });
  }
};


