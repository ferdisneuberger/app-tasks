const appError = require("../errors/appError");
const userRepository = require("../repositories/userRepository");
const { hashPassword } = require("../utils/password");
const { getDefaultPreferences, normalizePreferences } = require("../utils/preferences");

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
    preferences: getDefaultPreferences(),
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

async function getUserPreferences(userId) {
  const user = await userRepository.findById(userId);

  if (!user) {
    throw appError("Usuario nao encontrado.", 404);
  }

  return normalizePreferences(user.preferences);
}

async function updateUserPreferences(userId, preferencesPatch) {
  const user = await userRepository.findById(userId);

  if (!user) {
    throw appError("Usuario nao encontrado.", 404);
  }

  const currentPreferences = normalizePreferences(user.preferences);
  const mergedPreferences = normalizePreferences({
    ...currentPreferences,
    ...preferencesPatch,
    theme: {
      ...currentPreferences.theme,
      ...(preferencesPatch.theme || {}),
    },
  });

  const updatedUser = await userRepository.updatePreferences(userId, mergedPreferences);
  return normalizePreferences(updatedUser.preferences);
}

function toPublicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    createdAt: user.createdAt,
    preferences: normalizePreferences(user.preferences),
  };
}

module.exports = {
  createUser,
  getUserById,
  getUserPreferences,
  updateUserPreferences,
  getDefaultPreferences,
  normalizePreferences,
  toPublicUser,
};
