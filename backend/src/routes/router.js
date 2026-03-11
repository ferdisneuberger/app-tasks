const express = require("express");
const healthController = require("../controllers/healthController");
const userController = require("../controllers/userController");
const authController = require("../controllers/authController");
const taskController = require("../controllers/taskController");
const authMiddleware = require("../middlewares/authMiddleware");

const { validate, ensureBodyObject } = require("../middlewares/validationMiddleware");
const {
  validateCreateUser,
  validateLogin,
  validateCreateTask,
  validateUpdateTask,
  validateTaskIdParam,
} = require("../validators");

const router = express.Router();

router.get("/health", healthController.healthCheck);

router.post("/users", validate(ensureBodyObject), validate(validateCreateUser), userController.createUser);
router.get("/users/me", authMiddleware, userController.getProfile);

router.post("/auth/login", validate(ensureBodyObject), validate(validateLogin), authController.login);
router.post("/auth/logout", authMiddleware, authController.logout);

router.post("/tasks", authMiddleware, validate(ensureBodyObject), validate(validateCreateTask), taskController.createTask);
router.get("/tasks", authMiddleware, taskController.listTasks);
router.get("/tasks/:taskId", authMiddleware, validate(validateTaskIdParam), taskController.getTask);
router.put("/tasks/:taskId", authMiddleware, validate(ensureBodyObject), validate(validateTaskIdParam), validate(validateUpdateTask), taskController.updateTask);
router.delete("/tasks/:taskId", authMiddleware, validate(validateTaskIdParam), taskController.deleteTask);

module.exports = router;
