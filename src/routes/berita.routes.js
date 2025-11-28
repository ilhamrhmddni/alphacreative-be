const express = require("express");
const prisma = require("../lib/prisma");
const { httpError, parseId } = require("../error");
const { auth, requireRole } = require("../middleware/auth");

const router = express.Router();

const beritaInclude = {
  event: {
    select: {
      id: true,
      namaEvent: true,
      tanggalEvent: true,
      tempatEvent: true,
    },
  },
};

function parseEventId(value) {
  if (value === undefined) return undefined;
  if (value === null || value === "" || value === "none") return null;
  const parsed = Number(value);
  if (Number.isNaN(parsed)) {
    throw httpError(400, "eventId tidak valid");
  }
  return parsed;
}

function normalizeTags(tags) {
  if (!tags) return [];
  if (!Array.isArray(tags)) return [];
  const normalized = tags
    .map((tag) => (typeof tag === "string" ? tag.trim() : ""))
    .filter((tag) => tag.length > 0);
  return Array.from(new Set(normalized));
}

async function ensureEventExists(eventId) {
  if (eventId == null) return;
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true },
  });
  if (!event) {
    throw httpError(404, "Event tidak ditemukan");
  }
}

// GET /api/berita
router.get("/", async (req, res, next) => {
  try {
    // Support query params: page, limit, q (search), tag, eventId
    const { eventId, q, tag } = req.query;
    let page = Number(req.query.page || 1);
    let limit = Number(req.query.limit || 10);
    if (Number.isNaN(page) || page < 1) page = 1;
    if (Number.isNaN(limit) || limit < 1 || limit > 100) limit = 10;

    const where = {};
    if (eventId) {
      where.eventId = parseEventId(eventId);
    }
    if (q) {
      where.OR = [
        { title: { contains: String(q), mode: "insensitive" } },
        { deskripsi: { contains: String(q), mode: "insensitive" } },
      ];
    }
    if (tag) {
      // filter berita that have the tag in the tags string array
      where.tags = { has: String(tag) };
    }

    const total = await prisma.berita.count({ where });
    const berita = await prisma.berita.findMany({
      where,
      orderBy: { tanggal: "desc" },
      include: beritaInclude,
      skip: (page - 1) * limit,
      take: limit,
    });

    res.json({ data: berita, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } });
  } catch (err) {
    next(err);
  }
});

// GET /api/berita/:id → admin & peserta boleh
router.get("/:id", async (req, res, next) => {
  try {
    const id = parseId(req.params.id);

    const item = await prisma.berita.findUnique({
      where: { id },
      include: beritaInclude,
    });

    if (!item) {
      throw httpError(404, "Berita tidak ditemukan");
    }

    res.json(item);
  } catch (err) {
    next(err);
  }
});

// POST /api/berita → hanya admin
router.post("/", auth, requireRole("admin","operator"), async (req, res, next) => {
  try {
    const { title, photoPath, deskripsi, tanggal, eventId, tags } = req.body;

    if (!title || !deskripsi || !tanggal || !eventId) {
      throw httpError(400, "title, deskripsi, tanggal, eventId wajib diisi");
    }

    const parsedEventId = parseEventId(eventId);
    if (parsedEventId == null) {
      throw httpError(400, "eventId tidak valid");
    }
    await ensureEventExists(parsedEventId);
    const normalizedTags = normalizeTags(tags);

    const created = await prisma.berita.create({
      data: {
        title,
        photoPath: photoPath ?? null,
        deskripsi,
        tanggal: new Date(tanggal),
        eventId: parsedEventId,
        tags: normalizedTags,
      },
      include: beritaInclude,
    });

    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
});

// PUT /api/berita/:id → hanya admin
router.put("/:id", auth, requireRole("admin","operator"), async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    const { title, photoPath, deskripsi, tanggal, eventId, tags } = req.body;

    let parsedEventId;
    if (eventId !== undefined) {
      parsedEventId = parseEventId(eventId);
      if (parsedEventId != null) {
        await ensureEventExists(parsedEventId);
      }
    }

    const normalizedTags = tags !== undefined ? normalizeTags(tags) : undefined;

    const updated = await prisma.berita.update({
      where: { id },
      data: {
        title,
        photoPath: photoPath ?? null,
        deskripsi,
        tanggal: tanggal ? new Date(tanggal) : undefined,
        ...(eventId !== undefined ? { eventId: parsedEventId ?? null } : {}),
        ...(normalizedTags !== undefined ? { tags: normalizedTags } : {}),
      },
      include: beritaInclude,
    });

    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/berita/:id → hanya admin
router.delete("/:id", auth, requireRole("admin","operator"), async (req, res, next) => {
  try {
    const id = parseId(req.params.id);

    await prisma.berita.delete({
      where: { id },
    });

    res.json({ message: "Berita berhasil dihapus" });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
