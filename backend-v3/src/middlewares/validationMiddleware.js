const appError = require("../errors/appError");

function validate(requiredValidator) {
  return (req, _res, next) => {
    try {
      requiredValidator(req);
      next();
    } catch (error) {
      next(error);
    }
  };
}

function ensureBodyObject(req) {
  if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
    throw appError("O corpo da requisicao deve ser um objeto JSON.", 400);
  }
}

module.exports = {
  validate,
  ensureBodyObject,
};
