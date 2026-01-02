// src/middleware/auth.js
const jwt = require("jsonwebtoken");
const { httpError } = require("../error");

const JWT_SECRET = process.env.JWT_SECRET || "DEV_SECRET_JANGAN_DIPAKE";
if (JWT_SECRET === "DEV_SECRET_JANGAN_DIPAKE") {
  console.warn("[auth] JWT_SECRET tidak diset. Gunakan production secret.");
}

const auth = (req, res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return res.status(401).json({ message: "Token tidak ditemukan" });
  
  try {
    const payload = jwt.verify(header.slice(7), JWT_SECRET);
    req.user = { id: payload.id, email: payload.email, role: payload.role };
    next();
  } catch {
    res.status(401).json({ message: "Token tidak valid" });
  }
};

const requireRole = (...allowedRoles) => (req, res, next) => {
  if (!req.user) return res.status(401).json({ message: "Unauthenticated" });
  if (!allowedRoles.includes(req.user.role)) return res.status(403).json({ message: "Forbidden" });
  next();
};

module.exports = { auth, requireRole };
