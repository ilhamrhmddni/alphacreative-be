const express = require("express");
const prisma = require("../lib/prisma");
const asyncHandler = require("../utils/async-handler");
const { parsePositiveInt, parseOptionalPositiveInt } = require("../utils/parsers");

const router = express.Router();
const MERCH_WHATSAPP_KEY = "merch.whatsapp";

function readNumberEnv(name, fallback, min) {
  const raw = Number(process.env[name]);
  if (Number.isFinite(raw)) {
    if (typeof min === "number" && raw < min) {
      return fallback;
    }
    return raw;
  }
  return fallback;
}

const EVENTS_QUERY_LIMIT = readNumberEnv("PUBLIC_LANDING_EVENTS_LIMIT", 8, 1);
const EVENTS_SECTION_LIMIT = readNumberEnv("PUBLIC_LANDING_EVENTS_SECTION_LIMIT", 4, 1);
const NEWS_QUERY_LIMIT = readNumberEnv("PUBLIC_LANDING_NEWS_LIMIT", 4, 1);
const NEWS_EXCERPT_LENGTH = readNumberEnv("PUBLIC_LANDING_NEWS_EXCERPT", 160, 40);
const HEADLINE_EXCERPT_LENGTH = readNumberEnv("PUBLIC_LANDING_HEADLINE_EXCERPT", 220, 60);
const CHAMPIONS_QUERY_LIMIT = readNumberEnv("PUBLIC_LANDING_CHAMPIONS_LIMIT", 4, 1);
const MERCHANDISE_LIMIT = readNumberEnv("PUBLIC_LANDING_MERCH_LIMIT", 6, 1);
const GALLERY_QUERY_LIMIT = readNumberEnv("PUBLIC_LANDING_GALLERY_LIMIT", 10, 1);
const COLLABORATION_LIMIT = readNumberEnv("PUBLIC_LANDING_COLLABORATION_LIMIT", 12, 1);
const SPONSOR_LIMIT = readNumberEnv("PUBLIC_LANDING_SPONSOR_LIMIT", 12, 1);

function normalizeStatus(status) {
  if (!status) return "upcoming";
  return String(status).toLowerCase();
}

function mapEventCard(event) {
  const categories = Array.isArray(event?.categories)
    ? event.categories.map((category) => {
        const participantCount = category._count?.peserta || 0;
        const quota = category.quota != null ? Number(category.quota) : null;
        const remaining = quota != null ? Math.max(quota - participantCount, 0) : null;
        return {
          id: category.id,
          name: category.name,
          description: category.description,
          quota,
          participantCount,
          remaining,
        };
      })
    : [];

  const categoryLabel = categories.length
    ? categories.map((category) => category.name).join(", ")
    : "Event Lainnya";

  return {
    id: event.id,
    name: event.namaEvent,
    description: event.deskripsiEvent,
    date: event.tanggalEvent,
    location: event.tempatEvent,
    venue: event.venue,
    status: normalizeStatus(event.status),
    category: categoryLabel,
    categories,
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
    categories: mapped.categories,
    participantCount: mapped.participantCount,
    cover: mapped.cover,
    isFeatured: mapped.isFeatured,
    stats: {
      participantCount: event._count?.peserta || 0,
    },
  };
}

router.get(
  "/landing",
  asyncHandler(async (req, res) => {
    const [
      eventCards,
      categoryGroups,
      newsItems,
      merchandiseItems,
      merchandiseContactSetting,
      championItems,
      galleryItems,
      collaborationItems,
      sponsorItems,
      totalEvents,
      activeEvents,
      totalTeams,
      individualMembers,
    ] = await Promise.all([
      prisma.event.findMany({
        orderBy: [{ isFeatured: "desc" }, { tanggalEvent: "asc" }],
        take: EVENTS_QUERY_LIMIT,
        include: {
          _count: { select: { peserta: true } },
          categories: {
            orderBy: { name: "asc" },
            include: {
              _count: { select: { peserta: true } },
            },
          },
        },
      }),
      prisma.eventCategory.findMany({
        include: {
          _count: { select: { peserta: true } },
        },
      }),
      prisma.berita.findMany({
        orderBy: { tanggal: "desc" },
        take: NEWS_QUERY_LIMIT,
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
      prisma.merchandise.findMany({
        where: { isPublished: true },
        orderBy: [{ productCode: "asc" }, { createdAt: "desc" }],
        take: MERCHANDISE_LIMIT,
      }),
      prisma.appSetting.findUnique({ where: { key: MERCH_WHATSAPP_KEY } }),
      prisma.juara.findMany({
        orderBy: { createdAt: "desc" },
        take: CHAMPIONS_QUERY_LIMIT,
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
      prisma.galleryItem.findMany({
        where: { isPublished: true },
        orderBy: [{ order: "asc" }, { createdAt: "desc" }],
        take: GALLERY_QUERY_LIMIT,
      }),
      prisma.partnership.findMany({
        where: { isPublished: true, type: "collaboration" },
        orderBy: [{ order: "asc" }, { createdAt: "desc" }],
        take: COLLABORATION_LIMIT,
      }),
      prisma.partnership.findMany({
        where: { isPublished: true, type: "sponsorship" },
        orderBy: [{ order: "asc" }, { createdAt: "desc" }],
        take: SPONSOR_LIMIT,
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

    const heroEventRaw =
      eventCards.find((event) => !!event.isFeatured) ||
      eventCards.find((event) => (event.status || "").toLowerCase() === "open") ||
      eventCards.find((event) => (event.status || "").toLowerCase() === "ongoing") ||
      eventCards[0] ||
      null;

    const heroEvent = summarizeHeroEvent(heroEventRaw);

    const categoryStatsMap = new Map();
    categoryGroups.forEach((category) => {
      const key = category.name || "Event Lainnya";
      const existing = categoryStatsMap.get(key) || {
        name: key,
        totalEvents: 0,
        totalTeams: 0,
      };

      existing.totalEvents += 1;
      existing.totalTeams += category._count?.peserta || 0;

      categoryStatsMap.set(key, existing);
    });

    const categories = Array.from(categoryStatsMap.values())
      .map((item) => ({
        name: item.name,
        total: item.totalEvents,
        teams: item.totalTeams,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 4);

    const news = newsItems.map((item) => ({
      id: item.id,
      title: item.title,
      excerpt: item.deskripsi?.slice(0, NEWS_EXCERPT_LENGTH) || "",
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

    const merchandise = merchandiseItems.map((item) => ({
      id: item.id,
      name: item.name,
      productCode: item.productCode,
      description: item.description || "",
      price: item.price ?? null,
      stock: item.stock ?? null,
      photoPath: item.photoPath || null,
    }));
    const merchandiseContact = {
      whatsappNumber: merchandiseContactSetting?.value || null,
    };

    const headlineRaw = newsItems.find((item) => item.photoPath) || newsItems[0] || null;
    const headlineNews = headlineRaw
      ? {
          id: headlineRaw.id,
          title: headlineRaw.title,
          date: headlineRaw.tanggal,
          excerpt: headlineRaw.deskripsi?.slice(0, HEADLINE_EXCERPT_LENGTH) || "",
          photoPath: headlineRaw.photoPath || null,
          category: (headlineRaw.tags && headlineRaw.tags[0]) || null,
        }
      : null;

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
      category: item.kategori || null,
    }));

    const gallery = galleryItems.map((item) => ({
      id: item.id,
      title: item.title,
      caption: item.caption || null,
      photoPath: item.photoPath,
      order: item.order,
    }));

    const mapPartnership = (item) => ({
      id: item.id,
      name: item.name,
      role: item.role || "",
      description: item.description || "",
      logo: item.logoPath || null,
      order: item.order,
    });

    const collaborations = collaborationItems.map(mapPartnership);
    const sponsors = sponsorItems.map(mapPartnership);

    res.json({
      heroEvent,
      events: mappedEvents.slice(0, EVENTS_SECTION_LIMIT),
      categories,
      news,
      headlineNews,
      merchandise,
      merchandiseContact,
      champions,
      gallery,
      collaborations,
      sponsors,
      stats: {
        totalEvents,
        activeEvents,
        registeredTeams: totalTeams,
        individualMembers,
      },
    });
  })
);

router.get(
  "/gallery",
  asyncHandler(async (req, res) => {
    let limit;
    const limitParam = parseOptionalPositiveInt(req.query.limit, "limit");
    if (limitParam !== undefined) {
      limit = Math.min(limitParam, 100);
    }

    const items = await prisma.galleryItem.findMany({
      where: { isPublished: true },
      orderBy: [{ order: "asc" }, { createdAt: "desc" }],
      take: limit,
    });

    const data = items.map((item) => ({
      id: item.id,
      title: item.title,
      caption: item.caption || null,
      photoPath: item.photoPath,
      order: item.order,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    }));

    res.json({ data });
  })
);

router.get(
  "/champions",
  asyncHandler(async (req, res) => {
    const pageParam = parseOptionalPositiveInt(req.query.page, "page");
    const limitParam = parseOptionalPositiveInt(req.query.limit, "limit");

    const page = pageParam ?? 1;
    const limit = Math.min(limitParam ?? 10, 100);

    const where = {};
    if (req.query.eventId !== undefined) {
      where.eventId = parsePositiveInt(req.query.eventId, "eventId");
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
  })
);

module.exports = router;
