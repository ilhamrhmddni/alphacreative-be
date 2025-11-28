// src/routes/events.routes.js
const express = require("express");
const router = express.Router();

const { auth, requireRole } = require("../middleware/auth");
const prisma = require("../lib/prisma");

// GET /api/events
router.get("/", async (req, res) => {
  try {
    const events = await prisma.event.findMany({
      orderBy: { id: "desc" },
    });
    res.json(events);
  } catch (err) {
    console.error("GET /events error:", err);
    res.status(500).json({ message: "Gagal mengambil data event" });
  }
});

// GET /api/events/:id
router.get("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ message: "ID tidak valid" });
    }

    const event = await prisma.event.findUnique({
      where: { id },
    });

    if (!event) {
      return res.status(404).json({ message: "Event tidak ditemukan" });
    }

    res.json(event);
  } catch (err) {
    console.error("GET /events/:id error:", err);
    res.status(500).json({ message: "Gagal mengambil data event" });
  }
});

// POST /api/events  -> admin & operator
router.post(
  "/",
  auth,
  requireRole("admin"),
  async (req, res) => {
    try {
      const {
        namaEvent,
        deskripsiEvent,
        tanggalEvent,
        tempatEvent,
        venue,
        status,
        kategori,
        photoPath,
        kuota,
        biaya,
      } = req.body;

      if (!namaEvent || !tanggalEvent || !tempatEvent) {
        return res.status(400).json({
          message: "namaEvent, tanggalEvent, dan tempatEvent wajib diisi",
        });
      }

      const parsedKuota =
        kuota === "" || kuota === null || kuota === undefined
          ? null
          : Number(kuota);

      const parsedBiaya =
        biaya === "" || biaya === null || biaya === undefined
          ? null
          : Number(biaya);

      if (
        (parsedKuota !== null && Number.isNaN(parsedKuota)) ||
        (parsedBiaya !== null && Number.isNaN(parsedBiaya))
      ) {
        return res
          .status(400)
          .json({ message: "kuota/biaya harus berupa angka" });
      }

      // validasi tanggal dikit biar gak ngasih Invalid Date ke Prisma
      const dateObj = new Date(tanggalEvent);
      if (Number.isNaN(dateObj.getTime())) {
        return res.status(400).json({ message: "tanggalEvent tidak valid" });
      }

      const created = await prisma.event.create({
        data: {
          namaEvent,
          deskripsiEvent: deskripsiEvent || null,
          tempatEvent,
          venue: venue || null,
          status: status || null,
          kategori: kategori || null,
          photoPath: photoPath || null,
          kuota: parsedKuota,
          biaya: parsedBiaya,
          tanggalEvent: dateObj,
          // HAPUS createdBy kalau nggak ada di schema
          // createdBy: req.user.id ?? null,
        },
      });

      res.json(created);
    } catch (err) {
      console.error("POST /events error:", err);
      res.status(500).json({ message: "Gagal membuat event" });
    }
  }
);

// PUT /api/events/:id  -> admin & operator
router.put(
  "/:id",
  auth,
  requireRole("admin"),
  async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (Number.isNaN(id)) {
        return res.status(400).json({ message: "ID tidak valid" });
      }

      const {
        namaEvent,
        deskripsiEvent,
        tanggalEvent,
        tempatEvent,
        venue,
        status,
        kategori,
        photoPath,
        kuota,
        biaya,
      } = req.body;

      const parsedKuota =
        kuota === "" || kuota === null || kuota === undefined
          ? null
          : Number(kuota);

      const parsedBiaya =
        biaya === "" || biaya === null || biaya === undefined
          ? null
          : Number(biaya);

      if (
        (parsedKuota !== null && Number.isNaN(parsedKuota)) ||
        (parsedBiaya !== null && Number.isNaN(parsedBiaya))
      ) {
        return res
          .status(400)
          .json({ message: "kuota/biaya harus berupa angka" });
      }

      let tanggalUpdate;
      if (tanggalEvent) {
        const dateObj = new Date(tanggalEvent);
        if (Number.isNaN(dateObj.getTime())) {
          return res.status(400).json({ message: "tanggalEvent tidak valid" });
        }
        tanggalUpdate = dateObj;
      }

      const updated = await prisma.event.update({
        where: { id },
        data: {
          namaEvent,
          deskripsiEvent: deskripsiEvent || null,
          tempatEvent,
          venue: venue || null,
          status: status || null,
          kategori: kategori || null,
          photoPath: photoPath || null,
          kuota: parsedKuota,
          biaya: parsedBiaya,
          // cuma di-set kalau ada tanggalEvent
          ...(tanggalUpdate ? { tanggalEvent: tanggalUpdate } : {}),
          // HAPUS updatedBy kalau nggak ada di schema
          // updatedBy: req.user.id ?? null,
        },
      });

      res.json(updated);
} catch (err) {
  console.error("PUT /events/:id error:", err);
  return res.status(500).json({
    message: "Gagal mengupdate event",
    error: err.message,
    stack: err.stack
  });
}
  }
);

// DELETE /api/events/:id -> admin & operator
router.delete(
  "/:id",
  auth,
  requireRole("admin"),
  async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (Number.isNaN(id)) {
        return res.status(400).json({ message: "ID tidak valid" });
      }

      await prisma.event.delete({
        where: { id },
      });

      res.json({ success: true });
    } catch (err) {
      console.error("DELETE /:id error:", err);
      if (err.code === "P2025") {
        return res.status(404).json({ message: "Event tidak ditemukan" });
      }
      res.status(500).json({ message: "Gagal menghapus event" });
    }
  }
);

// POST /api/events/:id/feature -> set this event as featured (admin only)
router.post(
  "/:id/feature",
  auth,
  requireRole("admin"),
  async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (Number.isNaN(id)) {
        return res.status(400).json({ message: "ID tidak valid" });
      }

      // Unset previous featured events, then set this one
      await prisma.$transaction([
        prisma.event.updateMany({ where: { isFeatured: true }, data: { isFeatured: false } }),
        prisma.event.update({ where: { id }, data: { isFeatured: true } }),
      ]);

      res.json({ success: true });
    } catch (err) {
      console.error("POST /events/:id/feature error:", err);
      if (err.code === "P2025") {
        return res.status(404).json({ message: "Event tidak ditemukan" });
      }
      res.status(500).json({ message: "Gagal mengatur featured event" });
    }
  }
);

module.exports = router;
