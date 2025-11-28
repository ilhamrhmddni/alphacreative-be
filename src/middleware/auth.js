// src/middleware/auth.js
const jwt = require("jsonwebtoken");
const { httpError } = require("../error");

const JWT_SECRET = process.env.JWT_SECRET || "DEV_SECRET_JANGAN_DIPAKE";
if (JWT_SECRET === "DEV_SECRET_JANGAN_DIPAKE") {
  console.warn(
    "[auth] JWT_SECRET tidak diset. Menggunakan fallback default, segera set env JWT_SECRET untuk keamanan."
  );
}

function auth(req, res, next) {
  const header = req.headers.authorization;

  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Token tidak ditemukan" });
  }

  const token = header.split(" ")[1];

  try {
    const payload = jwt.verify(token, JWT_SECRET);

    req.user = {
      id: payload.id,
      email: payload.email,
      role: payload.role,
    };

    next();
  } catch (err) {
    return res.status(401).json({ message: "Token tidak valid" });
  }
}

// roles: "admin", "operator", "peserta", "juri"
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthenticated" });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ message: "Forbidden: role tidak diizinkan" });
    }

    next();
  };
}

module.exports = {
  auth,
  requireRole,
};
