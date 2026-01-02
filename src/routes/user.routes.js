// src/routes/user.routes.js
const express = require("express");
const prisma = require("../lib/prisma");
const bcrypt = require("bcrypt");
const { httpError, parseId } = require("../error");

const router = express.Router();

async function fetchUserOrThrow(id) {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) {
    throw httpError(404, "User tidak ditemukan");
  }
  return user;
}

function operatorCanManageRole(role) {
  return role === "juri";
}

function ensureOperatorCanModify(req, targetUser) {
  if (req.user.role !== "operator") return;
  if (!operatorCanManageRole(targetUser.role)) {
    throw httpError(403, "Operator hanya boleh mengelola user juri");
  }
}

router.get("/", async (req, res, next) => {
  try {
    const { role } = req.query;

    const where = {};
    if (role) where.role = role;

    const users = await prisma.user.findMany({
      where,
      orderBy: { id: "asc" },
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

    res.json(users);
  } catch (err) {
    next(err);
  }
});

// GET /api/users/:id
router.get("/:id", async (req, res, next) => {
  try {
    const id = parseId(req.params.id);

    const user = await prisma.user.findUnique({
      where: { id },
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
      throw httpError(404, "User tidak ditemukan");
    }

    res.json(user);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/users/:id/activate
router.patch("/:id/activate", async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    const target = await fetchUserOrThrow(id);
    ensureOperatorCanModify(req, target);

    const updated = await prisma.user.update({
      where: { id },
      data: { isActive: true },
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
          select: { id: true, namaEvent: true },
        },
      },
    });

    res.json({
      message: "User berhasil diaktifkan",
      user: updated,
    });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/users/:id/deactivate
router.patch("/:id/deactivate", async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    const target = await fetchUserOrThrow(id);
    ensureOperatorCanModify(req, target);

    const updated = await prisma.user.update({
      where: { id },
      data: { isActive: false },
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
          select: { id: true, namaEvent: true },
        },
      },
    });

    res.json({
      message: "User berhasil dinonaktifkan",
      user: updated,
    });
  } catch (err) {
    next(err);
  }
});

const DEFAULT_RESET_PASSWORD = "12345678";

async function resetPasswordHandler(req, res, next) {
  try {
    const id = parseId(req.params.id);
    const target = await fetchUserOrThrow(id);
    ensureOperatorCanModify(req, target);
    const hashedPassword = await bcrypt.hash(DEFAULT_RESET_PASSWORD, 10);

    await prisma.user.update({
      where: { id },
      data: { password: hashedPassword },
    });

    res.json({
      message: "Password berhasil direset ke default.",
    });
  } catch (err) {
    next(err);
  }
}

// PATCH /api/users/:id/reset-password
router.patch("/:id/reset-password", resetPasswordHandler);
// PUT /api/users/:id/reset-password (fallback)
router.put("/:id/reset-password", resetPasswordHandler);

// POST /api/users (admin membuat user)
router.post("/", async (req, res, next) => {
  try {
    const { email, username, password, role, isActive, nisnNta, alamat, focusEventId } = req.body;

    if (!email || !username || !password || !role) {
      throw httpError(400, "email, username, password, role wajib diisi");
    }

    if (req.user.role === "operator" && !operatorCanManageRole(role)) {
      throw httpError(403, "Operator hanya boleh menambah user juri");
    }

    if (typeof email !== "string" || !email.includes("@")) {
      throw httpError(400, "Format email tidak valid");
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    let normalizedFocusEventId = null;
    if (focusEventId !== undefined && focusEventId !== null && focusEventId !== "") {
      const parsedEventId = Number(focusEventId);
      if (Number.isNaN(parsedEventId)) {
        throw httpError(400, "focusEventId tidak valid");
      }
      const event = await prisma.event.findUnique({ where: { id: parsedEventId } });
      if (!event) {
        throw httpError(404, "Event fokus tidak ditemukan");
      }
      normalizedFocusEventId = parsedEventId;
    }

    const newUser = await prisma.user.create({
      data: {
        email,
        username,
        password: hashedPassword,
        role,
        isActive: typeof isActive === "boolean" ? isActive : true,
        nisnNta: nisnNta ?? null,
        alamat: alamat ?? null,
        focusEventId: normalizedFocusEventId,
        profilePhotoPath:
          typeof req.body.profilePhotoPath === "string" && req.body.profilePhotoPath.trim()
            ? req.body.profilePhotoPath.trim()
            : null,
      },
    });

    const { password: _, ...userWithoutPassword } = newUser;

    res.status(201).json(userWithoutPassword);
  } catch (err) {
    next(err);
  }
});

// PUT /api/users/:id
router.put("/:id", async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    const { email, username, role, isActive, nisnNta, alamat, focusEventId, profilePhotoPath } = req.body;

    if (
      email === undefined &&
      username === undefined &&
      role === undefined &&
      isActive === undefined &&
      nisnNta === undefined &&
      alamat === undefined &&
      focusEventId === undefined
    ) {
      throw httpError(400, "Tidak ada field yang diupdate");
    }

    const target = await fetchUserOrThrow(id);
    ensureOperatorCanModify(req, target);

    const data = {
      email,
      username,
      role,
      isActive,
      nisnNta,
      alamat,
    };

    if (profilePhotoPath !== undefined) {
      data.profilePhotoPath =
        typeof profilePhotoPath === "string" && profilePhotoPath.trim()
          ? profilePhotoPath.trim()
          : null;
    }

    if (req.user.role === "operator" && !operatorCanManageRole(role ?? target.role)) {
      throw httpError(403, "Operator hanya boleh mengelola user juri");
    }

    if (focusEventId !== undefined) {
      if (focusEventId === null || focusEventId === "") {
        data.focusEventId = null;
      } else {
        const parsedEventId = Number(focusEventId);
        if (Number.isNaN(parsedEventId)) {
          throw httpError(400, "focusEventId tidak valid");
        }
        const event = await prisma.event.findUnique({
          where: { id: parsedEventId },
        });
        if (!event) {
          throw httpError(404, "Event fokus tidak ditemukan");
        }
        data.focusEventId = parsedEventId;
      }
    }

    const updated = await prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        email: true,
        username: true,
        role: true,
        isActive: true,
        nisnNta: true,
        alamat: true,
        focusEventId: true,
        focusEvent: {
          select: { id: true, namaEvent: true },
        },
      },
    });

    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/users/:id
router.delete("/:id", async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    const target = await fetchUserOrThrow(id);
    ensureOperatorCanModify(req, target);

    await prisma.user.delete({
      where: { id },
    });

    res.json({ message: "User berhasil dihapus" });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
