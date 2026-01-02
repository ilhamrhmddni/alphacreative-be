// src/error.js
const httpError = (status, message) => Object.assign(new Error(message), { status });

const parseId = (v) => {
  const id = Number(v);
  if (Number.isNaN(id) || id <= 0) throw httpError(400, "ID tidak valid");
  return id;
};

const globalErrorHandler = (err, req, res, next) => {
  console.error("ERROR:", err);
  
  if (err.code === "P2002") return res.status(400).json({ message: "Data melanggar unique constraint", field: err.meta?.target });
  if (err.code === "P2025") return res.status(404).json({ message: "Data tidak ditemukan" });
  
  res.status(err.status || 500).json({ message: err.message || "Internal server error" });
};

module.exports = { httpError, parseId, globalErrorHandler };