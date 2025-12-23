// middleware/adminMiddleware.js
const jwt = require("jsonwebtoken");
const User = require("../models/User");

const adminMiddleware = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "No token provided" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Fetch user from DB
    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

    // Ensure they are admin
    if (!user.isAdmin) {
      return res.status(403).json({ message: "Access denied. Admin only." });
    }

    req.user = user;
    next(); // ✅ Proceed if admin
  } catch (err) {
    console.error("Admin token verification failed:", err);
    res.status(401).json({ message: "Invalid or expired token." });
  }
};

module.exports = adminMiddleware;
