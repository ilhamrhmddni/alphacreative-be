const express = require("express");
const prisma = require("../lib/prisma");
const { auth, requireRole } = require("../middleware/auth");
const { httpError, parseId } = require("../error");

const router = express.Router();

function normalizeOrder(value, fallback = 0) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(-9999, Math.min(9999, Math.round(parsed)));
}

function normalizeBoolean(value, fallback = true) {
  if (value === undefined || value === null) return fallback;
  if (typeof value === "boolean") return value;
  const normalized = String(value).trim().toLowerCase();
  if (["true", "1", "yes", "on"].includes(normalized)) return true;
  if (["false", "0", "no", "off"].includes(normalized)) return false;
  return fallback;
}

function trimText(value) {
  if (value === undefined || value === null) return "";
  return String(value).trim();
}

router.get("/", auth, requireRole("admin", "operator"), async (req, res, next) => {
  try {
    const where = {};
    if (req.query.published !== undefined) {
      where.isPublished = normalizeBoolean(req.query.published, true);
    }

    const items = await prisma.galleryItem.findMany({
      where,
      orderBy: [{ order: "asc" }, { createdAt: "desc" }],
    });

    res.json(items);
  } catch (err) {
    next(err);
  }
});

router.post("/", auth, requireRole("admin", "operator"), async (req, res, next) => {
  try {
    const { title, caption, photoPath, order, isPublished } = req.body || {};

    const normalizedTitle = trimText(title);
    if (!normalizedTitle) {
      throw httpError(400, "Judul wajib diisi");
    }
    if (!photoPath || typeof photoPath !== "string") {
      throw httpError(400, "Foto galeri wajib diunggah");
    }

    const payload = await prisma.galleryItem.create({
      data: {
        title: normalizedTitle,
        caption: trimText(caption) || null,
        photoPath,
        order: normalizeOrder(order, 0),
        isPublished: normalizeBoolean(isPublished, true),
        createdBy: req.user?.id || null,
        updatedBy: req.user?.id || null,
      },
    });

    res.status(201).json(payload);
  } catch (err) {
    next(err);
  }
});

router.put("/:id", auth, requireRole("admin", "operator"), async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    const { title, caption, photoPath, order, isPublished } = req.body || {};

    const data = {};
    if (title !== undefined) {
      const normalized = trimText(title);
      if (!normalized) {
        throw httpError(400, "Judul wajib diisi");
      }
      data.title = normalized;
    }
    if (caption !== undefined) {
      const normalizedCaption = trimText(caption);
      data.caption = normalizedCaption ? normalizedCaption : null;
    }
    if (photoPath !== undefined) {
      if (!photoPath || typeof photoPath !== "string") {
        throw httpError(400, "Foto galeri wajib diunggah");
      }
      data.photoPath = photoPath;
    }
    if (order !== undefined) {
      data.order = normalizeOrder(order, 0);
    }
    if (isPublished !== undefined) {
      data.isPublished = normalizeBoolean(isPublished, true);
    }

    if (Object.keys(data).length === 0) {
      throw httpError(400, "Tidak ada perubahan yang dikirim");
    }

    data.updatedBy = req.user?.id || null;

    const updated = await prisma.galleryItem.update({
      where: { id },
      data,
    });

    res.json(updated);
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", auth, requireRole("admin", "operator"), async (req, res, next) => {
  try {
    const id = parseId(req.params.id);

    await prisma.galleryItem.delete({ where: { id } });

    res.json({ message: "Item galeri dihapus" });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
