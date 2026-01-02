const express = require("express");
const prisma = require("../lib/prisma");
const { auth, requireRole } = require("../middleware/auth");
const { httpError, parseId } = require("../error");

const router = express.Router();

const ALLOWED_TYPES = new Set(["collaboration", "sponsorship"]);

function normalizeType(value) {
  if (!value) return null;
  const normalized = String(value).trim().toLowerCase();
  if (!ALLOWED_TYPES.has(normalized)) {
    throw httpError(400, "Tipe partnership tidak valid");
  }
  return normalized;
}

function normalizeText(value, { required = false } = {}) {
  if (value === undefined || value === null) {
    if (required) {
      throw httpError(400, "Field wajib diisi");
    }
    return null;
  }
  const normalized = String(value).trim();
  if (required && !normalized) {
    throw httpError(400, "Field wajib diisi");
  }
  return normalized || null;
}

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

router.get(
  "/",
  auth,
  requireRole("admin", "operator"),
  async (req, res, next) => {
    try {
      const where = {};
      if (req.query.type) {
        where.type = normalizeType(req.query.type);
      }
      if (req.query.published !== undefined) {
        where.isPublished = normalizeBoolean(req.query.published, true);
      }
      const search = req.query.search ? String(req.query.search).trim() : "";
      if (search) {
        where.OR = [
          { name: { contains: search, mode: "insensitive" } },
          { role: { contains: search, mode: "insensitive" } },
          { description: { contains: search, mode: "insensitive" } },
        ];
      }

      const items = await prisma.partnership.findMany({
        where,
        orderBy: [{ order: "asc" }, { createdAt: "desc" }],
      });

      res.json(items);
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  "/",
  auth,
  requireRole("admin", "operator"),
  async (req, res, next) => {
    try {
      const {
        name,
        role,
        description,
        logoPath,
        type,
        order,
        isPublished,
      } = req.body || {};

      const normalizedType = normalizeType(type);
      const normalizedName = normalizeText(name, { required: true });

      const payload = await prisma.partnership.create({
        data: {
          name: normalizedName,
          role: normalizeText(role),
          description: normalizeText(description),
          logoPath: normalizeText(logoPath),
          type: normalizedType,
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
  }
);

router.put(
  "/:id",
  auth,
  requireRole("admin", "operator"),
  async (req, res, next) => {
    try {
      const id = parseId(req.params.id);
      const {
        name,
        role,
        description,
        logoPath,
        type,
        order,
        isPublished,
      } = req.body || {};

      const data = {};
      if (name !== undefined) {
        data.name = normalizeText(name, { required: true });
      }
      if (role !== undefined) {
        data.role = normalizeText(role);
      }
      if (description !== undefined) {
        data.description = normalizeText(description);
      }
      if (logoPath !== undefined) {
        const normalizedLogo = normalizeText(logoPath);
        if (!normalizedLogo) {
          throw httpError(400, "Logo wajib diisi. Unggah atau pilih logo terlebih dahulu");
        }
        data.logoPath = normalizedLogo;
      }
      if (type !== undefined) {
        data.type = normalizeType(type);
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

      const updated = await prisma.partnership.update({
        where: { id },
        data,
      });

      res.json(updated);
    } catch (err) {
      next(err);
    }
  }
);

router.delete(
  "/:id",
  auth,
  requireRole("admin", "operator"),
  async (req, res, next) => {
    try {
      const id = parseId(req.params.id);
      await prisma.partnership.delete({ where: { id } });
      res.json({ message: "Partnership dihapus" });
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
