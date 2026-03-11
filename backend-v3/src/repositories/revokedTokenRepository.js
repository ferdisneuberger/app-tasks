const { readJson, writeJson } = require("./jsonRepository");

const FILE_NAME = "revokedTokens.json";
const INITIAL_DATA = [];

async function revoke({ jti, expiresAt }) {
  const revokedTokens = await readJson(FILE_NAME, INITIAL_DATA);
  revokedTokens.push({ jti, expiresAt });
  await writeJson(FILE_NAME, INITIAL_DATA, revokedTokens);
}

async function isRevoked(jti) {
  const revokedTokens = await readJson(FILE_NAME, INITIAL_DATA);
  const now = new Date().toISOString();
  const activeRevocations = revokedTokens.filter((token) => token.expiresAt > now);

  if (activeRevocations.length !== revokedTokens.length) {
    await writeJson(FILE_NAME, INITIAL_DATA, activeRevocations);
  }

  return activeRevocations.some((token) => token.jti === jti);
}

module.exports = {
  revoke,
  isRevoked,
};
