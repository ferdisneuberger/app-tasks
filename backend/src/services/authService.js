const env = require("../config/env");
const appError = require("../errors/appError");
const userRepository = require("../repositories/userRepository");
const revokedTokenRepository = require("../repositories/revokedTokenRepository");
const userService = require("./userService");
const { signToken, verifyToken } = require("../utils/jwt");
const { verifyPassword } = require("../utils/password");

async function login({ email, password }) {
  const normalizedEmail = String(email).trim().toLowerCase();
  const user = await userRepository.findByEmail(normalizedEmail);

  if (!user) {
    throw appError("Credenciais invalidas.", 401);
  }

  const passwordMatches = await verifyPassword(password, user.passwordHash);

  if (!passwordMatches) {
    throw appError("Credenciais invalidas.", 401);
  }

  const token = signToken(
    {
      sub: user.id,
      email: user.email,
    },
    env.jwtSecret,
    env.jwtExpiresInSeconds
  );

  return {
    token,
    user: userService.toPublicUser(user),
  };
}

async function authenticate(token) {
  const payload = verifyToken(token, env.jwtSecret);
  const revoked = await revokedTokenRepository.isRevoked(payload.jti);

  if (revoked) {
    throw appError("Token revogado.", 401);
  }

  const user = await userRepository.findById(payload.sub);

  if (!user) {
    throw appError("Usuario nao encontrado.", 401);
  }

  return {
    payload,
    user: userService.toPublicUser(user),
  };
}

async function logout(token) {
  const payload = verifyToken(token, env.jwtSecret);
  await revokedTokenRepository.revoke({
    jti: payload.jti,
    expiresAt: new Date(payload.exp * 1000).toISOString(),
  });
}

module.exports = {
  login,
  authenticate,
  logout,
};
