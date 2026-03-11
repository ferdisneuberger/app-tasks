const appError = require("../errors/appError");

function notFoundHandler(req, _res, next) {
  next(appError("Rota nao encontrada.", 404));
}

function errorHandler(error, _req, res, _next) {
  if (error instanceof SyntaxError && error.status === 400 && "body" in error) {
    res.status(400).json({ error: "JSON invalido." });
    return;
  }

  if (error && error.name === "AppError") {
    res.status(error.statusCode).json({ error: error.message });
    return;
  }

  console.error(error);
  res.status(500).json({ error: "Erro interno do servidor." });
}

module.exports = {
  notFoundHandler,
  errorHandler,
};
