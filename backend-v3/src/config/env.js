const path = require("path");

module.exports = {
  jwtSecret: process.env.JWT_SECRET || "change-this-secret-in-production",
  jwtExpiresInSeconds: Number(process.env.JWT_EXPIRES_IN_SECONDS || 60 * 60 * 24),
  dataDir: process.env.DATA_DIR || path.join(__dirname, "..", "data"),
};
