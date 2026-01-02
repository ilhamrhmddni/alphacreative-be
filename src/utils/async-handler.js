// src/utils/async-handler.js
// Wrap an async route handler and forward rejections to Express.
module.exports = (handler) => (req, res, next) =>
  Promise.resolve(handler(req, res, next)).catch(next);
