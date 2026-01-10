const Product = require('../models/Product');
const Subscriber = require('../models/Subscriber');
const path = require('path');
const fs = require('fs');
const nodemailer = require('nodemailer');
const Order = require("../models/Order");
const Wishlist = require('../models/Wishlist');
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

    const backendUrl = process.env.BASE_URL || "https://syeed-ecommerce-backend.koyeb.app";
    const fullImageUrl = product.image 
      ? `${backendUrl}${product.image}` 
      : `https://via.placeholder.com/600x400?text=${name}`;

    // 3. Notify Subscribers (Non-blocking way)
    const subscribers = await Subscriber.find();

    if (subscribers.length > 0) {
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.SMTP_EMAIL,
          pass: process.env.SMTP_PASS,
        },
      });

      // Humne yahan 'await' loop ke bahar lagaya hai taake emails background mein chali jayein
      const emailPromises = subscribers.map((s) => {
        const mailOptions = {
          from: `"Syeed Tech Point" <${process.env.SMTP_EMAIL}>`,
          to: s.email,
          subject: `🆕 New Product Alert: ${product.name}`,
          html: `
<div style="background-color: #f8f9fa; padding: 40px 10px; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; shadow: 0 4px 6px rgba(0,0,0,0.1); border: 1px solid #e1e4e8;">
    
    <div style="background-color: #007bff; padding: 20px; text-align: center;">
      <h1 style="color: #ffffff; margin: 0; font-size: 24px;">Syeed Tech Point</h1>
    </div>

    <div style="padding: 30px;">
    <div style="margin-bottom: 25px; text-align: center;">
        <img src="${fullImageUrl}" 
             alt="${product.name}" 
             style="width: 100%; max-width: 540px; height: auto; border-radius: 12px; display: block; margin: 0 auto;" 
        />
      </div>
      <span style="display: inline-block; padding: 4px 12px; background: #e3f2fd; color: #0d6efd; border-radius: 50px; font-size: 12px; font-weight: bold; margin-bottom: 15px; text-uppercase;">New Arrival</span>
      
      <h2 style="color: #1a202c; margin-top: 0; margin-bottom: 10px; font-size: 22px;">${product.name}</h2>
      
      <p style="color: #4a5568; line-height: 1.6; margin-bottom: 20px;">
        ${description.substring(0, 150)}...
      </p>

      <div style="background: #fdfdfd; border: 1px dashed #cbd5e0; border-radius: 8px; padding: 15px; margin-bottom: 25px;">
        <table width="100%">
          <tr>
            <td><strong style="color: #718096;">Brand:</strong></td>
            <td style="text-align: right; color: #2d3748;">${brand}</td>
          </tr>
          <tr>
            <td><strong style="color: #718096;">Availability:</strong></td>
            <td style="text-align: right; color: #38a169;">In Stock</td>
          </tr>
          <tr>
            <td style="padding-top: 10px;"><strong style="color: #2d3748; font-size: 20px;">Price:</strong></td>
            <td style="padding-top: 10px; text-align: right; color: #007bff; font-size: 24px; font-weight: bold;">$${price}</td>
          </tr>
        </table>
      </div>

      <div style="text-align: center;">
        <a href="https://ai-ecommerce-4a2c6.web.app/products/${product._id}" 
           style="display: block; padding: 15px 25px; background: #007bff; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; box-shadow: 0 4px 6px rgba(0, 123, 255, 0.2);">
           View Product Details
        </a>
      </div>
    </div>

    <div style="background-color: #f7fafc; padding: 20px; text-align: center; border-top: 1px solid #edf2f7;">
      <p style="margin: 0; color: #718096; font-size: 14px;">&copy; 2026 Syeed Tech Point. All rights reserved.</p>
     <a href="${backendUrl}/api/unsubscribe/${s.unsubscribeToken}" style="color: #e53e3e; text-decoration: underline;">
  Unsubscribe from these alerts
</a>
    </div>
  </div>
</div>
`,
        };
        return transporter.sendMail(mailOptions);
      });

      // Emails ko background mein bhej dein, product add hone se mat rokein
      Promise.all(emailPromises)
        .then(() => console.log(`✅ Emails sent to ${subscribers.length} users`))
        .catch((e) => console.error("📧 Email sending failed:", e.message));
    }

    // 4. Send Response Immediately
    res.status(201).json(product);

  } catch (err) {
    console.error('❌ Failed to add product:', err);
    res.status(500).json({ 
      message: 'Failed to add product', 
      error: err.message 
    });
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

// ✅ TOGGLE WISHLIST (Add/Remove)
exports.toggleWishlist = async (req, res) => {
  try {
    const { productId } = req.params;
    const userId = req.user._id; // Auth middleware se user milega

    let wishlist = await Wishlist.findOne({ user: userId });

    if (!wishlist) {
      // Agar user ki wishlist exist nahi karti toh nayi banayein
      wishlist = new Wishlist({ user: userId, products: [productId] });
    } else {
      // Check karein ke product pehle se array mein hai ya nahi
      const index = wishlist.products.indexOf(productId);

      if (index > -1) {
        // Agar hai toh nikaal dein
        wishlist.products.splice(index, 1);
      } else {
        // Agar nahi hai toh add karein
        wishlist.products.push(productId);
      }
    }

    await wishlist.save();
    res.status(200).json({ 
      message: "Wishlist updated", 
      count: wishlist.products.length,
      wishlist: wishlist.products 
    });
  } catch (error) {
    console.error("Wishlist Toggle Error:", error);
    res.status(500).json({ message: "Server error while updating wishlist" });
  }
};


