function appError(message, statusCode = 400) {
  const error = new Error(message);
  error.name = "AppError";
  error.statusCode = statusCode;
  return error;
}

module.exports = appError;
