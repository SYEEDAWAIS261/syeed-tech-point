const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

// Cloudinary Configuration (Yeh variables .env mein hone chahiye)
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Cloudinary Storage Setup
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    // Dynamic folder selection
    let folderName = 'general';
    if (req.baseUrl.includes('auth') || req.url.includes('profile')) {
      folderName = 'profile_pics';
    } else if (req.baseUrl.includes('product')) {
      folderName = 'products';
    } else if (req.baseUrl.includes('articles')) {
      folderName = 'articles';
    }

    return {
      folder: folderName,
      allowed_formats: ['jpg', 'png', 'jpeg', 'webp', 'gif'],
      public_id: `${Date.now()}-${file.originalname.split('.')[0]}`,
    };
  },
});

// Final Multer Instance
const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

module.exports = upload;