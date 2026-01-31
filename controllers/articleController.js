const Article = require('../models/Article');

// 1. Create Article
exports.createArticle = async (req, res) => {
  try {
    const { title, content, category } = req.body;
    
    // Unique Slug Generator
    let slug = title.toLowerCase().replace(/ /g, '-').replace(/[^\w-]+/g, '');
    const existing = await Article.findOne({ slug });
    if (existing) slug = `${slug}-${Date.now()}`;

    const newArticle = new Article({
      title,
      slug,
      content,
      category,
     image: req.file ? req.file.path : null
    });

    await newArticle.save();
    res.status(201).json({ success: true, article: newArticle });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// 2. Get All Articles (With Pagination & Category Filter)
exports.getAllArticles = async (req, res) => {
  try {
    const { page = 1, limit = 9, category } = req.query;
    const query = category ? { category } : {};

    const articles = await Article.find(query)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const count = await Article.countDocuments(query);

    res.json({
      articles,
      totalPages: Math.ceil(count / limit),
      currentPage: page
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getArticleById = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if the id is a valid MongoDB ObjectId format
    const isObjectId = id.match(/^[0-9a-fA-F]{24}$/);
    const query = isObjectId ? { _id: id } : { slug: id };

    const article = await Article.findOne(query);
    
    if (!article) return res.status(404).json({ message: "Article not found" });

    article.views += 1;
    await article.save();

    res.json(article);
  } catch (err) {
    res.status(500).json({ error: "Server Error" });
  }
};
// 4. Delete Article
exports.deleteArticle = async (req, res) => {
  try {
    await Article.findByIdAndDelete(req.params.id);
    res.json({ message: "Article deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};