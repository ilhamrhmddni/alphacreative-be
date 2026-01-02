// src/utils/operator-access.js
const prisma = require("../lib/prisma");
const { httpError } = require("../error");

async function requireOperatorFocusEventId(userId) {
  const operator = await prisma.user.findUnique({
    where: { id: userId },
    select: { focusEventId: true },
  });

  if (!operator?.focusEventId) {
    throw httpError(400, "Operator belum memilih event fokus");
  }

  return operator.focusEventId;
}

async function ensureOperatorEventAccess(user, eventId, message) {
  if (user.role !== "operator") return;
  const focusEventId = await requireOperatorFocusEventId(user.id);
  if (eventId !== focusEventId) {
    throw httpError(403, message || "Operator hanya boleh mengakses data pada event fokus");
  }
  return focusEventId;
}

async function ensureOperatorScoreAccess(user, score, message) {
  if (!score) {
    throw httpError(404, "Score tidak ditemukan");
  }
  await ensureOperatorEventAccess(user, score.eventId, message || "Operator hanya boleh mengakses detail score pada event fokus");
}

module.exports = {
  requireOperatorFocusEventId,
  ensureOperatorEventAccess,
  ensureOperatorScoreAccess,
};
