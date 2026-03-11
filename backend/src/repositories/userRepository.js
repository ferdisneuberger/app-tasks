const crypto = require("crypto");
const { readJson, writeJson } = require("./jsonRepository");

const FILE_NAME = "users.json";
const INITIAL_DATA = [];

async function create({ name, email, passwordHash }) {
  const users = await readJson(FILE_NAME, INITIAL_DATA);
  const user = {
    id: crypto.randomUUID(),
    name,
    email,
    passwordHash,
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
  return users.find((user) => user.id === id) || null;
}

module.exports = {
  create,
  findByEmail,
  findById,
};
