// src/routes/detailPeserta.routes.js
const express = require("express");
const prisma = require("../lib/prisma");
const { httpError, parseId } = require("../error");
const asyncHandler = require("../utils/async-handler");
const { parseOptionalPositiveInt } = require("../utils/parsers");
const { auth, requireRole } = require("../middleware/auth");

const router = express.Router();

async function getOperatorFocusEventId(userId) {
  const operator = await prisma.user.findUnique({
    where: { id: userId },
    select: { focusEventId: true },
  });

  if (!operator?.focusEventId) {
    throw httpError(400, "Operator belum memilih event fokus");
  }

  return operator.focusEventId;
}

// GET /api/detail-peserta
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const { pesertaId, eventId } = req.query;
    const where = {};
    const pesertaFilter = {};

    const parsedPesertaId = parseOptionalPositiveInt(pesertaId, "pesertaId");
    if (parsedPesertaId !== undefined) {
      where.pesertaId = parsedPesertaId;
    }

    const parsedEventId = parseOptionalPositiveInt(eventId, "eventId");
    if (parsedEventId !== undefined) {
      pesertaFilter.eventId = parsedEventId;
    }

    if (req.user.role === "peserta") {
      pesertaFilter.userId = req.user.id;
    }

    if (req.user.role === "operator") {
      const focusEventId = await getOperatorFocusEventId(req.user.id);
      if (parsedEventId !== undefined && parsedEventId !== focusEventId) {
        throw httpError(403, "Operator hanya boleh melihat peserta pada event fokusnya");
      }
      pesertaFilter.eventId = focusEventId;
    }

    if (Object.keys(pesertaFilter).length) {
      where.peserta = pesertaFilter;
    }

    const details = await prisma.detailPeserta.findMany({
      where,
      orderBy: { id: "asc" },
      include: {
        peserta: {
          include: {
            event: true,
            user: {
              select: { email: true },
            },
          },
        },
      },
    });

    res.json(details);
  })
);

// GET /api/detail-peserta/:id
router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);

    const detail = await prisma.detailPeserta.findUnique({
      where: { id },
      include: {
        peserta: {
          include: {
            event: true,
            user: { select: { email: true } },
          },
        },
      },
    });

    if (!detail) throw httpError(404, "Detail peserta tidak ditemukan");

    if (
      req.user.role === "peserta" &&
      detail.peserta.userId !== req.user.id
    ) {
      throw httpError(403, "Tidak boleh mengakses detail peserta orang lain");
    }

    if (req.user.role === "operator") {
      const focusEventId = await getOperatorFocusEventId(req.user.id);
      if (detail.peserta.eventId !== focusEventId) {
        throw httpError(403, "Tidak boleh mengakses peserta di event lain");
      }
    }

    res.json(detail);
  })
);

// POST /api/detail-peserta
router.post("/", auth, requireRole("admin", "operator", "peserta"), async (req, res, next) => {
  try {
    const { pesertaId, namaDetail, tanggalLahir, umur, nisnNta, alamat } = req.body;

    if (!pesertaId || !namaDetail) {
      throw httpError(400, "pesertaId dan namaDetail wajib diisi");
    }

    const peserta = await prisma.peserta.findUnique({
      where: { id: pesertaId },
    });

    if (!peserta) {
      throw httpError(404, "Peserta tidak ditemukan");
    }

    if (req.user.role === "peserta" && peserta.userId !== req.user.id) {
      throw httpError(403, "Tidak boleh menambah detail peserta orang lain");
    }

    const created = await prisma.detailPeserta.create({
      data: {
        pesertaId,
        namaDetail,
        tanggalLahir: tanggalLahir ? new Date(tanggalLahir) : null,
        umur: umur ?? null,
        nisnNta: nisnNta ?? null,
        alamat: alamat ?? null,
      },
    });

    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
});

// PUT /api/detail-peserta/:id
router.put("/:id", auth, requireRole("admin", "operator", "peserta"), async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    const { namaDetail, tanggalLahir, umur, nisnNta, alamat } = req.body;

    const detail = await prisma.detailPeserta.findUnique({
      where: { id },
      include: { peserta: true },
    });

    if (!detail) throw httpError(404, "Detail peserta tidak ditemukan");

    if (
      req.user.role === "peserta" &&
      detail.peserta.userId !== req.user.id
    ) {
      throw httpError(403, "Tidak boleh mengubah detail peserta orang lain");
    }

    const updated = await prisma.detailPeserta.update({
      where: { id },
      data: {
        namaDetail: namaDetail ?? detail.namaDetail,
        tanggalLahir: tanggalLahir
          ? new Date(tanggalLahir)
          : detail.tanggalLahir,
        umur: umur ?? detail.umur,
        nisnNta: nisnNta ?? detail.nisnNta,
        alamat: alamat ?? detail.alamat,
      },
    });

    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/detail-peserta/:id
router.delete("/:id", auth, requireRole("admin", "operator", "peserta"), async (req, res, next) => {
  try {
    const id = parseId(req.params.id);

    const detail = await prisma.detailPeserta.findUnique({
      where: { id },
      include: {
        peserta: true,
      },
    });

    if (!detail) {
      return res.status(404).json({ message: "Detail peserta tidak ditemukan" });
    }

    // kalau role peserta, cek kepemilikan
    if (req.user.role === "peserta" && detail.peserta.userId !== req.user.id) {
      return res.status(403).json({ message: "Tidak boleh hapus detail peserta orang lain" });
    }

    await prisma.detailPeserta.delete({ where: { id } });

    res.json({ message: "Detail peserta berhasil dihapus" });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
