const express = require("express");
const prisma = require("../lib/prisma");
const { httpError, parseId } = require("../error");
const { auth, requireRole } = require("../middleware/auth");

const router = express.Router();

const WA_SETTING_KEY = "merch.whatsapp";

function sanitizeText(value) {
  if (value === undefined || value === null) return "";
  return String(value).trim();
}

function sanitizeProductCode(value) {
  const code = sanitizeText(value).replace(/\s+/g, "-");
  return code ? code.toUpperCase() : "";
}

function toNullableString(value) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const trimmed = String(value).trim();
  return trimmed.length ? trimmed : null;
}

function parseOptionalNumber(value, field) {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw httpError(400, `${field} tidak valid`);
  }
  return Math.round(parsed);
}

function parseOptionalBoolean(value, field) {
  if (value === undefined) return undefined;
  if (typeof value === "boolean") return value;
  const normalized = String(value).trim().toLowerCase();
  if (["true", "1", "yes", "ya", "on"].includes(normalized)) return true;
  if (["false", "0", "no", "tidak", "off"].includes(normalized)) return false;
  throw httpError(400, `${field} tidak valid`);
}

function normalizeWhatsapp(value) {
  const raw = sanitizeText(value);
  if (!raw) return null;
  const digits = raw.replace(/\D+/g, "");
  if (!digits) return null;
  return digits;
}

async function ensureUniqueProductCode(productCode, excludeId) {
  if (!productCode) return;
  const existing = await prisma.merchandise.findUnique({ where: { productCode } });
  if (existing && existing.id !== excludeId) {
    throw httpError(409, "Kode produk sudah digunakan");
  }
}

async function generateUniqueProductCodeFromName(name) {
  const baseFromName = sanitizeProductCode(name);
  const base = baseFromName ? baseFromName.replace(/[\d-]+$/g, "") || baseFromName : "MERCH";
  let candidate = base;
  let counter = 1;

  while (await prisma.merchandise.findUnique({ where: { productCode: candidate } })) {
    const suffix = String(counter).padStart(2, "0");
    candidate = `${base}-${suffix}`;
    counter += 1;
    if (counter > 99) {
      candidate = `${base}-${Date.now().toString(36).toUpperCase()}`;
      counter = 1;
    }
  }

  return candidate;
}

async function getWhatsappNumber() {
  const setting = await prisma.appSetting.findUnique({ where: { key: WA_SETTING_KEY } });
  return setting?.value || null;
}

async function upsertWhatsappNumber(number) {
  return prisma.appSetting.upsert({
    where: { key: WA_SETTING_KEY },
    update: { value: number },
    create: { key: WA_SETTING_KEY, value: number },
  });
}

function mapMerchandise(item) {
  if (!item) return null;
  return {
    id: item.id,
    name: item.name,
    productCode: item.productCode,
    category: item.category,
    description: item.description,
    price: item.price,
    stock: item.stock,
    photoPath: item.photoPath,
    isPublished: item.isPublished,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

// Config endpoints must come before /:id to avoid being caught as an ID route
router.get("/config", async (req, res, next) => {
  try {
    const whatsappNumber = await getWhatsappNumber();
    res.json({ whatsappNumber: whatsappNumber || "" });
  } catch (err) {
    next(err);
  }
});

router.put(
  "/config",
  auth,
  requireRole("admin", "operator"),
  async (req, res, next) => {
    try {
      const normalized = normalizeWhatsapp(req.body.whatsappNumber);
      if (normalized === null) {
        await upsertWhatsappNumber(null);
        return res.json({ whatsappNumber: "" });
      }

      if (normalized.length < 8) {
        throw httpError(400, "Nomor WhatsApp tidak valid");
      }

      await upsertWhatsappNumber(normalized);
      res.json({ whatsappNumber: normalized });
    } catch (err) {
      next(err);
    }
  }
);

router.get("/", async (req, res, next) => {
  try {
    const where = {};
    const published = parseOptionalBoolean(req.query.published, "published");
    if (published !== undefined) {
      where.isPublished = published;
    }

    const q = sanitizeText(req.query.q);
    if (q) {
      where.OR = [
        { name: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
      ];
    }

    const category = sanitizeText(req.query.category);
    if (category) {
      where.category = category;
    }

    let page = Number(req.query.page || 1);
    if (!Number.isFinite(page) || page < 1) page = 1;
    let limit = Number(req.query.limit || 50);
    if (!Number.isFinite(limit) || limit < 1) limit = 50;
    limit = Math.min(limit, 100);

    const skip = (page - 1) * limit;

    const [total, items, whatsappNumber] = await Promise.all([
      prisma.merchandise.count({ where }),
      prisma.merchandise.findMany({
        where,
        orderBy: [{ createdAt: "desc" }],
        skip,
        take: limit,
      }),
      getWhatsappNumber(),
    ]);

    res.json({
      data: items.map(mapMerchandise),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
      contact: {
        whatsappNumber: whatsappNumber || null,
      },
    });
  } catch (err) {
    next(err);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    const [item, whatsappNumber] = await Promise.all([
      prisma.merchandise.findUnique({ where: { id } }),
      getWhatsappNumber(),
    ]);
    if (!item) {
      throw httpError(404, "Merchandise tidak ditemukan");
    }
    res.json({
      ...mapMerchandise(item),
      whatsappNumber: whatsappNumber || null,
    });
  } catch (err) {
    next(err);
  }
});

router.post("/", auth, requireRole("admin", "operator"), async (req, res, next) => {
  try {
    const name = sanitizeText(req.body.name);
    if (!name) {
      throw httpError(400, "Nama merchandise wajib diisi");
    }

    const productCode = sanitizeProductCode(req.body.productCode);
    if (!productCode) {
      throw httpError(400, "Kode produk wajib diisi");
    }
    await ensureUniqueProductCode(productCode);

    const category = toNullableString(req.body.category) ?? null;
    const description = toNullableString(req.body.description) ?? null;
    const price = parseOptionalNumber(req.body.price, "price");
    if (price !== undefined && price !== null && price < 0) {
      throw httpError(400, "price tidak boleh negatif");
    }
    const stock = parseOptionalNumber(req.body.stock, "stock");
    if (stock !== undefined && stock !== null && stock < 0) {
      throw httpError(400, "stock tidak boleh negatif");
    }
    const isPublished = parseOptionalBoolean(req.body.isPublished, "isPublished");

    const created = await prisma.merchandise.create({
      data: {
        name,
        productCode,
        category,
        description,
        price: price ?? null,
        stock: stock ?? null,
        photoPath: toNullableString(req.body.photoPath) ?? null,
        isPublished: isPublished ?? true,
        createdBy: req.user?.id ?? null,
        updatedBy: req.user?.id ?? null,
      },
    });

    res.status(201).json(mapMerchandise(created));
  } catch (err) {
    next(err);
  }
});

router.put("/:id", auth, requireRole("admin", "operator"), async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    const existing = await prisma.merchandise.findUnique({ where: { id } });
    if (!existing) {
      throw httpError(404, "Merchandise tidak ditemukan");
    }
    const data = {};

    if (req.body.name !== undefined) {
      const name = sanitizeText(req.body.name);
      if (!name) {
        throw httpError(400, "Nama merchandise wajib diisi");
      }
      data.name = name;
    }

    if (req.body.productCode !== undefined) {
      const productCode = sanitizeProductCode(req.body.productCode);
      if (!productCode) {
        throw httpError(400, "Kode produk tidak boleh kosong");
      }
      await ensureUniqueProductCode(productCode, id);
      data.productCode = productCode;
    }

    if (req.body.category !== undefined) {
      data.category = toNullableString(req.body.category) ?? null;
    }

    if (req.body.description !== undefined) {
      data.description = toNullableString(req.body.description) ?? null;
    }

    if (req.body.price !== undefined) {
      const price = parseOptionalNumber(req.body.price, "price");
      if (price !== null && price < 0) {
        throw httpError(400, "price tidak boleh negatif");
      }
      data.price = price;
    }

    if (req.body.stock !== undefined) {
      const stock = parseOptionalNumber(req.body.stock, "stock");
      if (stock !== null && stock < 0) {
        throw httpError(400, "stock tidak boleh negatif");
      }
      data.stock = stock;
    }

    if (req.body.photoPath !== undefined) {
      data.photoPath = toNullableString(req.body.photoPath) ?? null;
    }

    if (req.body.isPublished !== undefined) {
      data.isPublished = parseOptionalBoolean(req.body.isPublished, "isPublished");
    }

    data.updatedBy = req.user?.id ?? null;

    const updated = await prisma.merchandise.update({
      where: { id },
      data,
    });

    res.json(mapMerchandise(updated));
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", auth, requireRole("admin", "operator"), async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    await prisma.merchandise.delete({ where: { id } });
    res.json({ message: "Merchandise berhasil dihapus" });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
