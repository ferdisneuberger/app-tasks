const authService = require("../services/authService");

async function login(req, res, next) {
  try {
    const result = await authService.login(req.body);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

async function logout(req, res, next) {
  try {
    await authService.logout(req.token);
    res.status(200).json({ message: "Logout realizado com sucesso." });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  login,
  logout,
};
