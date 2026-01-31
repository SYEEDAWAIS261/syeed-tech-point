const Product = require("../models/Product");

const getGlobalTestimonials = async (req, res) => {
  try {
    const {
      sort = "top",        // top | latest | low
      featured = "false",  // true | false
      limit = 20,          // homepage ke liye 3–6
    } = req.query;

    // 🔹 Sorting logic
    let sortFn;
    if (sort === "latest") {
      sortFn = (a, b) => new Date(b.createdAt) - new Date(a.createdAt);
    } else if (sort === "low") {
      sortFn = (a, b) => a.rating - b.rating;
    } else {
      sortFn = (a, b) => b.rating - a.rating; // top rated
    }

    // 🔹 Get products with reviews
    const products = await Product.find(
      { "reviews.0": { $exists: true } },
      { name: 1, category: 1, reviews: 1 }
    );

    // 🔹 Flatten reviews
    let testimonials = products.flatMap(product =>
      product.reviews
        .filter(r => (featured === "true" ? r.isFeatured === true : true))
        .map(review => ({
          _id: review._id,
          name: review.name,
          rating: review.rating,
          comment: review.comment,
          images: review.images || [],
          createdAt: review.createdAt,
          productName: product.name,
          category: product.category,
          isFeatured: review.isFeatured || false,
        }))
    );

    // 🔹 Apply sorting
    testimonials.sort(sortFn);

    // 🔹 Limit results (Home page)
    testimonials = testimonials.slice(0, Number(limit));

    res.status(200).json({
      success: true,
      count: testimonials.length,
      testimonials,
    });
  } catch (error) {
    console.error("❌ Testimonials Error:", error);
    res.status(500).json({ message: "Failed to fetch testimonials" });
  }
};

module.exports = { getGlobalTestimonials };
