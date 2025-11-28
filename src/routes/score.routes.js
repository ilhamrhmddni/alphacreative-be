// src/routes/score.routes.js
const express = require("express");
const prisma = require("../lib/prisma");
const { httpError, parseId } = require("../error");
const { auth, requireRole } = require("../middleware/auth");

const router = express.Router();

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

async function ensureOperatorCanAccessEvent(req, eventId) {
  if (req.user.role !== "operator") return;
  const focusEventId = await requireOperatorFocusEventId(req.user.id);
  if (eventId !== focusEventId) {
    throw httpError(
      403,
      "Operator hanya boleh mengelola score pada event fokus"
    );
  }
}

/**
 * GET /api/scores
 * Query optional:
 *  - eventId
 *  - pesertaId
 *  - juriId (hanya admin/operator)
 *
 * Role:
 *  - admin, operator: bisa lihat semua (dengan filter optional)
 *  - juri: hanya skor yang dia buat (juriId = req.user.id)
 *  - peserta: hanya skor untuk peserta miliknya
 */
router.get("/", auth, async (req, res, next) => {
  try {
    const { eventId, pesertaId, juriId } = req.query;
    const where = {};

    if (eventId) where.eventId = Number(eventId);
    if (pesertaId) where.pesertaId = Number(pesertaId);

    if (req.user.role === "admin" || req.user.role === "operator") {
      if (juriId) where.juriId = Number(juriId);
      if (req.user.role === "operator") {
        const focusEventId = await requireOperatorFocusEventId(req.user.id);
        if (where.eventId && where.eventId !== focusEventId) {
          throw httpError(
            403,
            "Operator hanya boleh melihat score pada event fokus"
          );
        }
        where.eventId = focusEventId;
      }
    } else if (req.user.role === "juri") {
      where.juriId = req.user.id;
    } else if (req.user.role === "peserta") {
      where.peserta = { userId: req.user.id };
    } else {
      throw httpError(403, "Role tidak diizinkan melihat score");
    }

    const scores = await prisma.score.findMany({
      where,
      orderBy: { id: "asc" },
      include: {
        event: true,
        peserta: {
          include: {
            user: {
              select: { id: true, email: true, username: true },
            },
          },
        },
        juri: {
          select: { id: true, email: true, username: true, role: true },
        },
        details: true,
      },
    });

    res.json(scores);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/scores/:id
 */
router.get("/:id", auth, async (req, res, next) => {
  try {
    const id = parseId(req.params.id);

    const score = await prisma.score.findUnique({
      where: { id },
      include: {
        event: true,
        peserta: {
          include: {
            user: true,
          },
        },
        juri: true,
        details: true,
      },
    });

    if (!score) throw httpError(404, "Score tidak ditemukan");

    if (req.user.role === "admin" || req.user.role === "operator") {
      // full akses
      if (req.user.role === "operator") {
        await ensureOperatorCanAccessEvent(req, score.eventId);
      }
    } else if (req.user.role === "juri") {
      if (score.juriId !== req.user.id) {
        throw httpError(403, "Tidak boleh melihat score juri lain");
      }
    } else if (req.user.role === "peserta") {
      if (score.peserta.userId !== req.user.id) {
        throw httpError(403, "Tidak boleh melihat score peserta lain");
      }
    } else {
      throw httpError(403, "Role tidak diizinkan melihat score");
    }

    res.json(score);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/scores
 * Role: admin, juri
 *
 * Body:
 *  - eventId (number, required)
 *  - pesertaId (number, required)
 *  - nilai (number, optional – boleh null jika memakai detail score)
 *  - catatan (string, optional)
 *  - details (optional array):
 *      [
 *        { kriteria: "Musik", nilai: 85, bobot: 0.4 },
 *        { kriteria: "Visual", nilai: 88, bobot: 0.3 },
 *        ...
 *      ]
 */
router.post(
  "/",
  auth,
  requireRole("admin", "operator"),
  async (req, res, next) => {
    try {
      const {
        eventId,
        pesertaId,
        nilai,
        catatan,
        details,
        juriId: bodyJuriId,
      } = req.body;

      if (!eventId || !pesertaId) {
        throw httpError(400, "eventId dan pesertaId wajib diisi");
      }

      const parsedEventId = Number(eventId);
      const parsedPesertaId = Number(pesertaId);
      const nilaiProvided =
        nilai !== undefined &&
        nilai !== null &&
        String(nilai).trim() !== "";
      let parsedNilai = null;

      if (
        Number.isNaN(parsedEventId) ||
        Number.isNaN(parsedPesertaId)
      ) {
        throw httpError(400, "eventId dan pesertaId harus number");
      }

      if (nilaiProvided) {
        parsedNilai = Number(nilai);
        if (Number.isNaN(parsedNilai)) {
          throw httpError(400, "nilai harus number");
        }
      }

      const [event, peserta] = await Promise.all([
        prisma.event.findUnique({ where: { id: parsedEventId } }),
        prisma.peserta.findUnique({ where: { id: parsedPesertaId } }),
      ]);

      if (!event) throw httpError(404, "Event tidak ditemukan");
      if (!peserta) throw httpError(404, "Peserta tidak ditemukan");
      if (req.user.role === "operator") {
        await ensureOperatorCanAccessEvent(req, parsedEventId);
      }
      if (!bodyJuriId) {
        throw httpError(400, "juriId wajib dipilih");
      }
      const juriId = Number(bodyJuriId);
      if (Number.isNaN(juriId)) {
        throw httpError(400, "juriId tidak valid");
      }
      const juriUser = await prisma.user.findUnique({
        where: { id: juriId },
        select: { id: true, role: true },
      });
      if (!juriUser) {
        throw httpError(404, "User juri tidak ditemukan");
      }
      if (juriUser.role !== "juri") {
        throw httpError(400, "juriId harus user dengan role juri");
      }

      // pastikan tidak duplikat untuk kombinasi event+peserta+juri
      const existing = await prisma.score.findUnique({
        where: {
          eventId_pesertaId_juriId: {
            eventId: parsedEventId,
            pesertaId: parsedPesertaId,
            juriId,
          },
        },
      });

      if (existing) {
        throw httpError(
          400,
          "Score sudah ada untuk kombinasi event, peserta, dan juri ini. Gunakan PUT untuk update."
        );
      }

      const created = await prisma.score.create({
        data: {
          eventId: parsedEventId,
          pesertaId: parsedPesertaId,
          juriId,
          nilai: nilaiProvided ? parsedNilai : null,
          catatan: catatan ?? null,
          details: Array.isArray(details)
            ? {
                create: details.map((d) => ({
                  kriteria: d.kriteria,
                  nilai: Number(d.nilai),
                  bobot:
                    d.bobot !== undefined && d.bobot !== null
                      ? Number(d.bobot)
                      : null,
                })),
              }
            : undefined,
        },
        include: {
          details: true,
        },
      });

      res.status(201).json(created);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * PUT /api/scores/:id
 * Role: admin, juri
 * - Juri hanya boleh update skor miliknya sendiri
 * - Hanya update field di Score, tidak sentuh details
 */
router.put(
  "/:id",
  auth,
  requireRole("admin", "operator"),
  async (req, res, next) => {
    try {
      const id = parseId(req.params.id);
      const { nilai, catatan } = req.body;

      const score = await prisma.score.findUnique({ where: { id } });
      if (!score) throw httpError(404, "Score tidak ditemukan");

      if (req.user.role === "operator") {
        await ensureOperatorCanAccessEvent(req, score.eventId);
      }

      const data = {};

      if (nilai !== undefined) {
        if (nilai === null || String(nilai).trim() === "") {
          data.nilai = null;
        } else {
          const parsedNilai = Number(nilai);
          if (Number.isNaN(parsedNilai)) {
            throw httpError(400, "nilai harus number");
          }
          data.nilai = parsedNilai;
        }
      }

      if (catatan !== undefined) {
        data.catatan = catatan;
      }

      if (Object.keys(data).length === 0) {
        throw httpError(400, "Tidak ada field yang diupdate");
      }

      const updated = await prisma.score.update({
        where: { id },
        data,
      });

      res.json(updated);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * DELETE /api/scores/by-peserta?eventId=&pesertaId=
 * Menghapus seluruh score (beserta detailnya) untuk kombinasi event+peserta.
 * Role: admin, operator
 */
router.delete(
  "/by-peserta",
  auth,
  requireRole("admin", "operator"),
  async (req, res, next) => {
    try {
      const eventId = Number(req.query.eventId);
      const pesertaId = Number(req.query.pesertaId);

      if (!eventId || !pesertaId) {
        throw httpError(400, "eventId dan pesertaId wajib diisi");
      }

      if (Number.isNaN(eventId) || Number.isNaN(pesertaId)) {
        throw httpError(400, "eventId dan pesertaId harus number");
      }

      if (req.user.role === "operator") {
        await ensureOperatorCanAccessEvent(req, eventId);
      }

      const result = await prisma.score.deleteMany({
        where: {
          eventId,
          pesertaId,
        },
      });

      res.json({
        message: "Score peserta berhasil dihapus",
        deletedScores: result.count,
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * DELETE /api/scores/:id
 * Role: admin only
 * - otomatis menghapus ScoreDetail karena relasi onDelete default
 */
router.delete(
  "/:id",
  auth,
  requireRole("admin", "operator"),
  async (req, res, next) => {
    try {
      const id = parseId(req.params.id);

      if (req.user.role === "operator") {
        const existing = await prisma.score.findUnique({
          where: { id },
          select: { eventId: true },
        });
        if (!existing) {
          throw httpError(404, "Score tidak ditemukan");
        }
        await ensureOperatorCanAccessEvent(req, existing.eventId);
      }

      await prisma.score.delete({
        where: { id },
      });

      res.json({ message: "Score berhasil dihapus" });
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
