// src/routes/scoreDetail.routes.js
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

async function ensureOperatorCanAccessScore(req, score) {
  if (req.user.role !== "operator") return;
  const focusEventId = await requireOperatorFocusEventId(req.user.id);
  if (score.eventId !== focusEventId) {
    throw httpError(403, "Operator hanya boleh mengelola detail pada event fokus");
  }
}

/**
 * GET /api/score-details
 * Query optional:
 *  - scoreId
 *  - eventId
 *  - pesertaId
 *
 * Role:
 *  - admin/operator: semua
 *  - juri: hanya score milik dia
 *  - peserta: hanya score peserta miliknya
 */
router.get("/", auth, async (req, res, next) => {
  try {
    const { scoreId, eventId, pesertaId } = req.query;

    const where = {};

    if (scoreId) where.scoreId = Number(scoreId);

    // filter berdasarkan relasi Score
    const scoreFilter = {};
    if (eventId) scoreFilter.eventId = Number(eventId);
    if (pesertaId) scoreFilter.pesertaId = Number(pesertaId);

    if (req.user.role === "admin" || req.user.role === "operator") {
      if (req.user.role === "operator") {
        const focusEventId = await requireOperatorFocusEventId(req.user.id);
        if (scoreFilter.eventId && scoreFilter.eventId !== focusEventId) {
          throw httpError(
            403,
            "Operator hanya boleh melihat detail score di event fokus"
          );
        }
        scoreFilter.eventId = focusEventId;
      }
    } else if (req.user.role === "juri") {
      scoreFilter.juriId = req.user.id;
    } else if (req.user.role === "peserta") {
      scoreFilter.peserta = { userId: req.user.id };
    } else {
      throw httpError(403, "Role tidak diizinkan melihat detail score");
    }

    if (Object.keys(scoreFilter).length > 0) {
      where.score = scoreFilter;
    }

    const details = await prisma.scoreDetail.findMany({
      where,
      orderBy: { id: "asc" },
      include: {
        score: {
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
          },
        },
      },
    });

    res.json(details);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/score-details/:id
 */
router.get("/:id", auth, async (req, res, next) => {
  try {
    const id = parseId(req.params.id);

    const detail = await prisma.scoreDetail.findUnique({
      where: { id },
      include: {
        score: {
          include: {
            event: true,
            peserta: {
              include: {
                user: true,
              },
            },
            juri: true,
          },
        },
      },
    });

    if (!detail) throw httpError(404, "Score detail tidak ditemukan");

    const score = detail.score;

    if (req.user.role === "admin" || req.user.role === "operator") {
      if (req.user.role === "operator") {
        await ensureOperatorCanAccessScore(req, score);
      }
    } else if (req.user.role === "juri") {
      if (score.juriId !== req.user.id) {
        throw httpError(403, "Tidak boleh melihat detail score juri lain");
      }
    } else if (req.user.role === "peserta") {
      if (score.peserta.userId !== req.user.id) {
        throw httpError(403, "Tidak boleh melihat detail score peserta lain");
      }
    } else {
      throw httpError(403, "Role tidak diizinkan melihat detail score");
    }

    res.json(detail);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/score-details
 * Role: admin, juri
 *
 * Body:
 *  - scoreId (required)
 *  - kriteria (required)
 *  - nilai (required)
 *  - bobot (optional)
 *
 * Juri hanya boleh buat untuk score miliknya sendiri.
 */
router.post(
  "/",
  auth,
  requireRole("admin", "juri", "operator"),
  async (req, res, next) => {
    try {
      const { scoreId, kriteria, nilai, bobot, catatan } = req.body;

      if (!scoreId || !kriteria || nilai === undefined) {
        throw httpError(400, "scoreId, kriteria, nilai wajib diisi");
      }

      const parsedScoreId = Number(scoreId);
      const parsedNilai = Number(nilai);

      if (Number.isNaN(parsedScoreId) || Number.isNaN(parsedNilai)) {
        throw httpError(400, "scoreId dan nilai harus number");
      }

      const score = await prisma.score.findUnique({
        where: { id: parsedScoreId },
      });

      if (!score) throw httpError(404, "Score tidak ditemukan");

      if (req.user.role === "juri" && score.juriId !== req.user.id) {
        throw httpError(403, "Tidak boleh menambah detail untuk score juri lain");
      }
      if (req.user.role === "operator") {
        await ensureOperatorCanAccessScore(req, score);
      }

      const created = await prisma.scoreDetail.create({
        data: {
          scoreId: parsedScoreId,
          kriteria,
          nilai: parsedNilai,
          bobot:
            bobot !== undefined && bobot !== null ? Number(bobot) : null,
          catatan: catatan && String(catatan).trim() ? catatan.trim() : null,
        },
      });

      res.status(201).json(created);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * PUT /api/score-details/:id
 * Role: admin, juri
 * - Juri hanya boleh update detail untuk score miliknya sendiri
 */
router.put(
  "/:id",
  auth,
  requireRole("admin", "juri", "operator"),
  async (req, res, next) => {
    try {
      const id = parseId(req.params.id);
      const { kriteria, nilai, bobot, catatan } = req.body;

      const detail = await prisma.scoreDetail.findUnique({
        where: { id },
        include: {
          score: true,
        },
      });

      if (!detail) throw httpError(404, "Score detail tidak ditemukan");

      if (req.user.role === "juri") {
        if (detail.score.juriId !== req.user.id) {
          throw httpError(
            403,
            "Tidak boleh mengubah detail score milik juri lain"
          );
        }
      }
      if (req.user.role === "operator") {
        await ensureOperatorCanAccessScore(req, detail.score);
      }

      const data = {};

      if (kriteria !== undefined) {
        data.kriteria = kriteria;
      }

      if (nilai !== undefined) {
        const parsedNilai = Number(nilai);
        if (Number.isNaN(parsedNilai)) {
          throw httpError(400, "nilai harus number");
        }
        data.nilai = parsedNilai;
      }

      if (bobot !== undefined) {
        data.bobot =
          bobot === null || bobot === ""
            ? null
            : Number(bobot);
      }

      if (catatan !== undefined) {
        const trimmed =
          catatan === null || catatan === ""
            ? null
            : String(catatan).trim();
        data.catatan = trimmed;
      }

      if (Object.keys(data).length === 0) {
        throw httpError(400, "Tidak ada field yang diupdate");
      }

      const updated = await prisma.scoreDetail.update({
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
 * DELETE /api/score-details/:id
 * Role: admin only
 */
router.delete(
  "/:id",
  auth,
  requireRole("admin", "operator"),
  async (req, res, next) => {
    try {
      const id = parseId(req.params.id);

      if (req.user.role === "operator") {
        const detail = await prisma.scoreDetail.findUnique({
          where: { id },
          include: { score: true },
        });
        if (!detail) {
          throw httpError(404, "Score detail tidak ditemukan");
        }
        await ensureOperatorCanAccessScore(req, detail.score);
      }

      await prisma.scoreDetail.delete({
        where: { id },
      });

      res.json({ message: "Score detail berhasil dihapus" });
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
