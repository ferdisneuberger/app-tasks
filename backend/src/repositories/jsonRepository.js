const fs = require("fs/promises");
const path = require("path");
const env = require("../config/env");

async function ensureFile(fileName, initialData) {
  const filePath = path.join(env.dataDir, fileName);
  await fs.mkdir(path.dirname(filePath), { recursive: true });

  try {
    await fs.access(filePath);
  } catch {
    await fs.writeFile(filePath, JSON.stringify(initialData, null, 2));
  }

  return filePath;
}

async function readJson(fileName, initialData) {
  const filePath = await ensureFile(fileName, initialData);
  const content = await fs.readFile(filePath, "utf8");
  return JSON.parse(content);
}

async function writeJson(fileName, initialData, data) {
  const filePath = await ensureFile(fileName, initialData);
  await fs.writeFile(filePath, JSON.stringify(data, null, 2));
  return data;
}

module.exports = {
  readJson,
  writeJson,
};
