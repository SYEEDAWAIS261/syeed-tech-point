const express = require('express');
const router = express.Router();
const multer = require('multer');
const { 
  createArticle, 
  getAllArticles, 
  getArticleById, 
  deleteArticle 
} = require('../controllers/articleController');

// Multer Setup
const storage = multer.diskStorage({
  destination: 'uploads/articles/',
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
});
const upload = multer({ storage });

// Public Routes
router.get('/', getAllArticles);
router.get('/:id', getArticleById); // Is line se 404 error solve hoga

// Admin Routes (Yahan aap apni admin middleware bhi laga sakte hain)
router.post('/', upload.single('image'), createArticle);
router.delete('/:id', deleteArticle);

module.exports = router;