const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const appError = require("../errors/appError");

function signToken(payload, secret, expiresInSeconds) {
  return jwt.sign(payload, secret, {
    algorithm: "HS256",
    expiresIn: expiresInSeconds,
    jwtid: crypto.randomUUID(),
  });
}

function verifyToken(token, secret) {
  try {
    return jwt.verify(token, secret);
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      throw appError("Token expirado.", 401);
    }

    throw appError("Token invalido.", 401);
  }
}

module.exports = {
  signToken,
  verifyToken,
};
