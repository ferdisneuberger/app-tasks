const crypto = require("crypto");
const { readJson, writeJson } = require("./jsonRepository");
const { getDefaultPreferences, normalizePreferences } = require("../utils/preferences");

const FILE_NAME = "users.json";
const INITIAL_DATA = [];

async function create({ name, email, passwordHash, preferences }) {
  const users = await readJson(FILE_NAME, INITIAL_DATA);
  const user = {
    id: crypto.randomUUID(),
    name,
    email,
    passwordHash,
    preferences: preferences || getDefaultPreferences(),
    createdAt: new Date().toISOString(),
  };

  users.push(user);
  await writeJson(FILE_NAME, INITIAL_DATA, users);
  return user;
}

async function findByEmail(email) {
  const users = await readJson(FILE_NAME, INITIAL_DATA);
  return users.find((user) => user.email === email) || null;
}

async function findById(id) {
  const users = await readJson(FILE_NAME, INITIAL_DATA);
  const user = users.find((item) => item.id === id) || null;

  if (!user) {
    return null;
  }

  return {
    ...user,
    preferences: normalizePreferences(user.preferences),
  };
}

async function updatePreferences(userId, preferences) {
  const users = await readJson(FILE_NAME, INITIAL_DATA);
  const userIndex = users.findIndex((user) => user.id === userId);

  if (userIndex === -1) {
    return null;
  }

  users[userIndex] = {
    ...users[userIndex],
    preferences: normalizePreferences(preferences),
  };

  await writeJson(FILE_NAME, INITIAL_DATA, users);
  return users[userIndex];
}

module.exports = {
  create,
  findByEmail,
  findById,
  updatePreferences,
};
