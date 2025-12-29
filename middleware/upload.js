const fs = require('fs');
const multer = require('multer');
const path = require('path');

// Helper to ensure a folder exists
const ensureDir = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

// Choose destination dynamically based on route
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let folder = 'uploads';

    // If uploading profile image
    if (req.baseUrl.includes('auth') || req.url.includes('profile')) {
      folder = 'uploads/profile';
    } else if (req.baseUrl.includes('product')) {
      folder = 'uploads/products';
    }

    const fullPath = path.join(__dirname, '..', folder);
    ensureDir(fullPath);
    cb(null, fullPath);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${file.originalname}`;
    cb(null, uniqueName);
  },
});

// Optional: filter to accept only image types
const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  const allowed = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
  if (!allowed.includes(ext)) {
    return cb(new Error('Only image files are allowed'), false);
  }
  cb(null, true);
};

// Final multer instance
const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB max
});

module.exports = upload;
