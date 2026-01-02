// src/routes/score.routes.js
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
  parseOptionalBoolean,
} = require("../utils/parsers");
const {
  requireOperatorFocusEventId,
  ensureOperatorEventAccess,
  ensureOperatorScoreAccess,
} = require("../utils/operator-access");

const router = express.Router();

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
router.get(
  "/",
  auth,
  asyncHandler(async (req, res) => {
    const { eventId, pesertaId, juriId } = req.query;
    const where = {};

    const parsedEventId = parseOptionalPositiveInt(eventId, "eventId");
    const parsedPesertaId = parseOptionalPositiveInt(pesertaId, "pesertaId");
    const parsedJuriId = parseOptionalPositiveInt(juriId, "juriId");

    if (parsedEventId !== undefined) {
      where.eventId = parsedEventId;
    }

    if (parsedPesertaId !== undefined) {
      where.pesertaId = parsedPesertaId;
    }

    if (req.user.role === "admin") {
      if (parsedJuriId !== undefined) {
        where.juriId = parsedJuriId;
      }
    } else if (req.user.role === "operator") {
      const focusEventId = await requireOperatorFocusEventId(req.user.id);
      if (
        parsedEventId !== undefined &&
        parsedEventId !== focusEventId
      ) {
        throw httpError(
          403,
          "Operator hanya boleh melihat score pada event fokus"
        );
      }
      where.eventId = focusEventId;
      if (parsedJuriId !== undefined) {
        where.juriId = parsedJuriId;
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
  })
);

/**
 * GET /api/scores/:id
 */
router.get(
  "/:id",
  auth,
  asyncHandler(async (req, res) => {
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

    if (req.user.role === "admin") {
      // full access
    } else if (req.user.role === "operator") {
      await ensureOperatorEventAccess(
        req.user,
        score.eventId,
        "Operator hanya boleh melihat score pada event fokus"
      );
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
  })
);

router.post(
  "/",
  auth,
  requireRole("admin", "operator"),
  asyncHandler(async (req, res) => {
    const {
      eventId,
      pesertaId,
      nilai,
      catatan,
      details,
      juriId: bodyJuriId,
      useManualNilai,
    } = req.body;

    const parsedEventId = parsePositiveInt(eventId, "eventId");
    const parsedPesertaId = parsePositiveInt(pesertaId, "pesertaId");
    const parsedJuriId = parsePositiveInt(bodyJuriId, "juriId");
    let parsedNilai = parseNullableNumber(nilai, "nilai", {
      allowUndefined: true,
    });
    const manualFlag = parseOptionalBoolean(
      useManualNilai,
      "useManualNilai"
    ) ?? false;

    if (manualFlag) {
      if (parsedNilai == null) {
        throw httpError(
          400,
          "nilai wajib diisi saat menggunakan nilai manual"
        );
      }
      if (parsedNilai < 0 || parsedNilai > 100) {
        throw httpError(400, "nilai harus berada dalam rentang 0-100");
      }
      parsedNilai = Math.round(parsedNilai);
    } else {
      parsedNilai = null;
    }

    const [event, peserta, juriUser] = await Promise.all([
      prisma.event.findUnique({ where: { id: parsedEventId } }),
      prisma.peserta.findUnique({ where: { id: parsedPesertaId } }),
      prisma.user.findUnique({
        where: { id: parsedJuriId },
        select: { id: true, role: true },
      }),
    ]);

    if (!event) throw httpError(404, "Event tidak ditemukan");
    if (!peserta) throw httpError(404, "Peserta tidak ditemukan");
    if (!juriUser) throw httpError(404, "User juri tidak ditemukan");
    if (juriUser.role !== "juri") {
      throw httpError(400, "juriId harus user dengan role juri");
    }

    await ensureOperatorEventAccess(
      req.user,
      parsedEventId,
      "Operator hanya boleh mengelola score pada event fokus"
    );

    const existing = await prisma.score.findUnique({
      where: {
        eventId_pesertaId_juriId: {
          eventId: parsedEventId,
          pesertaId: parsedPesertaId,
          juriId: parsedJuriId,
        },
      },
    });

    if (existing) {
      throw httpError(
        400,
        "Score sudah ada untuk kombinasi event, peserta, dan juri ini. Gunakan PUT untuk update."
      );
    }

    let detailsInput;
    if (Array.isArray(details)) {
      detailsInput = {
        create: details.map((item, index) => {
          const kriteria = String(item.kriteria || "").trim();
          if (!kriteria) {
            throw httpError(400, `details[${index}].kriteria wajib diisi`);
          }
          const detailNilai = parseNumber(
            item.nilai,
            `details[${index}].nilai`
          );
          const detailBobot = parseNullableNumber(
            item.bobot,
            `details[${index}].bobot`,
            { allowUndefined: true }
          );

          return {
            kriteria,
            nilai: detailNilai,
            bobot: detailBobot ?? null,
          };
        }),
      };
    }

    const created = await prisma.score.create({
      data: {
        eventId: parsedEventId,
        pesertaId: parsedPesertaId,
        juriId: parsedJuriId,
        nilai: parsedNilai,
        useManualNilai: manualFlag,
        catatan:
          catatan === undefined
            ? null
            : String(catatan).trim() || null,
        details: detailsInput,
      },
      include: {
        details: true,
      },
    });

    res.status(201).json(created);
  })
);

/**
 * PUT /api/scores/:id
 * Role: admin, operator
 * - Operator dibatasi pada event fokus
 * - Hanya update field di Score, tidak sentuh details
 */
router.put(
  "/:id",
  auth,
  requireRole("admin", "operator"),
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    const { nilai, catatan, useManualNilai } = req.body;

    const score = await prisma.score.findUnique({ where: { id } });
    if (!score) throw httpError(404, "Score tidak ditemukan");

    await ensureOperatorScoreAccess(
      req.user,
      score,
      "Operator hanya boleh mengelola score pada event fokus"
    );

    const data = {};

    const parsedUseManual = parseOptionalBoolean(
      useManualNilai,
      "useManualNilai"
    );
    if (parsedUseManual !== undefined) {
      data.useManualNilai = parsedUseManual;
    }

    const nilaiProvided = nilai !== undefined;
    let parsedNilai;
    if (nilaiProvided) {
      parsedNilai = parseNullableNumber(nilai, "nilai", {
        allowUndefined: true,
      });
      if (parsedNilai != null) {
        if (parsedNilai < 0 || parsedNilai > 100) {
          throw httpError(400, "nilai harus berada dalam rentang 0-100");
        }
        parsedNilai = Math.round(parsedNilai);
      }
    }

    if (parsedUseManual === true) {
      if (parsedNilai == null) {
        if (!nilaiProvided && score.nilai != null) {
          // keep existing manual value
        } else {
          throw httpError(
            400,
            "nilai wajib diisi saat menggunakan nilai manual"
          );
        }
      } else {
        data.nilai = parsedNilai;
      }
    } else if (parsedUseManual === false) {
      data.nilai = null;
    } else if (nilaiProvided) {
      if (score.useManualNilai) {
        if (parsedNilai == null) {
          throw httpError(
            400,
            "nilai wajib diisi saat menggunakan nilai manual"
          );
        }
        data.nilai = parsedNilai;
      } else {
        data.nilai = null;
      }
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

    const updated = await prisma.score.update({
      where: { id },
      data,
    });

    res.json(updated);
  })
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
  asyncHandler(async (req, res) => {
    const eventId = parsePositiveInt(req.query.eventId, "eventId");
    const pesertaId = parsePositiveInt(req.query.pesertaId, "pesertaId");

    await ensureOperatorEventAccess(
      req.user,
      eventId,
      "Operator hanya boleh menghapus score pada event fokus"
    );

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
  })
);

/**
 * DELETE /api/scores/:id
 * Role: admin, operator
 * - otomatis menghapus ScoreDetail karena relasi onDelete default
 */
router.delete(
  "/:id",
  auth,
  requireRole("admin", "operator"),
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);

    if (req.user.role === "operator") {
      const score = await prisma.score.findUnique({
        where: { id },
        select: { eventId: true },
      });

      if (!score) {
        throw httpError(404, "Score tidak ditemukan");
      }

      await ensureOperatorEventAccess(
        req.user,
        score.eventId,
        "Operator hanya boleh menghapus score pada event fokus"
      );
    }

    await prisma.score.delete({
      where: { id },
    });

    res.json({ message: "Score berhasil dihapus" });
  })
);

module.exports = router;
