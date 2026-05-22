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
      name, brand, description, price, category,
      condition, processor, ram, storage, display,
      quantity, discountPercentage, discountPrice,
      faqs, specifications,variations, keyFeatures,
      isBannerProduct, bannerTitle, expiryDate
    } = req.body;

    // logic: Agar ye product banner hai, toh baaki sab ko false kar do
    if (isBannerProduct === 'true' || isBannerProduct === true) {
      await Product.updateMany({}, { isBannerProduct: false });
    }

    const imagePaths = req.files
      ? req.files.map((file) => `/uploads/products/${file.filename}`)
      : [];

      // 🆕 Key Features Parsing
    let parsedKeyFeatures = [];
    try {
      parsedKeyFeatures = typeof keyFeatures === 'string' ? JSON.parse(keyFeatures) : keyFeatures;
    } catch (e) {
      console.error("Key Features parsing failed");
    }
    // Safe JSON Parsing for Specifications
    let parsedSpecs = [];
    try {
      
      parsedSpecs = typeof specifications === 'string' ? JSON.parse(specifications) : specifications;
    } catch (e) {
      console.error("Specs parsing failed, using empty array");
    }

    let parsedFaqs = [];
    try {
      parsedFaqs = typeof faqs === 'string' ? JSON.parse(faqs) : faqs;
    } catch (e) {
      console.error("FAQ parsing failed, using empty array");
    }

    let parsedVariations = [];
    try {
      parsedVariations = typeof variations === 'string' ? JSON.parse(variations) : variations;
    } catch (e) {
      console.error("Variations parsing failed, using empty array");
    }

    const product = new Product({
      name,
      brand,
      description,
      price,
      category,
      condition: condition || 'new',
      image: imagePaths[0] || '',
      images: imagePaths,
      processor,
      ram,
      storage,
      display,
      quantity: Number(quantity) || 0,
      discountPercentage: discountPercentage || 0,
      discountPrice: discountPrice || null,
      specifications: parsedSpecs, // ✅ Database mein save ho raha hai
      faqs: parsedFaqs,
      variations: parsedVariations,
      keyFeatures: parsedKeyFeatures,
      isBannerProduct: isBannerProduct === 'true' || isBannerProduct === true,
      bannerTitle: bannerTitle || '',
      expiryDate: expiryDate || null
    });

    await product.save();

    // 3. Notify Subscribers
    const subscribers = await Subscriber.find();

    if (subscribers.length > 0) {
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.SMTP_EMAIL,
          pass: process.env.SMTP_PASS,
        },
      });

      // ✅ Email ke liye Table Rows taiyar karna
      const specRows = parsedSpecs.map(s => `
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #eee; color: #555;"><b>${s.label}</b></td>
          <td style="padding: 8px; border-bottom: 1px solid #eee; color: #777;">${s.value}</td>
        </tr>
      `).join('');

      const emailPromises = subscribers.map((s) => {
        const mailOptions = {
          from: `"Al Syed Tech" <${process.env.SMTP_EMAIL}>`,
          to: s.email,
          subject: `🆕 New Arrival: ${product.name}`,
          html: `
            <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: auto; border: 1px solid #e0e0e0; border-radius: 10px; overflow: hidden;">
              <div style="background-color: #007bffd7; color: white; padding: 20px; text-align: center;">
                <h1 style="margin: 0;">New Product Launch!</h1>
              </div>
              
              <div style="padding: 25px;">
                <h2 style="color: #333; margin-top: 0;">${product.name}</h2>
                
                <p style="color: #666; line-height: 1.6; font-size: 15px;">
                  ${description}
                </p>
                <h3 style="border-bottom: 2px solid #007bffe7; padding-bottom: 5px; color: #333;">Product Details</h3>
                // <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
                //   <tr>
                //     <td style="padding: 8px; border-bottom: 1px solid #eee; color: #555;"><b>Brand</b></td>
                //     <td style="padding: 8px; border-bottom: 1px solid #eee; color: #777;">${brand}</td>
                //   </tr>
                //   <tr>
                //     <td style="padding: 8px; border-bottom: 1px solid #eee; color: #555;"><b>Processor</b></td>
                //     <td style="padding: 8px; border-bottom: 1px solid #eee; color: #777;">${processor}</td>
                //   </tr>
                //   ${specRows} </table>

                <div style="text-align: center; margin-top: 30px;">
                   <p style="font-size: 20px; color: #28a745; font-weight: bold;">Special Price: $${price}</p>
                   <a href="${process.env.CLIENT_URL}/products/${product._id}" 
                      style="display:inline-block; padding:15px 30px; background:#007bff; color:#fff; text-decoration:none; border-radius:50px; font-weight: bold;">
                      Check it Out
                   </a>
                </div>
              </div>
            </div>
          `,
        };
        return transporter.sendMail(mailOptions);
      });

      Promise.all(emailPromises)
        .then(() => console.log(`✅ Emails sent`))
        .catch((e) => console.error("📧 Email failed:", e.message));
    }

    res.status(201).json(product);

  } catch (err) {
    console.error('❌ Failed:', err);
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

// ✅ UPDATE PRODUCT (Updated with Specifications, FAQ, Variations & KeyFeatures)
exports.updateProduct = async (req, res) => {
  try {
    const updateData = { ...req.body };

    // 🚀 NEW: Safe Parsing for KeyFeatures (Bullet Points)
    if (updateData.keyFeatures) {
      if (typeof updateData.keyFeatures === 'string') {
        // [object Object] error check jo aksar FormData mein aata hai
        if (updateData.keyFeatures.startsWith('[object')) {
          delete updateData.keyFeatures; 
        } else {
          try {
            updateData.keyFeatures = JSON.parse(updateData.keyFeatures);
          } catch (e) {
            console.error("KeyFeatures parse error:", e);
            delete updateData.keyFeatures;
          }
        }
      }
    }

    // 1. Safe Parsing for Specifications (Table Data)
    if (updateData.specifications) {
      if (typeof updateData.specifications === 'string') {
        if (updateData.specifications.startsWith('[object')) {
          delete updateData.specifications; 
        } else {
          try {
            updateData.specifications = JSON.parse(updateData.specifications);
          } catch (e) {
            console.error("Spec parse error:", e);
            delete updateData.specifications;
          }
        }
      }
    }

    // 🚀 Safe Parsing for FAQs
    if (updateData.faqs) {
      if (typeof updateData.faqs === 'string') {
        if (updateData.faqs.startsWith('[object')) {
          delete updateData.faqs; 
        } else {
          try {
            updateData.faqs = JSON.parse(updateData.faqs);
          } catch (e) {
            console.error("FAQ parse error:", e);
            delete updateData.faqs;
          }
        }
      }
    }

    // 🚀 Safe Parsing for Variations
    if (updateData.variations) {
      if (typeof updateData.variations === 'string') {
        if (updateData.variations.startsWith('[object')) {
          delete updateData.variations; 
        } else {
          try {
            updateData.variations = JSON.parse(updateData.variations);
          } catch (e) {
            console.error("Variations parse error:", e);
            delete updateData.variations;
          }
        }
      }
    }

    // 2. Handle quantity properly
    if (updateData.quantity !== undefined) {
      updateData.quantity = Number(updateData.quantity);
      if (isNaN(updateData.quantity) || updateData.quantity < 0) updateData.quantity = 0;
    }

    
   if (updateData.condition) {
    updateData.condition = updateData.condition.toLowerCase();
}

    // 3. Handle uploaded images (Gallery update)
    if (req.files && req.files.length > 0) {
      const imagePaths = req.files.map((file) => `/uploads/products/${file.filename}`);
      updateData.image = imagePaths[0]; // Main image
      updateData.images = imagePaths;   // Full gallery
    }

    // 4. Update in Database
    const product = await Product.findByIdAndUpdate(
      req.params.id, 
      updateData, 
      { new: true, runValidators: true }
    );

    if (!product) return res.status(404).json({ message: 'Product not found' });

    res.json(product);
  } catch (err) {
    console.error('❌ Error updating product:', err);
    res.status(500).json({ 
      message: 'Error updating product', 
      error: err.message 
    });
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

/// ✅ GET LIMITED PRODUCTS (Updated Logic)
exports.getLimitedProducts = async (req, res) => {
  try {
    // Database se wo products pehle uthaein jin ka discountPercentage 0 se zyada ho
    // .sort({ discountPercentage: -1 }) se zyada discount wale pehle aayenge
    const products = await Product.find()
      .sort({ discountPercentage: -1 }) 
      .limit(10); 
      
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


