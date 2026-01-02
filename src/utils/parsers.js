// src/utils/parsers.js
const { httpError } = require("../error");

const parsePositiveInt = (v, n) => {
  const p = Number(v);
  if (!Number.isInteger(p) || p <= 0) throw httpError(400, `${n} tidak valid`);
  return p;
};

const parseOptionalPositiveInt = (v, n) => {
  if (!v) return undefined;
  return parsePositiveInt(v, n);
};

const parseNumber = (v, n) => {
  const p = Number(v);
  if (Number.isNaN(p)) throw httpError(400, `${n} harus berupa angka`);
  return p;
};

const parseNullableNumber = (v, n, opts = {}) => {
  if (v === undefined) {
    if (opts.allowUndefined) return undefined;
    throw httpError(400, `${n} wajib diisi`);
  }
  if (v === null || String(v).trim() === "") return null;
  return parseNumber(v, n);
};

const parseBoolean = (v, n) => {
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v === 1;
  if (typeof v === "string") {
    const norm = v.trim().toLowerCase();
    if (["true", "1", "yes", "on"].includes(norm)) return true;
    if (["false", "0", "no", "off"].includes(norm)) return false;
  }
  throw httpError(400, `${n} harus berupa boolean`);
};

const parseOptionalBoolean = (v, n) => {
  if (!v) return undefined;
  return parseBoolean(v, n);
};

const parseDate = (v, n, opts = {}) => {
  if (v === undefined) {
    if (opts.allowUndefined) return undefined;
    throw httpError(400, `${n} wajib diisi`);
  }
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) throw httpError(400, `${n} tidak valid`);
  return d;
};

module.exports = {
  parsePositiveInt, parseOptionalPositiveInt, parseNumber,
  parseNullableNumber, parseBoolean, parseOptionalBoolean, parseDate
};
