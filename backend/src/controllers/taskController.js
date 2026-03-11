const taskService = require("../services/taskService");

async function createTask(req, res, next) {
  try {
    const task = await taskService.createTask(req.user.id, req.body);
    res.status(201).json({ task });
  } catch (error) {
    next(error);
  }
}

async function listTasks(req, res, next) {
  try {
    const tasks = await taskService.listTasks(req.user.id);
    res.status(200).json({ tasks });
  } catch (error) {
    next(error);
  }
}

async function getTask(req, res, next) {
  try {
    const task = await taskService.getTask(req.user.id, req.params.taskId);
    res.status(200).json({ task });
  } catch (error) {
    next(error);
  }
}

async function updateTask(req, res, next) {
  try {
    const task = await taskService.updateTask(req.user.id, req.params.taskId, req.body);
    res.status(200).json({ task });
  } catch (error) {
    next(error);
  }
}

async function deleteTask(req, res, next) {
  try {
    await taskService.deleteTask(req.user.id, req.params.taskId);
    res.status(200).json({ message: "Tarefa removida com sucesso." });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  createTask,
  listTasks,
  getTask,
  updateTask,
  deleteTask,
};
