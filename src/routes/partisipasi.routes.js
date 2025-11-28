// src/routes/partisipasi.routes.js
const express = require("express");
const prisma = require("../lib/prisma");
const { httpError, parseId } = require("../error");
const { auth, requireRole } = require("../middleware/auth");

const router = express.Router();

function normalizeLinkDrive(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

// GET /api/partisipasi
router.get("/", auth, requireRole("admin","operator","peserta","juri"), async (req, res, next) => {
  try {
    const { eventId, pesertaId, juaraId } = req.query;
    const where = {};
    if (eventId) where.eventId = Number(eventId);
    if (pesertaId) where.pesertaId = Number(pesertaId);
    if (juaraId) where.juaraId = Number(juaraId);
    if (req.user.role === "peserta") {
      where.peserta = { userId: req.user.id };
    }

    const partisipasi = await prisma.partisipasi.findMany({
      where,
      orderBy: { id: "asc" },
      include: {
        event: true,
        peserta: true,
        juara: true,
      },
    });

    res.json(partisipasi);
  } catch (err) {
    next(err);
  }
});

// GET /api/partisipasi/:id
router.get("/:id", auth, requireRole("admin","operator","peserta","juri"), async (req, res, next) => {
  try {
    const id = parseId(req.params.id);

    const item = await prisma.partisipasi.findUnique({
      where: { id },
      include: {
        event: true,
        peserta: true,
        juara: true,
      },
    });

    if (!item) throw httpError(404, "Data partisipasi tidak ditemukan");

    res.json(item);
  } catch (err) {
    next(err);
  }
});

// POST /api/partisipasi
router.post("/", auth, requireRole("admin","operator"), async (req, res, next) => {
  try {
    const { pesertaId, eventId, juaraId, linkDrive } = req.body;

    if (!pesertaId || !eventId) {
      throw httpError(400, "pesertaId dan eventId wajib diisi");
    }

    const created = await prisma.partisipasi.create({
      data: {
        pesertaId,
        eventId,
        juaraId: juaraId ?? null,
        ...(linkDrive !== undefined
          ? { linkDrive: normalizeLinkDrive(linkDrive) }
          : {}),
      },
    });

    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
});

// PUT /api/partisipasi/:id
router.put("/:id", auth, requireRole("admin","operator","peserta"), async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    const { pesertaId, eventId, juaraId, linkDrive } = req.body;

    const existing = await prisma.partisipasi.findUnique({
      where: { id },
      include: {
        peserta: true,
      },
    });

    if (!existing) {
      throw httpError(404, "Data partisipasi tidak ditemukan");
    }

    if (
      req.user.role === "peserta" &&
      existing.peserta.userId !== req.user.id
    ) {
      throw httpError(403, "Tidak boleh mengubah partisipasi milik peserta lain");
    }

    const updates = {};

    if (req.user.role !== "peserta") {
      if (typeof pesertaId !== "undefined") {
        updates.pesertaId = pesertaId;
      }
      if (typeof eventId !== "undefined") {
        updates.eventId = eventId;
      }
      if (typeof juaraId !== "undefined") {
        updates.juaraId = juaraId ?? null;
      }
    }

    if (typeof linkDrive !== "undefined") {
      updates.linkDrive = normalizeLinkDrive(linkDrive);
    }

    if (!Object.keys(updates).length) {
      return res.json(existing);
    }

    const updated = await prisma.partisipasi.update({
      where: { id },
      data: updates,
    });

    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/partisipasi/:id
router.delete("/:id", auth, requireRole("admin","operator"), async (req, res, next) => {
  try {
    const id = parseId(req.params.id);

    await prisma.partisipasi.delete({
      where: { id },
    });

    res.json({ message: "Data partisipasi berhasil dihapus" });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
