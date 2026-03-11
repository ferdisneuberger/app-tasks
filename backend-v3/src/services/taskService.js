const appError = require("../errors/appError");
const taskRepository = require("../repositories/taskRepository");

async function createTask(userId, { title, description = "", completed = false }) {
  return taskRepository.create({
    title: String(title).trim(),
    description: String(description || "").trim(),
    completed: Boolean(completed),
    userId,
  });
}

async function listTasks(userId) {
  return taskRepository.findAllByUserId(userId);
}

async function getTask(userId, taskId) {
  const task = await taskRepository.findById(taskId);
  ensureTaskOwnership(task, userId);
  return task;
}

async function updateTask(userId, taskId, changes) {
  const task = await taskRepository.findById(taskId);
  ensureTaskOwnership(task, userId);

  const nextChanges = {};

  if (changes.title !== undefined) {
    nextChanges.title = String(changes.title).trim();
  }

  if (changes.description !== undefined) {
    nextChanges.description = String(changes.description || "").trim();
  }

  if (changes.completed !== undefined) {
    nextChanges.completed = Boolean(changes.completed);
  }

  return taskRepository.update(taskId, nextChanges);
}

async function deleteTask(userId, taskId) {
  const task = await taskRepository.findById(taskId);
  ensureTaskOwnership(task, userId);
  await taskRepository.delete(taskId);
}

function ensureTaskOwnership(task, userId) {
  if (!task || task.userId !== userId) {
    throw appError("Tarefa nao encontrada.", 404);
  }
}

module.exports = {
  createTask,
  listTasks,
  getTask,
  updateTask,
  deleteTask,
};
