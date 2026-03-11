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

module.exports = {
  createUser,
  getProfile,
};
