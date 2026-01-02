// src/routes/upload.routes.js
const express = require("express");
const path = require("path");
const crypto = require("crypto");
const fs = require("fs/promises");
const sharp = require("sharp");
const prisma = require("../lib/prisma");
const { auth, requireRole } = require("../middleware/auth");

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

function moveFile(file, destination) {
  return new Promise((resolve, reject) => {
    file.mv(destination, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

function shouldForceWebp() {
  return (process.env.UPLOAD_FORCE_WEBP || "true").toLowerCase() !== "false";
}

function getWebpQuality() {
  const raw = Number(process.env.UPLOAD_WEBP_QUALITY || "82");
  if (Number.isFinite(raw) && raw >= 40 && raw <= 100) {
    return Math.round(raw);
  }
  return 82;
}

const router = express.Router();

function getUploadsRoot() {
  return process.env.UPLOAD_ROOT
    ? path.resolve(process.env.UPLOAD_ROOT)
    : path.join(__dirname, "..", "..", "uploads");
}

function getAllowedMime() {
  return (process.env.UPLOAD_ALLOWED_MIME || "image/jpeg,image/png,image/webp")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function getMaxBytes() {
  const maxMb = Number(process.env.UPLOAD_MAX_MB || "5");
  return Math.max(1, maxMb) * 1024 * 1024;
}

async function storeFile({ file, folderName, req, res }) {
  const maxBytes = getMaxBytes();
  if (file.size > maxBytes) {
    return res.status(413).json({
      message: `Ukuran file melebihi batas ${Math.round(maxBytes / (1024 * 1024))}MB`,
    });
  }

  const allowedMime = getAllowedMime();
  if (allowedMime.length && !allowedMime.includes(file.mimetype)) {
    return res.status(400).json({
      message: "Format file tidak didukung",
      allowed: allowedMime,
    });
  }

  const uploadsRoot = getUploadsRoot();
  const targetDir = path.join(uploadsRoot, folderName);
  await ensureDir(targetDir);

  const originalExt = (path.extname(file.name) || ".jpg").toLowerCase();
  const baseName = `${Date.now()}-${crypto.randomUUID()}`;
  const forceWebp = shouldForceWebp();
  const targetExt = forceWebp ? ".webp" : originalExt;
  const targetFileName = `${baseName}${targetExt}`;
  const destination = path.join(targetDir, targetFileName);

  let finalDestination = destination;
  let finalExt = targetExt;
  let finalMime = forceWebp ? "image/webp" : file.mimetype;

  try {
    if (forceWebp && file.tempFilePath) {
      await sharp(file.tempFilePath)
        .rotate()
        .webp({ quality: getWebpQuality() })
        .toFile(destination);
    } else {
      await moveFile(file, destination);
    }
  } catch (conversionError) {
    console.warn("WebP conversion failed, using original file:", conversionError);
    finalExt = originalExt;
    finalMime = file.mimetype;
    finalDestination = path.join(targetDir, `${baseName}${finalExt}`);
    await moveFile(file, finalDestination);
  }

  const baseUrl = process.env.FILE_BASE_URL || `${req.protocol}://${req.get("host")}`;
  const relativePath = path
    .posix.join("/uploads", folderName, `${baseName}${finalExt}`)
    .replace(/\\/g, "/");

  const stats = await fs.stat(finalDestination).catch(() => null);

  return {
    success: true,
    url: `${baseUrl}${relativePath}`,
    path: relativePath,
    size: stats?.size ?? file.size,
    mime: finalMime,
  };
}

router.post("/event-photo", auth, requireRole("admin", "operator"), async (req, res) => {
  try {
    if (!req.files || !req.files.file) {
      return res.status(400).json({ message: "Tidak ada file yang dikirim" });
    }

    const file = req.files.file;
    const folder = process.env.UPLOAD_EVENT_DIR || "events";
    const payload = await storeFile({ file, folderName: folder, req, res });
    if (payload && payload.success) {
      return res.json(payload);
    }
  } catch (err) {
    console.error("Upload error:", err);
    return res.status(500).json({ message: "Gagal upload foto" });
  }
});

router.post("/news-photo", auth, requireRole("admin", "operator"), async (req, res) => {
  try {
    if (!req.files || !req.files.file) {
      return res.status(400).json({ message: "Tidak ada file yang dikirim" });
    }

    const file = req.files.file;
    const folder = process.env.UPLOAD_NEWS_DIR || "news";
    const payload = await storeFile({ file, folderName: folder, req, res });
    if (payload && payload.success) {
      return res.json(payload);
    }
  } catch (err) {
    console.error("Upload berita error:", err);
    return res.status(500).json({ message: "Gagal upload foto berita" });
  }
});

router.post("/merch-photo", auth, requireRole("admin", "operator"), async (req, res) => {
  try {
    if (!req.files || !req.files.file) {
      return res.status(400).json({ message: "Tidak ada file yang dikirim" });
    }

    const file = req.files.file;
    const folder = process.env.UPLOAD_MERCH_DIR || "merchandise";
    const payload = await storeFile({ file, folderName: folder, req, res });
    if (payload && payload.success) {
      return res.json(payload);
    }
  } catch (err) {
    console.error("Upload merchandise error:", err);
    return res.status(500).json({ message: "Gagal upload foto merchandise" });
  }
});

router.post("/gallery-photo", auth, requireRole("admin", "operator"), async (req, res) => {
  try {
    if (!req.files || !req.files.file) {
      return res.status(400).json({ message: "Tidak ada file yang dikirim" });
    }

    const file = req.files.file;
    const folder = process.env.UPLOAD_GALLERY_DIR || "gallery";
    const payload = await storeFile({ file, folderName: folder, req, res });
    if (payload && payload.success) {
      return res.json(payload);
    }
  } catch (err) {
    console.error("Upload galeri error:", err);
    return res.status(500).json({ message: "Gagal upload foto galeri" });
  }
});

router.post("/partner-logo", auth, requireRole("admin", "operator"), async (req, res) => {
  try {
    if (!req.files || !req.files.file) {
      return res.status(400).json({ message: "Tidak ada file yang dikirim" });
    }

    const file = req.files.file;
    const folder = process.env.UPLOAD_PARTNER_DIR || "partners";
    const payload = await storeFile({ file, folderName: folder, req, res });
    if (payload && payload.success) {
      return res.json(payload);
    }
  } catch (err) {
    console.error("Upload partner logo error:", err);
    return res.status(500).json({ message: "Gagal upload logo" });
  }
});

router.post("/profile-photo", auth, async (req, res) => {
  try {
    if (!req.files || !req.files.file) {
      return res.status(400).json({ message: "Tidak ada file yang dikirim" });
    }

    const file = req.files.file;
    const folder = process.env.UPLOAD_PROFILE_DIR || "profiles";
    const payload = await storeFile({ file, folderName: folder, req, res });

    if (!payload || !payload.success) {
      return; // response already handled by storeFile when validation failed
    }

    if (req.body.assignToUser !== "false" && req.user?.id) {
      try {
        await prisma.user.update({
          where: { id: req.user.id },
          data: { profilePhotoPath: payload.path },
        });
        payload.profileUpdated = true;
      } catch (updateErr) {
        console.warn("Gagal memperbarui foto profil user:", updateErr);
      }
    }

    return res.json(payload);
  } catch (err) {
    console.error("Upload profile error:", err);
    return res.status(500).json({ message: "Gagal upload foto profil" });
  }
});

module.exports = router;
