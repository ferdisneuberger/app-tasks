const authService = require("../services/authService");
const appError = require("../errors/appError");
const { getBearerToken } = require("../utils/request");

async function authMiddleware(req, _res, next) {
  try {
    const token = getBearerToken(req);

    if (!token) {
      throw appError("Token nao informado.", 401);
    }

    const { user } = await authService.authenticate(token);
    req.user = user;
    req.token = token;
    next();
  } catch (error) {
    next(error);
  }
}

module.exports = authMiddleware;
