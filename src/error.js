// src/error.js

// bikin error custom
function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

// parse ID
function parseId(value) {
  const id = Number(value);
  if (Number.isNaN(id) || id <= 0) {
    throw httpError(400, "ID tidak valid");
  }
  return id;
}

// global handler
function globalErrorHandler(err, req, res, next) {
  console.error("ERROR:", err);

  // prisma unique
  if (err.code === "P2002") {
    return res.status(400).json({
      message: "Data melanggar unique constraint",
      field: err.meta?.target || undefined,
    });
  }

  // prisma not found
  if (err.code === "P2025") {
    return res.status(404).json({
      message: "Data tidak ditemukan",
    });
  }

  res.status(err.status || 500).json({
    message: err.message || "Internal server error",
  });
}

module.exports = {
  httpError,
  parseId,
  globalErrorHandler,
};