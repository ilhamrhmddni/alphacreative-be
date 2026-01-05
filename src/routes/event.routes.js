// src/routes/event.routes.js
const express = require("express");

const prisma = require("../lib/prisma");
const { auth, requireRole } = require("../middleware/auth");
const { httpError, parseId } = require("../error");
const asyncHandler = require("../utils/async-handler");

const router = express.Router();

function normalizeNullableNumber(value, fieldName, { allowUndefined = false } = {}) {
  if (value === undefined) {
    return allowUndefined ? undefined : null;
  }
  if (value === "" || value === null) {
    return null;
  }
  const parsed = Number(value);
  if (Number.isNaN(parsed)) {
    throw httpError(400, `${fieldName} harus berupa angka`);
  }
  return parsed;
}

function ensureValidDate(value, fieldName, { allowUndefined = false } = {}) {
  if (value === undefined) {
    if (allowUndefined) return undefined;
    throw httpError(400, `${fieldName} wajib diisi`);
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw httpError(400, `${fieldName} tidak valid`);
  }
  return date;
}

// GET /api/events
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const events = await prisma.event.findMany({
      orderBy: { id: "desc" },
      include: {
        categories: {
          orderBy: { name: "asc" },
          include: {
            _count: {
              select: { peserta: true },
            },
          },
        },
      },
    });
    res.json(events);
  })
);

// GET /api/events/:id
router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);

    const event = await prisma.event.findUnique({
      where: { id },
      include: {
        categories: {
          orderBy: { name: "asc" },
          include: {
            _count: {
              select: { peserta: true },
            },
          },
        },
      },
    });

    if (!event) {
      throw httpError(404, "Event tidak ditemukan");
    }

    res.json(event);
  })
);

// POST /api/events  -> admin & operator
router.post(
  "/",
  auth,
  requireRole("admin", "operator"),
  asyncHandler(async (req, res) => {
    const {
      namaEvent,
      deskripsiEvent,
      tanggalEvent,
      tempatEvent,
      venue,
      status,
      photoPath,
      kuota,
      biaya,
      linkPeraturan,
    } = req.body;

    if (!namaEvent || !tanggalEvent || !tempatEvent) {
      throw httpError(400, "namaEvent, tanggalEvent, dan tempatEvent wajib diisi");
    }

    const parsedKuota = normalizeNullableNumber(kuota, "kuota");
    const parsedBiaya = normalizeNullableNumber(biaya, "biaya");
    const tanggal = ensureValidDate(tanggalEvent, "tanggalEvent");

    const created = await prisma.event.create({
      data: {
        namaEvent,
        deskripsiEvent: deskripsiEvent || null,
        tempatEvent,
        venue: venue || null,
        status: status || null,
        photoPath: photoPath || null,
        kuota: parsedKuota,
        biaya: parsedBiaya,
        tanggalEvent: tanggal,
        linkPeraturan: linkPeraturan || null,
      },
    });

    res.status(201).json(created);
  })
);

// PUT /api/events/:id  -> admin & operator
router.put(
  "/:id",
  auth,
  requireRole("admin", "operator"),
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    const {
      namaEvent,
      deskripsiEvent,
      tanggalEvent,
      tempatEvent,
      venue,
      status,
      photoPath,
      kuota,
      biaya,
      linkPeraturan,
    } = req.body;

    const parsedKuota = normalizeNullableNumber(kuota, "kuota", { allowUndefined: true });
    const parsedBiaya = normalizeNullableNumber(biaya, "biaya", { allowUndefined: true });
    const tanggal = ensureValidDate(tanggalEvent, "tanggalEvent", { allowUndefined: true });

    const updated = await prisma.event.update({
      where: { id },
      data: {
        ...(namaEvent !== undefined ? { namaEvent } : {}),
        ...(deskripsiEvent !== undefined ? { deskripsiEvent: deskripsiEvent || null } : {}),
        ...(tempatEvent !== undefined ? { tempatEvent } : {}),
        ...(venue !== undefined ? { venue: venue || null } : {}),
        ...(status !== undefined ? { status: status || null } : {}),
        ...(photoPath !== undefined ? { photoPath: photoPath || null } : {}),
        ...(parsedKuota !== undefined ? { kuota: parsedKuota } : {}),
        ...(parsedBiaya !== undefined ? { biaya: parsedBiaya } : {}),
        ...(tanggal !== undefined ? { tanggalEvent: tanggal } : {}),
        ...(linkPeraturan !== undefined ? { linkPeraturan: linkPeraturan || null } : {}),
      },
    });

    res.json(updated);
  })
);

// DELETE /api/events/:id -> admin & operator
router.delete(
  "/:id",
  auth,
  requireRole("admin", "operator"),
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);

    await prisma.event.delete({
      where: { id },
    });

    res.json({ success: true });
  })
);

// POST /api/events/:id/feature -> set this event as featured (admin only)
router.post(
  "/:id/feature",
  auth,
  requireRole("admin"),
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);

    await prisma.$transaction([
      prisma.event.updateMany({ where: { isFeatured: true }, data: { isFeatured: false } }),
      prisma.event.update({ where: { id }, data: { isFeatured: true } }),
    ]);

    res.json({ success: true });
  })
);

module.exports = router;
