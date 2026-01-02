// src/routes/peserta.routes.js
const express = require("express");
const prisma = require("../lib/prisma");
const { httpError, parseId } = require("../error");
const asyncHandler = require("../utils/async-handler");
const {
  parsePositiveInt,
  parseOptionalPositiveInt,
} = require("../utils/parsers");

const router = express.Router();
const ALLOWED_PESERTA_STATUS = [
  "pending",
  "approved",
  "rejected",
  "unregistered",
];

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

async function ensureOperatorCanAccessPeserta(req, peserta) {
  if (req.user.role !== "operator") return;
  const focusEventId = await requireOperatorFocusEventId(req.user.id);
  if (peserta.eventId !== focusEventId) {
    throw httpError(403, "Operator hanya boleh mengelola peserta di event fokus");
  }
}

async function getJuriEventIds(userId) {
  const events = await prisma.score.findMany({
    where: { juriId: userId },
    select: { eventId: true },
    distinct: ["eventId"],
  });
  return events
    .map((item) => item.eventId)
    .filter((id) => typeof id === "number" && id > 0);
}

async function resolveEventCategorySelection(eventId, categoryId) {
  const categories = await prisma.eventCategory.findMany({
    where: { eventId },
    select: { id: true },
  });

  if (!categories.length) {
    if (categoryId === undefined || categoryId === null || categoryId === "") {
      return null;
    }

    const parsedCategoryId = parsePositiveInt(categoryId, "eventCategoryId");
    const category = await prisma.eventCategory.findUnique({
      where: { id: parsedCategoryId },
      select: { eventId: true },
    });

    if (!category || category.eventId !== eventId) {
      throw httpError(400, "Kategori event tidak valid untuk event yang dipilih");
    }

    return parsedCategoryId;
  }

  if (categoryId === undefined || categoryId === null || categoryId === "") {
    throw httpError(400, "Pilih kategori event sebelum mendaftar");
  }

  const parsedCategoryId = parsePositiveInt(categoryId, "eventCategoryId");
  const belongs = categories.some((category) => category.id === parsedCategoryId);

  if (!belongs) {
    throw httpError(400, "Kategori event tidak valid untuk event yang dipilih");
  }

  return parsedCategoryId;
}

// GET /api/peserta
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const { eventId, status } = req.query;
    const where = {};

    let eventFilter = parseOptionalPositiveInt(eventId, "eventId");

    if (req.user.role === "peserta") {
      where.userId = req.user.id;
    }

    if (req.user.role === "operator") {
      const focusEventId = await requireOperatorFocusEventId(req.user.id);
      if (eventFilter !== undefined && eventFilter !== focusEventId) {
        throw httpError(403, "Operator hanya boleh melihat peserta event fokus");
      }
      eventFilter = focusEventId;
    }

    if (req.user.role === "juri") {
      const eventIds = await getJuriEventIds(req.user.id);
      if (!eventIds.length) {
        return res.json([]);
      }

      if (eventFilter !== undefined) {
        if (!eventIds.includes(eventFilter)) {
          throw httpError(403, "Juri tidak ditugaskan pada event ini");
        }
      } else {
        eventFilter = { in: eventIds };
      }
    }

    if (eventFilter !== undefined) {
      where.eventId = eventFilter;
    }

    if (status !== undefined) {
      const normalizedStatus = String(status);
      if (!ALLOWED_PESERTA_STATUS.includes(normalizedStatus)) {
        throw httpError(400, "Status tidak valid");
      }
      where.status = normalizedStatus;
    }

    const peserta = await prisma.peserta.findMany({
      where,
      orderBy: { id: "asc" },
      include: {
        user: true,
        event: true,
        eventCategory: true,
        detailPeserta: true,
        juara: true,
        partisipasi: true,
        scores: {
          select: {
            id: true,
            nilai: true,
            _count: { select: { details: true } },
          },
        },
      },
    });

    res.json(peserta);
  })
);

// GET /api/peserta/me
router.get(
  "/me",
  asyncHandler(async (req, res) => {
    const peserta = await prisma.peserta.findUnique({
      where: { userId: req.user.id },
      include: {
        event: true,
        eventCategory: true,
        detailPeserta: true,
        partisipasi: true,
      },
    });

    if (!peserta) {
      throw httpError(404, "Peserta tidak ditemukan");
    }

    res.json(peserta);
  })
);

// GET /api/peserta/:id
router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);

    const peserta = await prisma.peserta.findUnique({
      where: { id },
      include: {
        user: true,
        event: true,
        eventCategory: true,
        detailPeserta: true,
        juara: true,
        partisipasi: true,
        scores: {
          select: {
            id: true,
            nilai: true,
            _count: { select: { details: true } },
          },
        },
      },
    });

    if (!peserta) {
      throw httpError(404, "Peserta tidak ditemukan");
    }

    if (req.user.role === "peserta" && peserta.userId !== req.user.id) {
      throw httpError(403, "Tidak boleh mengakses data peserta lain");
    }

    await ensureOperatorCanAccessPeserta(req, peserta);

    if (req.user.role === "juri") {
      const eventIds = await getJuriEventIds(req.user.id);
      if (!eventIds.includes(peserta.eventId)) {
        throw httpError(403, "Juri tidak ditugaskan pada event ini");
      }
    }

    res.json(peserta);
  })
);

// POST /api/peserta
router.post(
  "/",
  asyncHandler(async (req, res) => {
    if (!["admin", "operator", "peserta"].includes(req.user.role)) {
      throw httpError(403, "Role tidak diizinkan menambah peserta");
    }

    const { userId, eventId, namaTim, namaPerwakilan, detailPeserta, status } =
      req.body;
    const { eventCategoryId } = req.body;

    if (!namaTim) {
      throw httpError(400, "namaTim wajib diisi");
    }

    if (eventId === undefined || eventId === null || eventId === "") {
      throw httpError(400, "eventId wajib diisi");
    }

    const finalEventId = parsePositiveInt(eventId, "eventId");

    const finalCategoryId = await resolveEventCategorySelection(
      finalEventId,
      eventCategoryId
    );

    let finalUserId;
    if (req.user.role === "peserta") {
      finalUserId = req.user.id;
    } else {
      if (userId === undefined || userId === null || userId === "") {
        throw httpError(400, "userId wajib diisi");
      }
      finalUserId = parsePositiveInt(userId, "userId");
    }

    if (req.user.role === "operator") {
      const focusEventId = await requireOperatorFocusEventId(req.user.id);
      if (finalEventId !== focusEventId) {
        throw httpError(403, "Operator hanya bisa menambah peserta pada event fokus");
      }
    }

    const normalizedStatus =
      req.user.role === "peserta"
        ? "pending"
        : ALLOWED_PESERTA_STATUS.includes(status)
        ? status
        : "approved";

    const detailPayload = Array.isArray(detailPeserta)
      ? detailPeserta
          .map((item) => ({
            namaDetail: item.namaDetail,
            tanggalLahir: item.tanggalLahir
              ? new Date(item.tanggalLahir)
              : null,
            umur: item.umur ?? null,
          }))
          .filter((item) => Boolean(item.namaDetail))
      : [];

    const created = await prisma.peserta.create({
      data: {
        userId: finalUserId,
        eventId: finalEventId,
        eventCategoryId: finalCategoryId,
        namaTim,
        namaPerwakilan: namaPerwakilan ?? null,
        status: normalizedStatus,
        detailPeserta: detailPayload.length
          ? {
              create: detailPayload,
            }
          : undefined,
      },
      include: {
        detailPeserta: true,
      },
    });

    res.status(201).json(created);
  })
);

// PUT /api/peserta/:id
router.put(
  "/:id",
  asyncHandler(async (req, res) => {
    if (!["admin", "operator", "peserta"].includes(req.user.role)) {
      throw httpError(403, "Role tidak diizinkan mengubah peserta");
    }

    const id = parseId(req.params.id);
    const { namaTim, namaPerwakilan, status, eventCategoryId } = req.body;

    const peserta = await prisma.peserta.findUnique({ where: { id } });
    if (!peserta) {
      throw httpError(404, "Peserta tidak ditemukan");
    }

    if (req.user.role === "peserta" && peserta.userId !== req.user.id) {
      throw httpError(403, "Tidak boleh mengubah data peserta lain");
    }

    await ensureOperatorCanAccessPeserta(req, peserta);

    const updatedData = {
      namaTim: namaTim ?? peserta.namaTim,
      namaPerwakilan: namaPerwakilan ?? peserta.namaPerwakilan,
    };

    if (
      status !== undefined &&
      req.user.role !== "peserta"
    ) {
      const normalizedStatus = String(status);
      if (!ALLOWED_PESERTA_STATUS.includes(normalizedStatus)) {
        throw httpError(400, "Status tidak valid");
      }
      updatedData.status = normalizedStatus;
    }

    if (eventCategoryId !== undefined && req.user.role !== "peserta") {
      updatedData.eventCategoryId = await resolveEventCategorySelection(
        peserta.eventId,
        eventCategoryId
      );
    }

    const updated = await prisma.peserta.update({
      where: { id },
      data: updatedData,
    });

    res.json(updated);
  })
);

router.patch(
  "/:id/status",
  asyncHandler(async (req, res) => {
    if (!["admin", "operator"].includes(req.user.role)) {
      throw httpError(403, "Hanya admin/operator yang boleh mengubah status");
    }

    const id = parseId(req.params.id);
    const { status } = req.body;
    const normalizedStatus = String(status);
    if (!ALLOWED_PESERTA_STATUS.includes(normalizedStatus)) {
      throw httpError(400, "Status tidak valid");
    }

    const peserta = await prisma.peserta.findUnique({ where: { id } });
    if (!peserta) {
      throw httpError(404, "Peserta tidak ditemukan");
    }

    await ensureOperatorCanAccessPeserta(req, peserta);

    const updated = await prisma.peserta.update({
      where: { id },
      data: { status: normalizedStatus },
    });

    res.json({
      message: "Status peserta diperbarui",
      peserta: updated,
    });
  })
);

function buildStatusHandler(targetStatus) {
  return asyncHandler(async (req, res) => {
    if (!["admin", "operator"].includes(req.user.role)) {
      throw httpError(403, "Hanya admin/operator yang boleh mengubah status");
    }

    const id = parseId(req.params.id);

    const peserta = await prisma.peserta.findUnique({ where: { id } });
    if (!peserta) {
      throw httpError(404, "Peserta tidak ditemukan");
    }

    await ensureOperatorCanAccessPeserta(req, peserta);

    const updated = await prisma.peserta.update({
      where: { id },
      data: { status: targetStatus },
    });

    res.json({
      message:
        targetStatus === "approved"
          ? "Pendaftaran peserta disetujui"
          : "Pendaftaran peserta ditolak",
      peserta: updated,
    });
  });
}

router.patch("/:id/approve", buildStatusHandler("approved"));
router.patch("/:id/reject", buildStatusHandler("rejected"));

// DELETE /api/peserta/:id
router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    if (!["admin", "operator", "peserta"].includes(req.user.role)) {
      throw httpError(403, "Role tidak diizinkan menghapus peserta");
    }

    const id = parseId(req.params.id);

    const peserta = await prisma.peserta.findUnique({ where: { id } });
    if (!peserta) {
      throw httpError(404, "Peserta tidak ditemukan");
    }

    if (req.user.role === "peserta" && peserta.userId !== req.user.id) {
      throw httpError(403, "Tidak boleh menghapus data peserta lain");
    }

    await ensureOperatorCanAccessPeserta(req, peserta);

    await prisma.peserta.delete({
      where: { id },
    });

    res.json({ message: "Peserta berhasil dihapus" });
  })
);

module.exports = router;
