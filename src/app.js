const express = require("express");
const cors = require("cors");
const fileUpload = require("express-fileupload");
const path = require("path");
const fs = require("fs");
const { auth, requireRole } = require("./middleware/auth");
const { globalErrorHandler } = require("./error");

// Routes
const authRoutes = require("./routes/auth.routes");
const userRoutes = require("./routes/user.routes");
const eventRoutes = require("./routes/event.routes");
const eventCategoryRoutes = require("./routes/eventCategory.routes");
const pesertaRoutes = require("./routes/peserta.routes");
const detailPesertaRoutes = require("./routes/detailPeserta.routes");
const beritaRoutes = require("./routes/berita.routes");
const merchandiseRoutes = require("./routes/merchandise.routes");
const juaraRoutes = require("./routes/juara.routes");
const partisipasiRoutes = require("./routes/partisipasi.routes");
const uploadRoutes = require("./routes/upload.routes");
const landingRoutes = require("./routes/public.routes");
const galleryRoutes = require("./routes/gallery.routes");
const partnershipRoutes = require("./routes/partnership.routes");

const app = express();

// Proxy & directories setup
if ((process.env.TRUST_PROXY || "").toLowerCase() === "true") app.set("trust proxy", 1);

const uploadsDir = path.join(__dirname, "..", "uploads");
const tempDir = path.join(__dirname, "..", ".tmp");
[uploadsDir, tempDir].forEach(d => !fs.existsSync(d) && fs.mkdirSync(d, { recursive: true }));

// CORS & middleware setup
const maxUploadBytes = Math.max(1, (Number(process.env.UPLOAD_MAX_MB || "5"))) * 1024 * 1024;
const rawCorsOrigins = process.env.CORS_ALLOWED_ORIGINS || "*";
const corsOptions = rawCorsOrigins === "*" 
  ? { origin: true, credentials: true }
  : {
      origin: (origin, cb) => {
        const allowed = rawCorsOrigins.split(",").map(o => o.trim()).filter(Boolean);
        cb(null, !origin || allowed.includes(origin) ? null : new Error("CORS denied"));
      },
      credentials: true
    };

app.use(cors(corsOptions));
app.use(express.json());
app.use(fileUpload({ createParentPath: true, useTempFiles: true, tempFileDir: tempDir, limits: { fileSize: maxUploadBytes }, abortOnLimit: true }));
app.use("/uploads", express.static(uploadsDir));

// Health check
app.get("/", (req, res) => res.json({ status: "ok", message: "Alphacreative API running" }));

// Public routes
app.use("/api/auth", authRoutes);
app.use("/api/events", eventRoutes);
app.use("/api/event-categories", eventCategoryRoutes);
app.use("/api/berita", beritaRoutes);
app.use("/api/merchandise", merchandiseRoutes);
app.use("/api/juara", juaraRoutes);
app.use("/api/partisipasi", partisipasiRoutes);
app.use("/api/gallery", galleryRoutes);
app.use("/api/partnerships", partnershipRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/public", landingRoutes);

// Protected routes
app.use("/api/users", auth, requireRole("admin", "operator"), userRoutes);
app.use("/api/peserta", auth, requireRole("admin", "peserta", "operator", "juri"), pesertaRoutes);
app.use("/api/detail-peserta", auth, requireRole("admin", "peserta", "operator"), detailPesertaRoutes);

// 404 & error handling
app.use((req, res) => res.status(404).json({ message: "Not found" }));
app.use(globalErrorHandler);

module.exports = app;
