const appError = require("../errors/appError");

function validateCreateUser(req) {
  assertAllowedKeys(req.body, ["name", "email", "password"]);

  const { name, email, password } = req.body;

  if (!name || typeof name !== "string" || !name.trim()) {
    throw appError("Nome e obrigatorio.", 400);
  }

  if (!email || typeof email !== "string" || !email.trim()) {
    throw appError("Email e obrigatorio.", 400);
  }

  if (!isValidEmail(email)) {
    throw appError("Email invalido.", 400);
  }

  if (!password || typeof password !== "string") {
    throw appError("Senha e obrigatoria.", 400);
  }

  if (password.length < 6) {
    throw appError("A senha deve ter pelo menos 6 caracteres.", 400);
  }
}

function validateLogin(req) {
  assertAllowedKeys(req.body, ["email", "password"]);

  const { email, password } = req.body;

  if (!email || typeof email !== "string" || !email.trim()) {
    throw appError("Email e obrigatorio.", 400);
  }

  if (!isValidEmail(email)) {
    throw appError("Email invalido.", 400);
  }

  if (!password || typeof password !== "string") {
    throw appError("Senha e obrigatoria.", 400);
  }
}

function validateCreateTask(req) {
  assertAllowedKeys(req.body, ["title", "description", "completed"]);

  const { title, description, completed } = req.body;

  if (!title || typeof title !== "string" || !title.trim()) {
    throw appError("Titulo da tarefa e obrigatorio.", 400);
  }

  if (description !== undefined && typeof description !== "string") {
    throw appError("Descricao da tarefa deve ser texto.", 400);
  }

  if (completed !== undefined && typeof completed !== "boolean") {
    throw appError("Campo completed deve ser booleano.", 400);
  }
}

function validateUpdateTask(req) {
  assertAllowedKeys(req.body, ["title", "description", "completed"]);

  const { title, description, completed } = req.body;
  const keys = Object.keys(req.body);

  if (keys.length === 0) {
    throw appError("Informe ao menos um campo para atualizar.", 400);
  }

  if (title !== undefined && (typeof title !== "string" || !title.trim())) {
    throw appError("Titulo da tarefa e obrigatorio.", 400);
  }

  if (description !== undefined && typeof description !== "string") {
    throw appError("Descricao da tarefa deve ser texto.", 400);
  }

  if (completed !== undefined && typeof completed !== "boolean") {
    throw appError("Campo completed deve ser booleano.", 400);
  }
}

function validateTaskIdParam(req) {
  const { taskId } = req.params;

  if (!taskId || typeof taskId !== "string" || !taskId.trim()) {
    throw appError("Parametro taskId e obrigatorio.", 400);
  }

  if (!isValidUuid(taskId)) {
    throw appError("Parametro taskId invalido.", 400);
  }
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim());
}

function isValidUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value).trim());
}

function assertAllowedKeys(payload, allowedKeys) {
  const invalidKeys = Object.keys(payload).filter((key) => !allowedKeys.includes(key));

  if (invalidKeys.length > 0) {
    throw appError(`Campos nao permitidos: ${invalidKeys.join(", ")}.`, 400);
  }
}

module.exports = {
  validateCreateUser,
  validateLogin,
  validateCreateTask,
  validateUpdateTask,
  validateTaskIdParam,
};
