const crypto = require("crypto");
const { readJson, writeJson } = require("./jsonRepository");

const FILE_NAME = "tasks.json";
const INITIAL_DATA = [];

async function create({ title, description, completed, userId }) {
  const tasks = await readJson(FILE_NAME, INITIAL_DATA);
  const task = {
    id: crypto.randomUUID(),
    title,
    description,
    completed,
    userId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  tasks.push(task);
  await writeJson(FILE_NAME, INITIAL_DATA, tasks);
  return task;
}

async function findAllByUserId(userId) {
  const tasks = await readJson(FILE_NAME, INITIAL_DATA);
  return tasks.filter((task) => task.userId === userId);
}

async function findById(id) {
  const tasks = await readJson(FILE_NAME, INITIAL_DATA);
  return tasks.find((task) => task.id === id) || null;
}

async function update(id, changes) {
  const tasks = await readJson(FILE_NAME, INITIAL_DATA);
  const index = tasks.findIndex((task) => task.id === id);

  if (index === -1) {
    return null;
  }

  tasks[index] = {
    ...tasks[index],
    ...changes,
    updatedAt: new Date().toISOString(),
  };

  await writeJson(FILE_NAME, INITIAL_DATA, tasks);
  return tasks[index];
}

async function remove(id) {
  const tasks = await readJson(FILE_NAME, INITIAL_DATA);
  const index = tasks.findIndex((task) => task.id === id);

  if (index === -1) {
    return false;
  }

  tasks.splice(index, 1);
  await writeJson(FILE_NAME, INITIAL_DATA, tasks);
  return true;
}

module.exports = {
  create,
  findAllByUserId,
  findById,
  update,
  delete: remove,
};
