// src/routes/eventCategory.routes.js
const express = require("express");
const { Prisma } = require("@prisma/client");

const prisma = require("../lib/prisma");
const { auth, requireRole } = require("../middleware/auth");
const { httpError, parseId } = require("../error");
const asyncHandler = require("../utils/async-handler");
const {
  parsePositiveInt,
  parseOptionalPositiveInt,
  parseNullableNumber,
} = require("../utils/parsers");

const router = express.Router();


function normalizeText(value, fieldName) {
  if (value === undefined || value === null) {
    return "";
  }
  const normalized = String(value).trim();
  if (!normalized) {
    throw httpError(400, `${fieldName} wajib diisi`);
  }
  return normalized;
}

async function requireOperatorFocusEventId(userId) {
  const operator = await prisma.user.findUnique({
    where: { id: userId },
    select: { focusEventId: true },
  });

  if (!operator?.focusEventId) {
    throw httpError(400, "Operator belum memilih event fokus");
  }

  return operator.focusEventId;
}

async function ensureOperatorCanManage(req, eventId) {
  if (!req.user || req.user.role !== "operator") {
    return;
  }
  const focusEventId = await requireOperatorFocusEventId(req.user.id);
  if (focusEventId !== eventId) {
    throw httpError(403, "Operator hanya boleh mengelola kategori untuk event fokus");
  }
}

// GET /api/event-categories
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const eventId = parseOptionalPositiveInt(req.query.eventId, "eventId");
    const where = {};
    if (eventId !== undefined) {
      where.eventId = eventId;
    }

    const categories = await prisma.eventCategory.findMany({
      where,
      orderBy: { name: "asc" },
      include: {
        event: {
          select: {
            id: true,
            namaEvent: true,
          },
        },
        _count: { select: { peserta: true } },
      },
    });

    res.json(categories);
  })
);

// POST /api/event-categories
router.post(
  "/",
  auth,
  requireRole("admin", "operator"),
  asyncHandler(async (req, res) => {
    const { eventId, name, description, quota } = req.body;

    const parsedEventId = parsePositiveInt(eventId, "eventId");
    const event = await prisma.event.findUnique({ where: { id: parsedEventId } });
    if (!event) {
      throw httpError(404, "Event tidak ditemukan");
    }

    await ensureOperatorCanManage(req, parsedEventId);

    const categoryName = normalizeText(name, "Nama kategori");
    const parsedQuota = parseNullableNumber(quota, "quota", { allowUndefined: true });

    try {
      const created = await prisma.eventCategory.create({
        data: {
          eventId: parsedEventId,
          name: categoryName,
          description: description ? String(description).trim() || null : null,
          quota: parsedQuota ?? null,
          createdBy: req.user?.id || null,
          updatedBy: req.user?.id || null,
        },
      });

      res.status(201).json(created);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        throw httpError(409, "Kategori dengan nama tersebut sudah ada untuk event ini");
      }
      throw err;
    }
  })
);

// PUT /api/event-categories/:id
router.put(
  "/:id",
  auth,
  requireRole("admin", "operator"),
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    const { name, description, quota } = req.body;

    const existing = await prisma.eventCategory.findUnique({
      where: { id },
      select: { eventId: true },
    });

    if (!existing) {
      throw httpError(404, "Kategori event tidak ditemukan");
    }

    await ensureOperatorCanManage(req, existing.eventId);

    const payload = {};
    if (name !== undefined) {
      payload.name = normalizeText(name, "Nama kategori");
    }
    if (description !== undefined) {
      payload.description = description ? String(description).trim() || null : null;
    }
    if (quota !== undefined) {
      payload.quota = parseNullableNumber(quota, "quota", { allowUndefined: false });
    }

    if (!Object.keys(payload).length) {
      return res.json(await prisma.eventCategory.findUnique({ where: { id } }));
    }

    try {
      const updated = await prisma.eventCategory.update({
        where: { id },
        data: {
          ...payload,
          updatedBy: req.user?.id || null,
        },
      });

      res.json(updated);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        throw httpError(409, "Kategori dengan nama tersebut sudah ada untuk event ini");
      }
      throw err;
    }
  })
);

// DELETE /api/event-categories/:id
router.delete(
  "/:id",
  auth,
  requireRole("admin", "operator"),
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);

    const existing = await prisma.eventCategory.findUnique({
      where: { id },
      select: { eventId: true },
    });

    if (!existing) {
      throw httpError(404, "Kategori event tidak ditemukan");
    }

    await ensureOperatorCanManage(req, existing.eventId);

    try {
      await prisma.eventCategory.delete({ where: { id } });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2003") {
        throw httpError(400, "Kategori tidak bisa dihapus karena masih digunakan oleh peserta");
      }
      throw err;
    }

    res.json({ success: true });
  })
);

module.exports = router;
