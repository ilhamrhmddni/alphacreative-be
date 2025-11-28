const express = require("express");
const cors = require("cors");
const fileUpload = require("express-fileupload");

const { auth, requireRole } = require("./middleware/auth");
const { globalErrorHandler } = require("./error");
const authRoutes = require("./routes/auth.routes");
const userRoutes = require("./routes/user.routes");
const eventRoutes = require("./routes/event.routes");
const pesertaRoutes = require("./routes/peserta.routes");
const detailPesertaRoutes = require("./routes/detailPeserta.routes");
const beritaRoutes = require("./routes/berita.routes");
const juaraRoutes = require("./routes/juara.routes");
const partisipasiRoutes = require("./routes/partisipasi.routes");
const scoreRoutes = require("./routes/score.routes");
const scoreDetailRoutes = require("./routes/scoreDetail.routes");
const uploadRoutes = require("./routes/upload.routes");
const landingRoutes = require("./routes/public.routes");

const app = express();
app.use(cors());
app.use(express.json());
app.use(
  fileUpload({
    useTempFiles: false,
  })
);

app.get("/", (req, res) => {
  res.json({ status: "ok", message: "Alphacreative API running" });
});

// AUTH (no auth needed for login)
app.use("/api/auth", authRoutes);
app.use("/api/events", eventRoutes);
app.use("/api/berita", beritaRoutes); 
app.use("/api/juara", juaraRoutes);
app.use("/api/scores", scoreRoutes);
app.use("/api/score-details", scoreDetailRoutes);
app.use("/api/partisipasi", partisipasiRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/public", landingRoutes);


// PROTECTED ROUTES
app.use("/api/users", auth, requireRole("admin","operator",), userRoutes);
app.use(
  "/api/peserta",
  auth,
  requireRole("admin", "peserta", "operator", "juri"),
  pesertaRoutes
);
app.use(
  "/api/detail-peserta",
  auth,
  requireRole("admin", "peserta","operator"),
  detailPesertaRoutes
);

// 404
app.use((req, res) => {
  res.status(404).json({ message: "Not found" });
});

// global error handler
app.use(globalErrorHandler);

module.exports = app;
