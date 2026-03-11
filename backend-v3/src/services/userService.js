const appError = require("../errors/appError");
const userRepository = require("../repositories/userRepository");
const { hashPassword } = require("../utils/password");

async function createUser({ name, email, password }) {
  const normalizedEmail = String(email).trim().toLowerCase();
  const existingUser = await userRepository.findByEmail(normalizedEmail);

  if (existingUser) {
    throw appError("Ja existe um usuario com este email.", 409);
  }

  const passwordHash = await hashPassword(password);
  const user = await userRepository.create({
    name: String(name).trim(),
    email: normalizedEmail,
    passwordHash,
  });

  return toPublicUser(user);
}

async function getUserById(id) {
  const user = await userRepository.findById(id);

  if (!user) {
    throw appError("Usuario nao encontrado.", 404);
  }

  return toPublicUser(user);
}

function toPublicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    createdAt: user.createdAt,
  };
}

module.exports = {
  createUser,
  getUserById,
  toPublicUser,
};
