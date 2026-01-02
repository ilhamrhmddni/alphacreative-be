// src/routes/auth.routes.js
const express = require("express");
const prisma = require("../lib/prisma");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { auth } = require("../middleware/auth");
const { httpError } = require("../error");

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || "DEV_SECRET_JANGAN_DIPAKE";
if (JWT_SECRET === "DEV_SECRET_JANGAN_DIPAKE") {
  console.warn(
    "[auth.routes] JWT_SECRET tidak diset. Menggunakan fallback default, segera set env JWT_SECRET untuk keamanan."
  );
}

// POST /api/auth/login
router.post("/login", async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      throw httpError(400, "Email dan password wajib diisi");
    }

    const user = await prisma.user.findUnique({
    where: { email },
    });

    if (!user) {
      throw httpError(401, "Email atau password salah");
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      throw httpError(401, "Email atau password salah");
    }

    const payload = {
      id: user.id,
      email: user.email,
      role: user.role,
    };

    const token = jwt.sign(payload, JWT_SECRET, {
      expiresIn: process.env.TOKEN_EXPIRES_IN || "1d",
    });

    const { password: _, ...userWithoutPassword } = user;

    res.json({
      token,
      user: userWithoutPassword,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/auth/me
router.get("/me", auth, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        email: true,
        username: true,
        role: true,
        isActive: true,
        nisnNta: true,
        alamat: true,
        profilePhotoPath: true,
        focusEventId: true,
        focusEvent: {
          select: {
            id: true,
            namaEvent: true,
          },
        },
      },
    });

    if (!user) {
      return res.status(404).json({ message: "User tidak ditemukan" });
    }

    res.json(user);
  } catch (err) {
    next(err);
  }
});

// PUT /api/auth/me → update profil sendiri
router.put("/me", auth, async (req, res, next) => {
  try {
    const { username, nisnNta, alamat, focusEventId, profilePhotoPath } = req.body;

    if (!username || typeof username !== "string" || !username.trim()) {
      throw httpError(400, "Nama pengguna wajib diisi");
    }

    if (username.trim().length < 3) {
      throw httpError(400, "Nama pengguna minimal 3 karakter");
    }

    const updatePayload = {
      username: username.trim(),
      nisnNta:
        typeof nisnNta === "string" && nisnNta.trim()
          ? nisnNta.trim()
          : null,
      alamat:
        typeof alamat === "string" && alamat.trim() ? alamat.trim() : null,
    };

    if (profilePhotoPath !== undefined) {
      updatePayload.profilePhotoPath =
        typeof profilePhotoPath === "string" && profilePhotoPath.trim()
          ? profilePhotoPath.trim()
          : null;
    }

    if (focusEventId !== undefined) {
      if (focusEventId === null || focusEventId === "") {
        updatePayload.focusEventId = null;
      } else {
        const parsedEventId = Number(focusEventId);
        if (Number.isNaN(parsedEventId)) {
          throw httpError(400, "focusEventId tidak valid");
        }
        const event = await prisma.event.findUnique({
          where: { id: parsedEventId },
          select: { id: true },
        });
        if (!event) {
          throw httpError(404, "Event fokus tidak ditemukan");
        }
        updatePayload.focusEventId = parsedEventId;
      }
    }

    const updated = await prisma.user.update({
      where: { id: req.user.id },
      data: updatePayload,
      select: {
        id: true,
        email: true,
        username: true,
        role: true,
        isActive: true,
        nisnNta: true,
        alamat: true,
        profilePhotoPath: true,
        focusEventId: true,
        focusEvent: {
          select: {
            id: true,
            namaEvent: true,
          },
        },
      },
    });

    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// PUT /api/auth/me/password → ubah password sendiri
async function updateOwnPassword(req, res, next) {
  try {
    const { newPassword } = req.body;

    if (!newPassword || typeof newPassword !== "string") {
      throw httpError(400, "Password baru wajib diisi");
    }

    if (newPassword.length < 8) {
      throw httpError(400, "Password baru minimal 8 karakter");
    }

    const hashed = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: req.user.id },
      data: { password: hashed },
    });

    res.json({ message: "Password berhasil diperbarui" });
  } catch (err) {
    next(err);
  }
}

router.put("/me/password", auth, updateOwnPassword);
router.patch("/me/password", auth, updateOwnPassword);

// POST /api/auth/register  → untuk peserta daftar sendiri
router.post("/register", async (req, res, next) => {
  try {
    const { email, username, password } = req.body;

    if (!email || !username || !password) {
      throw httpError(400, "email, username, password wajib diisi");
    }

    if (typeof email !== "string" || !email.includes("@")) {
      throw httpError(400, "Format email tidak valid");
    }

    const existing = await prisma.user.findUnique({
      where: { email },
    });

    if (existing) {
      throw httpError(400, "Email sudah terdaftar");
    }

    const hashed = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        email,
        username,
        password: hashed,
        role: "peserta",
        isActive: false, // penting: default NON-AKTIF
      },
      select: {
        id: true,
        email: true,
        username: true,
        role: true,
        isActive: true,
        nisnNta: true,
        alamat: true,
        profilePhotoPath: true,
      },
    });

    res.status(201).json({
      message: "Registrasi berhasil, menunggu aktivasi admin",
      user,
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/logout (dummy, FE hapus token)
router.post("/logout", (req, res) => {
  return res.json({
    message: "Logout berhasil. Hapus token di sisi FE.",
  });
});

module.exports = router;
