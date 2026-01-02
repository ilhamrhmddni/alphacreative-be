// src/routes/scoreDetail.routes.js
const express = require("express");
const prisma = require("../lib/prisma");
const { httpError, parseId } = require("../error");
const { auth, requireRole } = require("../middleware/auth");
const asyncHandler = require("../utils/async-handler");
const {
  parsePositiveInt,
  parseOptionalPositiveInt,
  parseNullableNumber,
  parseNumber,
} = require("../utils/parsers");
const {
  requireOperatorFocusEventId,
  ensureOperatorScoreAccess,
} = require("../utils/operator-access");

const router = express.Router();

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
router.get(
  "/",
  auth,
  asyncHandler(async (req, res) => {
    const { scoreId, eventId, pesertaId } = req.query;

    const where = {};

    const parsedScoreId = parseOptionalPositiveInt(scoreId, "scoreId");
    if (parsedScoreId !== undefined) {
      where.scoreId = parsedScoreId;
    }

    const scoreWhere = {};
    const parsedEventId = parseOptionalPositiveInt(eventId, "eventId");
    if (parsedEventId !== undefined) {
      scoreWhere.eventId = parsedEventId;
    }

    const parsedPesertaId = parseOptionalPositiveInt(
      pesertaId,
      "pesertaId"
    );
    if (parsedPesertaId !== undefined) {
      scoreWhere.pesertaId = parsedPesertaId;
    }

    if (req.user.role === "admin") {
      // full access
    } else if (req.user.role === "operator") {
      const focusEventId = await requireOperatorFocusEventId(req.user.id);
      if (
        parsedEventId !== undefined &&
        parsedEventId !== focusEventId
      ) {
        throw httpError(
          403,
          "Operator hanya boleh melihat detail score di event fokus"
        );
      }
      scoreWhere.eventId = focusEventId;
    } else if (req.user.role === "juri") {
      scoreWhere.juriId = req.user.id;
    } else if (req.user.role === "peserta") {
      scoreWhere.peserta = { userId: req.user.id };
    } else {
      throw httpError(403, "Role tidak diizinkan melihat detail score");
    }

    if (Object.keys(scoreWhere).length > 0) {
      where.score = scoreWhere;
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
  })
);

/**
 * GET /api/score-details/:id
 */
router.get(
  "/:id",
  auth,
  asyncHandler(async (req, res) => {
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

    if (req.user.role === "admin") {
      // full access
    } else if (req.user.role === "operator") {
      await ensureOperatorScoreAccess(
        req.user,
        score,
        "Operator hanya boleh melihat detail score di event fokus"
      );
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
  })
);

router.post(
  "/",
  auth,
  requireRole("admin", "juri", "operator"),
  asyncHandler(async (req, res) => {
    const { scoreId, kriteria, nilai, bobot, catatan } = req.body;

    const parsedScoreId = parsePositiveInt(scoreId, "scoreId");
    const normalizedKriteria = String(kriteria || "").trim();
    if (!normalizedKriteria) {
      throw httpError(400, "kriteria wajib diisi");
    }
    const parsedNilai = parseNumber(nilai, "nilai");
    const parsedBobot = parseNullableNumber(bobot, "bobot", {
      allowUndefined: true,
    });

    const score = await prisma.score.findUnique({
      where: { id: parsedScoreId },
    });

    if (!score) throw httpError(404, "Score tidak ditemukan");

    if (req.user.role === "juri" && score.juriId !== req.user.id) {
      throw httpError(403, "Tidak boleh menambah detail untuk score juri lain");
    }

    await ensureOperatorScoreAccess(
      req.user,
      score,
      "Operator hanya boleh mengelola detail score pada event fokus"
    );

    const created = await prisma.scoreDetail.create({
      data: {
        scoreId: parsedScoreId,
        kriteria: normalizedKriteria,
        nilai: parsedNilai,
        bobot: parsedBobot ?? null,
        catatan:
          catatan === undefined
            ? null
            : String(catatan).trim() || null,
      },
    });

    res.status(201).json(created);
  })
);

/**
 * PUT /api/score-details/:id
 * Role: admin, juri, operator
 * - Juri hanya boleh update detail untuk score miliknya sendiri
 * - Operator dibatasi pada event fokus
 */
router.put(
  "/:id",
  auth,
  requireRole("admin", "juri", "operator"),
  asyncHandler(async (req, res) => {
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

    await ensureOperatorScoreAccess(
      req.user,
      detail.score,
      "Operator hanya boleh mengelola detail score pada event fokus"
    );

    const data = {};

    if (kriteria !== undefined) {
      const normalized = String(kriteria).trim();
      if (!normalized) {
        throw httpError(400, "kriteria wajib diisi");
      }
      data.kriteria = normalized;
    }

    const parsedNilai = parseNullableNumber(nilai, "nilai", { allowUndefined: true });
    if (parsedNilai !== undefined) {
      data.nilai = parsedNilai;
    }

    const parsedBobot = parseNullableNumber(bobot, "bobot", { allowUndefined: true });
    if (parsedBobot !== undefined) {
      data.bobot = parsedBobot;
    }

    if (catatan !== undefined) {
      data.catatan =
        catatan === null || catatan === undefined
          ? null
          : String(catatan).trim() || null;
    }

    if (Object.keys(data).length === 0) {
      throw httpError(400, "Tidak ada field yang diupdate");
    }

    const updated = await prisma.scoreDetail.update({
      where: { id },
      data,
    });

    res.json(updated);
  })
);

/**
 * DELETE /api/score-details/:id
 * Role: admin, operator
 */
router.delete(
  "/:id",
  auth,
  requireRole("admin", "operator"),
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);

    if (req.user.role === "operator") {
      const detail = await prisma.scoreDetail.findUnique({
        where: { id },
        include: { score: true },
      });
      if (!detail) {
        throw httpError(404, "Score detail tidak ditemukan");
      }
      await ensureOperatorScoreAccess(
        req.user,
        detail.score,
        "Operator hanya boleh mengelola detail score pada event fokus"
      );
    }

    await prisma.scoreDetail.delete({
      where: { id },
    });

    res.json({ message: "Score detail berhasil dihapus" });
  })
);

module.exports = router;
