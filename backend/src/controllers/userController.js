const userService = require("../services/userService");

async function createUser(req, res, next) {
  try {
    const user = await userService.createUser(req.body);
    res.status(201).json({ user });
  } catch (error) {
    next(error);
  }
}

function getProfile(req, res) {
  res.status(200).json({ user: req.user });
}

async function getPreferences(req, res, next) {
  try {
    const preferences = await userService.getUserPreferences(req.user.id);
    res.status(200).json({ preferences });
  } catch (error) {
    next(error);
  }
}

async function updatePreferences(req, res, next) {
  try {
    const preferences = await userService.updateUserPreferences(req.user.id, req.body);
    res.status(200).json({ preferences });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  createUser,
  getProfile,
  getPreferences,
  updatePreferences,
};
