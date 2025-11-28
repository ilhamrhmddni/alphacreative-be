// src/routes/upload.routes.js
const express = require("express");
const FormData = require("form-data");
const { auth, requireRole } = require("../middleware/auth");

// kalau Node kamu belum ada global fetch, pakai ini:
const fetch = (...args) =>
  import("node-fetch").then(({ default: fetchFn }) => fetchFn(...args));

const router = express.Router();

router.post("/event-photo", auth, requireRole("admin", "operator"), async (req, res) => {
  try {
    if (!req.files || !req.files.file) {
      return res.status(400).json({ message: "Tidak ada file yang dikirim" });
    }

    const apiKey = process.env.FREEIMAGE_API_KEY;
    if (!apiKey) {
      return res.status(500).json({
        message: "FREEIMAGE_API_KEY belum diset di backend (.env server)",
      });
    }

    const file = req.files.file;

    const form = new FormData();
    form.append("key", apiKey);
    form.append("action", "upload");
    form.append("format", "json"); // beberapa API perlu ini biar pasti JSON
    form.append("source", file.data, {
      filename: file.name,
      contentType: file.mimetype,
      knownLength: file.size,
    });

    const uploadRes = await fetch("https://freeimage.host/api/1/upload", {
      method: "POST",
      body: form,
      headers: form.getHeaders(),
    });

    const contentType = uploadRes.headers.get("content-type") || "";

    // Kalau status bukan 2xx → langsung log & lempar ke client
    if (!uploadRes.ok) {
      const text = await uploadRes.text();
      console.error(
        "[FreeImage ERROR STATUS]",
        uploadRes.status,
        text.slice(0, 400)
      );
      return res.status(500).json({
        message: "FreeImage.host mengembalikan error",
        status: uploadRes.status,
        bodySnippet: text.slice(0, 400),
      });
    }

    // Kalau bukan application/json → log text-nya
    if (!contentType.includes("application/json")) {
      const text = await uploadRes.text();
      console.error("[FreeImage NON-JSON RESPONSE]", text.slice(0, 400));
      return res.status(500).json({
        message: "FreeImage.host mengembalikan respons non-JSON",
        status: uploadRes.status,
        bodySnippet: text.slice(0, 400),
      });
    }

    const result = await uploadRes.json();

    if (result.status_code !== 200) {
      console.error("[FreeImage RESULT ERROR]", result);
      return res.status(500).json({
        message: "Gagal upload ke FreeImage.host",
        detail: result,
      });
    }

    const directUrl =
      result.image?.image?.url ||
      result.image?.display_url ||
      result.image?.url;

    return res.json({
      success: true,
      url: directUrl,
      deleteUrl: result.image?.delete_url,
    });
  } catch (err) {
    console.error("Upload error:", err);
    return res.status(500).json({ message: "Gagal upload foto" });
  }
});

module.exports = router;
