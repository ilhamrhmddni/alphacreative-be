const express = require("express");
const prisma = require("../lib/prisma");

const router = express.Router();

function normalizeStatus(status) {
  if (!status) return "upcoming";
  return String(status).toLowerCase();
}

function mapEventCard(event) {
  return {
    id: event.id,
    name: event.namaEvent,
    description: event.deskripsiEvent,
    date: event.tanggalEvent,
    location: event.tempatEvent,
    venue: event.venue,
    status: normalizeStatus(event.status),
    category: event.kategori || "Event Lainnya",
    participantCount: event._count?.peserta || 0,
    cover: event.photoPath || null,
    isFeatured: !!event.isFeatured,
  };
}

function summarizeHeroEvent(event) {
  if (!event) return null;
  const mapped = mapEventCard(event);
  return {
    id: mapped.id,
    name: mapped.name,
    description: mapped.description,
    date: mapped.date,
    location: mapped.location,
    venue: mapped.venue,
    status: mapped.status,
    category: mapped.category,
    participantCount: mapped.participantCount,
    cover: mapped.cover,
    isFeatured: mapped.isFeatured,
    stats: {
      participantCount: event._count?.peserta || 0,
    },
  };
}

router.get("/landing", async (req, res) => {
  try {
    const [
      eventCards,
      categoryGroups,
      newsItems,
      championItems,
      totalEvents,
      activeEvents,
      totalTeams,
      individualMembers,
    ] = await Promise.all([
      prisma.event.findMany({
        orderBy: [{ isFeatured: "desc" }, { tanggalEvent: "asc" }],
        take: 8,
        include: {
          _count: { select: { peserta: true } },
        },
      }),
      prisma.event.groupBy({
        by: ["kategori"],
        _count: { _all: true },
      }),
      prisma.berita.findMany({
        orderBy: { tanggal: "desc" },
        take: 4,
        include: {
          event: {
            select: {
              id: true,
              namaEvent: true,
              tanggalEvent: true,
            },
          },
        },
      }),
      prisma.juara.findMany({
        orderBy: { createdAt: "desc" },
        take: 4,
        include: {
          event: {
            select: {
              id: true,
              namaEvent: true,
              tanggalEvent: true,
            },
          },
          peserta: {
            select: {
              namaTim: true,
            },
          },
        },
      }),
      prisma.event.count(),
      prisma.event.count({
        where: {
          status: {
            in: ["open", "ongoing", "Open", "Ongoing"],
          },
        },
      }),
      prisma.peserta.count(),
      prisma.detailPeserta.count(),
    ]);

    const mappedEvents = eventCards.map(mapEventCard);

    // Pilih hero dari raw eventCards SEBELUM di-map, jadi field asli tanggalEvent tetap ada
    const heroEventRaw =
      eventCards.find((event) => !!event.isFeatured) ||
      eventCards.find((event) => (event.status || "").toLowerCase() === "open") ||
      eventCards.find((event) => (event.status || "").toLowerCase() === "ongoing") ||
      eventCards[0] ||
      null;

    const heroEvent = summarizeHeroEvent(heroEventRaw);

    const categories = categoryGroups
      .map((group) => ({
        name: group.kategori || "Event Lainnya",
        total: group._count._all,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 4);

    const news = newsItems.map((item) => ({
      id: item.id,
      title: item.title,
      excerpt: item.deskripsi?.slice(0, 160) || "",
      date: item.tanggal,
      category: (item.tags && item.tags[0]) || "Pengumuman",
      tags: item.tags || [],
      photoPath: item.photoPath || null,
      event: item.event
        ? {
            id: item.event.id,
            name: item.event.namaEvent,
            date: item.event.tanggalEvent,
          }
        : null,
    }));

    const champions = championItems.map((item) => ({
      id: item.id,
      rank: item.juara,
      team: item.peserta?.namaTim || "-",
      event: item.event
        ? {
            id: item.event.id,
            name: item.event.namaEvent,
            date: item.event.tanggalEvent,
          }
        : null,
      category: item.kategori || "Kompetisi",
    }));

    res.json({
      heroEvent: heroEvent,
      events: mappedEvents.slice(0, 4),
      categories,
      news,
      champions,
      stats: {
        totalEvents,
        activeEvents,
        registeredTeams: totalTeams,
        individualMembers,
      },
    });
  } catch (err) {
    console.error("GET /public/landing error:", err);
    res
      .status(500)
      .json({ message: "Gagal mengambil data landing", error: err.message });
  }
});

router.get("/champions", async (req, res) => {
  try {
    let page = Number(req.query.page || 1);
    let limit = Number(req.query.limit || 10);
    if (Number.isNaN(page) || page < 1) page = 1;
    if (Number.isNaN(limit) || limit < 1 || limit > 100) limit = 10;

    const where = {};
    if (req.query.eventId) {
      const eventId = Number(req.query.eventId);
      if (Number.isNaN(eventId)) {
        return res.status(400).json({ message: "eventId tidak valid" });
      }
      where.eventId = eventId;
    }

    const total = await prisma.juara.count({ where });
    const items = await prisma.juara.findMany({
      where,
      orderBy: [
        { createdAt: "desc" },
        { id: "desc" },
      ],
      include: {
        event: {
          select: {
            id: true,
            namaEvent: true,
            tanggalEvent: true,
            tempatEvent: true,
          },
        },
        peserta: {
          select: {
            id: true,
            namaTim: true,
            noPeserta: true,
          },
        },
      },
      skip: (page - 1) * limit,
      take: limit,
    });

    const data = items.map((item) => ({
      id: item.id,
      rank: item.juara,
      category: item.kategori || "LKBB",
      evidence: item.berkasLink || null,
      updatedAt: item.updatedAt,
      event: item.event
        ? {
            id: item.event.id,
            name: item.event.namaEvent,
            date: item.event.tanggalEvent,
            location: item.event.tempatEvent,
          }
        : null,
      team: item.peserta
        ? {
            id: item.peserta.id,
            name: item.peserta.namaTim,
            number: item.peserta.noPeserta,
          }
        : null,
    }));

    res.json({
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (err) {
    console.error("GET /public/champions error:", err);
    res.status(500).json({ message: "Gagal mengambil data juara", error: err.message });
  }
});

module.exports = router;
