const path = require("path");

const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret || jwtSecret.length < 32) {
  throw new Error("JWT_SECRET must be set and have at least 32 characters.");
}

const allowedOrigins = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

if (allowedOrigins.length === 0) {
  throw new Error("ALLOWED_ORIGINS must be set with at least one origin.");
}

module.exports = {
  jwtSecret,
  jwtExpiresInSeconds: Number(process.env.JWT_EXPIRES_IN_SECONDS || 60 * 60 * 24),
  dataDir: process.env.DATA_DIR || path.join(__dirname, "..", "data"),
  allowedOrigins,
};
