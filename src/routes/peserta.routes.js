// src/routes/peserta.routes.js
const express = require("express");
const prisma = require("../lib/prisma");
const { httpError, parseId } = require("../error");
const { auth, requireRole } = require("../middleware/auth");

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

// GET /api/peserta
router.get("/", async (req, res, next) => {
  try {
    const { eventId, status } = req.query;
    const where = {};

    if (eventId) where.eventId = Number(eventId);
    if (req.user.role === "peserta") where.userId = req.user.id;

    if (req.user.role === "operator") {
      const focusEventId = await requireOperatorFocusEventId(req.user.id);
      if (where.eventId && where.eventId !== focusEventId) {
        throw httpError(403, "Operator hanya boleh melihat peserta event fokus");
      }
      where.eventId = focusEventId;
    }

    if (req.user.role === "juri") {
      const eventIds = await getJuriEventIds(req.user.id);
      if (!eventIds.length) {
        return res.json([]);
      }
      if (where.eventId) {
        if (!eventIds.includes(where.eventId)) {
          throw httpError(403, "Juri tidak ditugaskan pada event ini");
        }
      } else {
        where.eventId = { in: eventIds };
      }
    }

    if (status && ALLOWED_PESERTA_STATUS.includes(status)) {
      where.status = status;
    }

    const peserta = await prisma.peserta.findMany({
      where,
      orderBy: { id: "asc" },
      include: {
        user: true,
        event: true,
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
  } catch (err) {
    next(err);
  }
});

// GET /api/peserta/:id
router.get("/:id", async (req, res, next) => {
  try {
    const id = parseId(req.params.id);

    const peserta = await prisma.peserta.findUnique({
      where: { id },
      include: {
        user: true,
        event: true,
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
  } catch (err) {
    next(err);
  }
});

// GET /api/peserta/me
router.get("/me", auth, requireRole("peserta","admin","juri","operator"), async (req, res, next) => {
  try {
    const peserta = await prisma.peserta.findUnique({
      where: { userId: req.user.id },
      include: {
        event: true,
        detailPeserta: true, 
        partisipasi: true,
      },
    });

    if (!peserta) {
      return res.status(404).json({ message: "Peserta tidak ditemukan" });
    }

    res.json(peserta);
  } catch (err) {
    next(err);
  }
});

// POST /api/peserta
router.post("/", async (req, res, next) => {
  try {
    if (!["admin", "operator", "peserta"].includes(req.user.role)) {
      throw httpError(403, "Role tidak diizinkan menambah peserta");
    }

    const {
      userId,
      eventId,
      namaTim,
      namaPerwakilan,
      detailPeserta,
      status,
    } = req.body;

    if (!eventId || !namaTim) {
      throw httpError(400, "eventId dan namaTim wajib diisi");
    }

    let finalEventId = Number(eventId);
    if (Number.isNaN(finalEventId)) {
      throw httpError(400, "eventId tidak valid");
    }

    let finalUserId = userId;
    if (req.user.role === "peserta") {
      finalUserId = req.user.id;
    }
    if (!finalUserId) {
      throw httpError(400, "userId tidak valid");
    }

    if (req.user.role === "operator") {
      const focusEventId = await requireOperatorFocusEventId(req.user.id);
      if (finalEventId !== focusEventId) {
        throw httpError(403, "Operator hanya bisa menambah peserta pada event fokus");
      }
    }

    const desiredStatus =
      req.user.role === "peserta"
        ? "pending"
        : ALLOWED_PESERTA_STATUS.includes(status)
        ? status
        : "approved";

    const created = await prisma.peserta.create({
      data: {
        userId: finalUserId,
        eventId: finalEventId,
        namaTim,
        namaPerwakilan: namaPerwakilan ?? null,
        status: desiredStatus,
        detailPeserta: detailPeserta?.length
          ? {
              create: detailPeserta.map((d) => ({
                namaDetail: d.namaDetail,
                tanggalLahir: d.tanggalLahir
                  ? new Date(d.tanggalLahir)
                  : null,
                umur: d.umur ?? null,
              })),
            }
          : undefined,
      },
      include: {
        detailPeserta: true,
      },
    });

    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
});

// PUT /api/peserta/:id
router.put("/:id", async (req, res, next) => {
  try {
    if (!["admin", "operator", "peserta"].includes(req.user.role)) {
      throw httpError(403, "Role tidak diizinkan mengubah peserta");
    }

    const id = parseId(req.params.id);
    const { namaTim, namaPerwakilan, status } = req.body;

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
      status &&
      req.user.role !== "peserta" &&
      ALLOWED_PESERTA_STATUS.includes(status)
    ) {
      updatedData.status = status;
    }

    const updated = await prisma.peserta.update({
      where: { id },
      data: updatedData,
    });

    res.json(updated);
  } catch (err) {
    next(err);
  }
});

router.patch("/:id/status", async (req, res, next) => {
  try {
    if (!["admin", "operator"].includes(req.user.role)) {
      throw httpError(403, "Hanya admin/operator yang boleh mengubah status");
    }

    const id = parseId(req.params.id);
    const { status } = req.body;
    if (!ALLOWED_PESERTA_STATUS.includes(status)) {
      throw httpError(400, "Status tidak valid");
    }

    const peserta = await prisma.peserta.findUnique({ where: { id } });
    if (!peserta) {
      throw httpError(404, "Peserta tidak ditemukan");
    }

    await ensureOperatorCanAccessPeserta(req, peserta);

    const updated = await prisma.peserta.update({
      where: { id },
      data: { status },
    });

    res.json({
      message: "Status peserta diperbarui",
      peserta: updated,
    });
  } catch (err) {
    next(err);
  }
});

function buildStatusHandler(targetStatus) {
  return async (req, res, next) => {
    try {
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
    } catch (err) {
      next(err);
    }
  };
}

router.patch("/:id/approve", buildStatusHandler("approved"));
router.patch("/:id/reject", buildStatusHandler("rejected"));

// DELETE /api/peserta/:id
router.delete("/:id", async (req, res, next) => {
  try {
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
  } catch (err) {
    next(err);
  }
});

module.exports = router;
