const express = require("express");
const prisma = require("../lib/prisma");
const { httpError, parseId } = require("../error");
const { requireRole, auth } = require("../middleware/auth");

const router = express.Router();

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

// GET /api/juara → admin & peserta boleh
router.get("/", auth, requireRole("admin","operator","peserta","juri"), async (req, res, next) => {
  try {
    const { eventId, pesertaId } = req.query;
    const where = {};
    if (eventId) where.eventId = Number(eventId);
    if (pesertaId) where.pesertaId = Number(pesertaId);
    if (req.user.role === "peserta") {
      where.peserta = { userId: req.user.id };
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

    const juara = await prisma.juara.findMany({
      where,
      orderBy: { id: "asc" },
      include: {
        event: true,
        peserta: true,
        setByUser: {
          select: { id: true, username: true, email: true, role: true },
        },
      },
    });

    res.json(juara);
  } catch (err) {
    next(err);
  }
});

// GET /api/juara/:id → admin & peserta boleh
router.get("/:id", auth, requireRole("admin","operator","peserta","juri"), async (req, res, next) => {
  try {
    const id = parseId(req.params.id);

    const juara = await prisma.juara.findUnique({
      where: { id },
      include: {
        event: true,
        peserta: true,
        setByUser: { select: { id: true, username: true, email: true, role: true } },
      },
    });

    if (!juara) throw httpError(404, "Data juara tidak ditemukan");

    if (
      req.user.role === "peserta" &&
      juara.peserta?.userId !== req.user.id
    ) {
      throw httpError(403, "Tidak boleh mengakses data juara peserta lain");
    }

    if (req.user.role === "juri") {
      const eventIds = await getJuriEventIds(req.user.id);
      if (!eventIds.includes(juara.eventId)) {
        throw httpError(403, "Juri tidak ditugaskan pada event ini");
      }
    }

    res.json(juara);
  } catch (err) {
    next(err);
  }
});

// POST /api/juara → hanya admin
router.post("/", auth, requireRole("admin","operator"), async (req, res, next) => {
  try {
    const { eventId, pesertaId, juara, kategori, berkasLink } = req.body;

    if (!eventId || !pesertaId || !juara) {
      throw httpError(400, "eventId, pesertaId, juara wajib diisi");
    }

    const created = await prisma.juara.create({
      data: {
        eventId,
        pesertaId,
        juara,
        kategori: kategori ?? null,
        berkasLink: berkasLink ?? null,
        setByUserId: req.user.id,
      },
      include: {
        setByUser: { select: { id: true, username: true, email: true, role: true } },
      },
    });

    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
});

// PUT /api/juara/:id → hanya admin
router.put("/:id", auth, requireRole("admin","operator"), async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    const { eventId, pesertaId, juara, kategori, berkasLink } = req.body;

    const updated = await prisma.juara.update({
      where: { id },
      data: {
        eventId,
        pesertaId,
        juara,
        kategori: kategori ?? null,
        berkasLink: berkasLink ?? null,
        setByUserId: req.user.id,
      },
      include: {
        setByUser: { select: { id: true, username: true, email: true, role: true } },
      },
    });

    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/juara/:id → hanya admin
router.delete("/:id", auth, requireRole("admin","operator"), async (req, res, next) => {
  try {
    const id = parseId(req.params.id);

    await prisma.juara.delete({
      where: { id },
    });

    res.json({ message: "Data juara berhasil dihapus" });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
