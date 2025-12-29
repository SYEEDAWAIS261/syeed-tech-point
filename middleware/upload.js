const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const cloudinary = require("../config/cloudinary");

// Cloudinary storage config
const storage = new CloudinaryStorage({
  cloudinary,
  params: (req, file) => {
    let folder = "others";

    // Profile images
    if (req.baseUrl.includes("auth") || req.originalUrl.includes("profile")) {
      folder = "profile";
    }
    // Product images
    else if (req.baseUrl.includes("product")) {
      folder = "products";
    }

    return {
      folder: folder,
      allowed_formats: ["jpg", "jpeg", "png", "webp"],
      transformation: [{ quality: "auto", fetch_format: "auto" }],
    };
  },
});

// File filter
const fileFilter = (req, file, cb) => {
  const allowed = ["image/jpeg", "image/png", "image/jpg", "image/webp"];
  if (!allowed.includes(file.mimetype)) {
    return cb(new Error("Only image files are allowed"), false);
  }
  cb(null, true);
};

// Final multer instance
const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

module.exports = upload;
