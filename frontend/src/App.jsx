import { useEffect, useRef, useState } from "react";
import {
  createTask,
  createUser,
  deleteTask,
  getProfile,
  listTasks,
  login,
  logout,
  updateTask,
} from "./api";

const emptyAuthForm = {
  name: "",
  email: "",
  password: "",
};

const emptyTaskForm = {
  title: "",
  description: "",
};

const emptyInlineEditForm = {
  title: "",
  description: "",
};
const MAX_TASK_TITLE_LENGTH = 80;
const STATUS_TOAST_DURATION_MS = 2600;

function getTaskOrderKey(userId) {
  return `app-tasks-order:${userId}`;
}

function orderTasks(taskItems, pendingOrder = []) {
  const pendingOrderIndex = new Map(pendingOrder.map((taskId, index) => [taskId, index]));
  const pendingTasks = [];
  const completedTasks = [];

  taskItems.forEach((task, index) => {
    const sortableTask = {
      ...task,
      _originalIndex: index,
      _pendingOrderIndex: pendingOrderIndex.has(task.id)
        ? pendingOrderIndex.get(task.id)
        : Number.POSITIVE_INFINITY,
    };

    if (task.completed) {
      completedTasks.push(sortableTask);
      return;
    }

    pendingTasks.push(sortableTask);
  });

  pendingTasks.sort((left, right) => {
    if (left._pendingOrderIndex !== right._pendingOrderIndex) {
      return left._pendingOrderIndex - right._pendingOrderIndex;
    }

    return left._originalIndex - right._originalIndex;
  });

  return [...pendingTasks, ...completedTasks].map(({ _originalIndex, _pendingOrderIndex, ...task }) => task);
}

function EditIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M4 20h4.2l9.9-9.9-4.2-4.2L4 15.8V20zm14.7-11.5a1 1 0 0 0 0-1.4l-1.8-1.8a1 1 0 0 0-1.4 0l-1.2 1.2 4.2 4.2 1.2-1.2z" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M9 3h6l1 2h4v2H4V5h4l1-2zm1 7h2v8h-2v-8zm4 0h2v8h-2v-8zM7 10h2v8H7v-8z" />
    </svg>
  );
}

function MoreIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M12 7a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm0 7a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm0 7a2 2 0 1 0 0-4 2 2 0 0 0 0 4z" />
    </svg>
  );
}

function App() {
  const [mode, setMode] = useState("login");
  const [token, setToken] = useState(() => localStorage.getItem("app-tasks-token") || "");
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem("app-tasks-user");
    return stored ? JSON.parse(stored) : null;
  });
  const [tasks, setTasks] = useState([]);
  const [authForm, setAuthForm] = useState(emptyAuthForm);
  const [taskForm, setTaskForm] = useState(emptyTaskForm);
  const [editingTaskId, setEditingTaskId] = useState("");
  const [inlineEditForm, setInlineEditForm] = useState(emptyInlineEditForm);
  const [loading, setLoading] = useState(false);
  const [taskLoading, setTaskLoading] = useState(false);
  const [draggedTaskId, setDraggedTaskId] = useState("");
  const [expandedTaskIds, setExpandedTaskIds] = useState([]);
  const [collapsibleTaskIds, setCollapsibleTaskIds] = useState([]);
  const [isTaskSheetOpen, setTaskSheetOpen] = useState(false);
  const [openTaskMenuId, setOpenTaskMenuId] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [undoDeleteInfo, setUndoDeleteInfo] = useState(null);
  const [statusToast, setStatusToast] = useState(null);
  const descriptionMeasureRefs = useRef(new Map());
  const createTitleInputRef = useRef(null);
  const mobileSheetTitleInputRef = useRef(null);
  const pendingDeleteRef = useRef(null);
  const deleteTimeoutRef = useRef(null);
  const statusToastTimeoutRef = useRef(null);

  useEffect(() => {
    if (!token) {
      return;
    }

    let cancelled = false;

    async function loadSession() {
      try {
        setLoading(true);
        const [{ user: profileUser }, { tasks: taskItems }] = await Promise.all([
          getProfile(token),
          listTasks(token),
        ]);

        if (cancelled) {
          return;
        }

        setUser(profileUser);
        const savedOrder = localStorage.getItem(getTaskOrderKey(profileUser.id));
        const pendingOrder = savedOrder ? JSON.parse(savedOrder) : [];
        setTasks(orderTasks(taskItems, pendingOrder));
        localStorage.setItem("app-tasks-token", token);
        localStorage.setItem("app-tasks-user", JSON.stringify(profileUser));
      } catch (requestError) {
        if (cancelled) {
          return;
        }

        clearSession();
        showStatusToast(requestError.message, "error");
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadSession();

    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    if (!user) {
      return;
    }

    const pendingOrder = tasks.filter((task) => !task.completed).map((task) => task.id);
    localStorage.setItem(getTaskOrderKey(user.id), JSON.stringify(pendingOrder));
  }, [tasks, user]);

  useEffect(() => {
    function updateCollapsibleTasks() {
      const nextCollapsibleTaskIds = tasks
        .filter((task) => task.description)
        .map((task) => task.id)
        .filter((taskId) => {
          const node = descriptionMeasureRefs.current.get(taskId);
          return node ? node.scrollHeight > node.clientHeight + 1 : false;
        });

      setCollapsibleTaskIds(nextCollapsibleTaskIds);
      setExpandedTaskIds((current) => current.filter((taskId) => nextCollapsibleTaskIds.includes(taskId)));
    }

    const animationFrameId = window.requestAnimationFrame(updateCollapsibleTasks);
    window.addEventListener("resize", updateCollapsibleTasks);

    return () => {
      window.cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", updateCollapsibleTasks);
    };
  }, [tasks]);

  useEffect(() => {
    if (!openTaskMenuId) {
      return;
    }

    function handleOutsideClick(event) {
      if (!event.target.closest(".task-menu")) {
        setOpenTaskMenuId("");
      }
    }

    window.addEventListener("pointerdown", handleOutsideClick);
    return () => {
      window.removeEventListener("pointerdown", handleOutsideClick);
    };
  }, [openTaskMenuId]);

  useEffect(() => {
    return () => {
      if (deleteTimeoutRef.current) {
        window.clearTimeout(deleteTimeoutRef.current);
      }
      if (statusToastTimeoutRef.current) {
        window.clearTimeout(statusToastTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!isTaskSheetOpen) {
      return;
    }

    const animationFrameId = window.requestAnimationFrame(() => {
      mobileSheetTitleInputRef.current?.focus();
    });

    return () => {
      window.cancelAnimationFrame(animationFrameId);
    };
  }, [isTaskSheetOpen]);

  function clearFeedback() {
    setStatusToast(null);
  }

  function showStatusToast(text, type = "success") {
    if (!text) {
      return;
    }

    setStatusToast({ type, text });
    if (statusToastTimeoutRef.current) {
      window.clearTimeout(statusToastTimeoutRef.current);
    }
    statusToastTimeoutRef.current = window.setTimeout(() => {
      setStatusToast(null);
      statusToastTimeoutRef.current = null;
    }, STATUS_TOAST_DURATION_MS);
  }

  function applyTaskUpdate(currentTasks, updatedTask) {
    const nextTasks = currentTasks.map((item) => (item.id === updatedTask.id ? updatedTask : item));

    if (updatedTask.completed) {
      return orderTasks(nextTasks, nextTasks.filter((item) => !item.completed).map((item) => item.id));
    }

    const pendingTasks = nextTasks.filter((item) => !item.completed);
    const completedTasks = nextTasks.filter((item) => item.completed);
    const restoredTask = pendingTasks.find((item) => item.id === updatedTask.id);
    const otherPendingTasks = pendingTasks.filter((item) => item.id !== updatedTask.id);

    return restoredTask ? [restoredTask, ...otherPendingTasks, ...completedTasks] : nextTasks;
  }

  function clearPendingDeleteTimer() {
    if (deleteTimeoutRef.current) {
      window.clearTimeout(deleteTimeoutRef.current);
      deleteTimeoutRef.current = null;
    }
  }

  async function commitPendingDelete() {
    const pendingDelete = pendingDeleteRef.current;
    if (!pendingDelete) {
      return;
    }

    pendingDeleteRef.current = null;
    clearPendingDeleteTimer();

    try {
      await deleteTask(token, pendingDelete.task.id);
    } catch (requestError) {
      showStatusToast(requestError.message, "error");
      setTasks((current) => {
        if (current.some((item) => item.id === pendingDelete.task.id)) {
          return current;
        }

        const nextTasks = [...current];
        nextTasks.splice(Math.min(pendingDelete.index, nextTasks.length), 0, pendingDelete.task);
        return nextTasks;
      });
    } finally {
      setUndoDeleteInfo(null);
    }
  }

  function clearSession() {
    setToken("");
    setUser(null);
    setTasks([]);
    localStorage.removeItem("app-tasks-token");
    localStorage.removeItem("app-tasks-user");
  }

  function movePendingTask(sourceTaskId, targetTaskId) {
    setTasks((current) => {
      const pendingTasks = current.filter((task) => !task.completed);
      const completedTasks = current.filter((task) => task.completed);
      const sourceIndex = pendingTasks.findIndex((task) => task.id === sourceTaskId);
      const targetIndex = pendingTasks.findIndex((task) => task.id === targetTaskId);

      if (sourceIndex === -1 || targetIndex === -1 || sourceIndex === targetIndex) {
        return current;
      }

      const nextPendingTasks = [...pendingTasks];
      const [movedTask] = nextPendingTasks.splice(sourceIndex, 1);
      nextPendingTasks.splice(targetIndex, 0, movedTask);

      return [...nextPendingTasks, ...completedTasks];
    });
  }

  function toggleTaskDescription(taskId) {
    setExpandedTaskIds((current) =>
      current.includes(taskId) ? current.filter((id) => id !== taskId) : [...current, taskId]
    );
  }

  function setDescriptionMeasureRef(taskId, node) {
    if (node) {
      descriptionMeasureRefs.current.set(taskId, node);
      return;
    }

    descriptionMeasureRefs.current.delete(taskId);
  }

  function handleAuthFieldChange(event) {
    const { name, value } = event.target;
    setAuthForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  function handleTaskFieldChange(event) {
    const { name, value } = event.target;
    setTaskForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  async function handleRegister(event) {
    event.preventDefault();
    clearFeedback();

    try {
      setLoading(true);
      await createUser(authForm);
      showStatusToast("Conta criada. Agora faca login.");
      setMode("login");
      setAuthForm({
        name: "",
        email: authForm.email,
        password: "",
      });
    } catch (requestError) {
      showStatusToast(requestError.message, "error");
    } finally {
      setLoading(false);
    }
  }

  async function handleLogin(event) {
    event.preventDefault();
    clearFeedback();

    try {
      setLoading(true);
      const result = await login({
        email: authForm.email,
        password: authForm.password,
      });

      setToken(result.token);
      setUser(result.user);
      setTasks([]);
      setAuthForm(emptyAuthForm);
      localStorage.setItem("app-tasks-token", result.token);
      localStorage.setItem("app-tasks-user", JSON.stringify(result.user));
    } catch (requestError) {
      showStatusToast(requestError.message, "error");
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    clearFeedback();

    try {
      setLoading(true);
      if (token) {
        await logout(token);
      }
    } catch (requestError) {
      showStatusToast(requestError.message, "error");
    } finally {
      clearSession();
      setLoading(false);
    }
  }

  async function handleTaskSubmit(event) {
    event.preventDefault();
    clearFeedback();

    try {
      setTaskLoading(true);
      const { task } = await createTask(token, {
        title: taskForm.title,
        description: taskForm.description,
        completed: false,
      });

      setTasks((current) => [task, ...current]);
      showStatusToast("Tarefa criada.");

      setTaskForm(emptyTaskForm);
      setTaskSheetOpen(false);
    } catch (requestError) {
      showStatusToast(requestError.message, "error");
    } finally {
      setTaskLoading(false);
    }
  }

  function openTaskSheet() {
    clearFeedback();
    setTaskSheetOpen(true);
  }

  function closeTaskSheet() {
    setTaskSheetOpen(false);
  }

  function focusDesktopCreateInput() {
    createTitleInputRef.current?.focus();
  }

  function handleEmptyStateCta() {
    if (window.matchMedia("(max-width: 920px)").matches) {
      openTaskSheet();
      return;
    }

    focusDesktopCreateInput();
  }

  function startEditTask(task) {
    clearFeedback();
    setOpenTaskMenuId("");
    setEditingTaskId(task.id);
    setInlineEditForm({
      title: task.title,
      description: task.description || "",
    });
  }

  function cancelEditTask() {
    clearFeedback();
    setOpenTaskMenuId("");
    setEditingTaskId("");
    setInlineEditForm(emptyInlineEditForm);
  }

  function handleInlineEditFieldChange(event) {
    const { name, value } = event.target;
    setInlineEditForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  function handleInlineEditKeyDown(event, taskId) {
    if (event.key === "Escape") {
      event.preventDefault();
      cancelEditTask();
      return;
    }

    if (event.key !== "Enter") {
      return;
    }

    if (event.target.tagName === "TEXTAREA" && event.shiftKey) {
      return;
    }

    event.preventDefault();
    handleInlineEditSubmit(event, taskId);
  }

  async function handleInlineEditSubmit(event, taskId) {
    event.preventDefault();
    clearFeedback();

    try {
      setTaskLoading(true);
      const { task } = await updateTask(token, taskId, {
        title: inlineEditForm.title,
        description: inlineEditForm.description,
      });

      setTasks((current) => current.map((item) => (item.id === task.id ? task : item)));
      showStatusToast("Tarefa atualizada.");
      setEditingTaskId("");
      setInlineEditForm(emptyInlineEditForm);
    } catch (requestError) {
      showStatusToast(requestError.message, "error");
    } finally {
      setTaskLoading(false);
    }
  }

  async function handleToggleTask(task) {
    clearFeedback();
    const optimisticTask = {
      ...task,
      completed: !task.completed,
    };
    setTasks((current) => applyTaskUpdate(current, optimisticTask));

    try {
      const { task: updatedTask } = await updateTask(token, task.id, {
        completed: optimisticTask.completed,
      });
      setTasks((current) => applyTaskUpdate(current, updatedTask));
    } catch (requestError) {
      setTasks((current) => applyTaskUpdate(current, task));
      showStatusToast(requestError.message, "error");
    }
  }

  async function handleDeleteTask(taskId) {
    const taskToDelete = tasks.find((task) => task.id === taskId);
    if (!taskToDelete) {
      return;
    }

    const confirmed = window.confirm(`Excluir a tarefa "${taskToDelete.title}"?`);
    if (!confirmed) {
      return;
    }

    clearFeedback();
    setOpenTaskMenuId("");

    if (pendingDeleteRef.current) {
      await commitPendingDelete();
    }

    const taskIndex = tasks.findIndex((task) => task.id === taskId);
    pendingDeleteRef.current = { task: taskToDelete, index: taskIndex };

    setTasks((current) => current.filter((item) => item.id !== taskId));
    setUndoDeleteInfo({ title: taskToDelete.title });
    clearPendingDeleteTimer();
    deleteTimeoutRef.current = window.setTimeout(() => {
      commitPendingDelete();
    }, 5000);

    if (editingTaskId === taskId) {
      cancelEditTask();
    }
  }

  function handleUndoDelete() {
    const pendingDelete = pendingDeleteRef.current;
    if (!pendingDelete) {
      return;
    }

    clearPendingDeleteTimer();
    pendingDeleteRef.current = null;

    setTasks((current) => {
      if (current.some((item) => item.id === pendingDelete.task.id)) {
        return current;
      }

      const nextTasks = [...current];
      nextTasks.splice(Math.min(pendingDelete.index, nextTasks.length), 0, pendingDelete.task);
      return nextTasks;
    });

    setUndoDeleteInfo(null);
    showStatusToast("Exclusao desfeita.");
  }

  const normalizedSearchQuery = searchQuery.trim().toLowerCase();
  const visibleTasks = tasks.filter((task) => {
    if (statusFilter === "pending" && task.completed) {
      return false;
    }

    if (statusFilter === "done" && !task.completed) {
      return false;
    }

    if (!normalizedSearchQuery) {
      return true;
    }

    return (
      task.title.toLowerCase().includes(normalizedSearchQuery) ||
      (task.description || "").toLowerCase().includes(normalizedSearchQuery)
    );
  });

  const pendingCount = tasks.filter((task) => !task.completed).length;
  const doneCount = tasks.length - pendingCount;

  function toggleTaskMenu(event, taskId) {
    event.stopPropagation();
    setOpenTaskMenuId((current) => (current === taskId ? "" : taskId));
  }

  function handleTaskCardClick(event, task) {
    if (editingTaskId === task.id || draggedTaskId) {
      return;
    }

    if (event.target.closest("button, input, textarea, form, a")) {
      return;
    }

    handleToggleTask(task);
  }

  if (!user) {
    return (
      <main className="page">
        <section className="auth-shell">
          <div className="auth-copy">
            <span className="eyebrow">App Tasks</span>
            <h1>Organize tarefas sem friccao.</h1>
            <p>
              Interface limpa, autenticacao simples e uma lista de tarefas direta conectada ao seu
              backend.
            </p>
          </div>

          <div className="panel auth-panel">
            <div className="tabs">
              <button
                className={mode === "login" ? "tab is-active" : "tab"}
                onClick={() => {
                  clearFeedback();
                  setMode("login");
                }}
                type="button"
              >
                Entrar
              </button>
              <button
                className={mode === "register" ? "tab is-active" : "tab"}
                onClick={() => {
                  clearFeedback();
                  setMode("register");
                }}
                type="button"
              >
                Criar conta
              </button>
            </div>

            <form onSubmit={mode === "login" ? handleLogin : handleRegister} className="form">
              {mode === "register" ? (
                <label className="field">
                  <span>Nome</span>
                  <input
                    name="name"
                    value={authForm.name}
                    onChange={handleAuthFieldChange}
                    placeholder="Seu nome"
                  />
                </label>
              ) : null}

              <label className="field">
                <span>Email</span>
                <input
                  name="email"
                  type="email"
                  value={authForm.email}
                  onChange={handleAuthFieldChange}
                  placeholder="voce@exemplo.com"
                />
              </label>

              <label className="field">
                <span>Senha</span>
                <input
                  name="password"
                  type="password"
                  value={authForm.password}
                  onChange={handleAuthFieldChange}
                  placeholder="Minimo de 6 caracteres"
                />
              </label>

              <button className="primary-button" disabled={loading} type="submit">
                {loading ? "Carregando..." : mode === "login" ? "Entrar" : "Criar conta"}
              </button>
            </form>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="page">
      <section className="dashboard">
        <header className="topbar panel">
          <div className="topbar-spacer" />
          <div className="topbar-center">
            <span className="eyebrow">Painel</span>
            <h1>Olá, {user.name}</h1>
          </div>
          <button className="ghost-button topbar-logout" onClick={handleLogout} type="button">
            Sair
          </button>
        </header>
        <section className="content-grid">
          <article className="panel task-editor">
            <div className="section-header">
              <div>
                <span className="eyebrow">Nova tarefa</span>
                <h2>Adicione uma tarefa</h2>
              </div>
            </div>

            <form onSubmit={handleTaskSubmit} className="form">
              <label className="field">
                <span>Titulo</span>
                <input
                  ref={createTitleInputRef}
                  maxLength={MAX_TASK_TITLE_LENGTH}
                  name="title"
                  value={taskForm.title}
                  onChange={handleTaskFieldChange}
                  placeholder="Ex.: revisar..."
                />
              </label>

              <label className="field">
                <span>Descricao</span>
                <textarea
                  name="description"
                  value={taskForm.description}
                  onChange={handleTaskFieldChange}
                  rows="5"
                  placeholder="Detalhes opcionais"
                />
              </label>

              <button className="primary-button" disabled={taskLoading} type="submit">
                {taskLoading ? "Salvando..." : "Criar tarefa"}
              </button>
            </form>
          </article>

          <article className="panel task-list-panel">
            <div className="section-header">
              <div>
                <span className="eyebrow">Tarefas</span>
                <h2>Sua lista</h2>
              </div>
              {loading ? <span className="soft-badge">Atualizando...</span> : null}
            </div>
            <div className="task-list-controls">
              <div className="task-filters">
                <button
                  className={statusFilter === "all" ? "chip is-active" : "chip"}
                  onClick={() => setStatusFilter("all")}
                  type="button"
                >
                  Todas ({tasks.length})
                </button>
                <button
                  className={statusFilter === "pending" ? "chip is-active" : "chip"}
                  onClick={() => setStatusFilter("pending")}
                  type="button"
                >
                  Pendentes ({pendingCount})
                </button>
                <button
                  className={statusFilter === "done" ? "chip is-active" : "chip"}
                  onClick={() => setStatusFilter("done")}
                  type="button"
                >
                  Concluidas ({doneCount})
                </button>
              </div>
              <input
                aria-label="Buscar tarefas"
                className="task-search"
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Buscar tarefas..."
                value={searchQuery}
              />
            </div>
            {loading && tasks.length === 0 ? (
              <div className="task-skeleton-list" aria-hidden="true">
                <div className="task-skeleton-card" />
                <div className="task-skeleton-card" />
                <div className="task-skeleton-card" />
              </div>
            ) : (
              <div className="task-list">
                {visibleTasks.length === 0 ? (
                <div className="empty-state">
                  <h3>{tasks.length === 0 ? "Nenhuma tarefa ainda" : "Nenhum resultado"}</h3>
                  <p>
                    {tasks.length === 0
                      ? "Crie a primeira tarefa para comecar."
                      : "Tente ajustar os filtros ou o termo da busca."}
                  </p>
                  {tasks.length === 0 ? (
                    <button className="primary-button empty-state-action" onClick={handleEmptyStateCta} type="button">
                      Criar primeira tarefa
                    </button>
                  ) : null}
                </div>
                ) : (
                  visibleTasks.map((task) => (
                  <article
                    className={task.completed ? "task-card is-done" : "task-card"}
                    draggable={
                      !task.completed &&
                      editingTaskId !== task.id &&
                      statusFilter === "all" &&
                      !normalizedSearchQuery
                    }
                    key={task.id}
                    onDragEnd={() => setDraggedTaskId("")}
                    onDragOver={(event) => {
                      if (!task.completed && draggedTaskId && draggedTaskId !== task.id) {
                        event.preventDefault();
                      }
                    }}
                    onDragStart={() => {
                      if (!task.completed) {
                        setDraggedTaskId(task.id);
                      }
                    }}
                    onDrop={(event) => {
                      event.preventDefault();
                      if (!task.completed && draggedTaskId && draggedTaskId !== task.id) {
                        movePendingTask(draggedTaskId, task.id);
                      }
                      setDraggedTaskId("");
                    }}
                  >
                    <div
                      className={editingTaskId === task.id ? "task-card-main" : "task-card-main is-clickable"}
                      onClick={(event) => handleTaskCardClick(event, task)}
                    >
                      <button
                        aria-label={task.completed ? "Marcar como pendente" : "Marcar como concluida"}
                        aria-pressed={task.completed}
                        className={task.completed ? "toggle is-done" : "toggle"}
                        onClick={() => handleToggleTask(task)}
                        type="button"
                      >
                        <span />
                      </button>

                      <div className="task-body">
                        {editingTaskId === task.id ? (
                          <form className="task-inline-form" onSubmit={(event) => handleInlineEditSubmit(event, task.id)}>
                            <div className="task-inline-row">
                              <input
                                className="task-inline-title"
                                maxLength={MAX_TASK_TITLE_LENGTH}
                                name="title"
                                onKeyDown={(event) => handleInlineEditKeyDown(event, task.id)}
                                onChange={handleInlineEditFieldChange}
                                placeholder="Titulo"
                                value={inlineEditForm.title}
                              />
                              <span className={task.completed ? "soft-badge is-done" : "soft-badge is-pending"}>
                                {task.completed ? "Concluida" : "Pendente"}
                              </span>
                            </div>
                            <textarea
                              className="task-inline-description"
                              name="description"
                              onKeyDown={(event) => handleInlineEditKeyDown(event, task.id)}
                              onChange={handleInlineEditFieldChange}
                              placeholder="Descricao"
                              rows="3"
                              value={inlineEditForm.description}
                            />
                            {inlineEditForm.title !== task.title ||
                            inlineEditForm.description !== (task.description || "") ? (
                              <p className="task-inline-hint">Alteracoes nao salvas</p>
                            ) : null}
                            <div className="task-inline-actions">
                              <button className="text-button" onClick={cancelEditTask} type="button">
                                Cancelar
                              </button>
                              <button className="primary-button inline-save-button" disabled={taskLoading} type="submit">
                                {taskLoading ? "Salvando..." : "Salvar"}
                              </button>
                            </div>
                          </form>
                        ) : (
                          <>
                            <div className="task-row">
                              <div className="task-copy">
                                <h3 className="task-title">{task.title}</h3>
                              </div>

                              <div className="task-row-right">
                                <span className={task.completed ? "soft-badge is-done" : "soft-badge is-pending"}>
                                  {task.completed ? "Concluida" : "Pendente"}
                                </span>
                                <div className="task-menu">
                                  <button
                                    aria-label="Mais acoes"
                                    aria-expanded={openTaskMenuId === task.id}
                                    aria-haspopup="menu"
                                    className="icon-button task-menu-trigger"
                                    onClick={(event) => toggleTaskMenu(event, task.id)}
                                    title="Mais acoes"
                                    type="button"
                                  >
                                    <MoreIcon />
                                  </button>
                                  {openTaskMenuId === task.id ? (
                                    <div className="task-menu-popover" role="menu">
                                      <button
                                        className="task-menu-item"
                                        onClick={() => startEditTask(task)}
                                        role="menuitem"
                                        type="button"
                                      >
                                        <EditIcon /> Editar
                                      </button>
                                      <button
                                        className="task-menu-item danger"
                                        onClick={() => handleDeleteTask(task.id)}
                                        role="menuitem"
                                        type="button"
                                      >
                                        <TrashIcon /> Excluir
                                      </button>
                                    </div>
                                  ) : null}
                                </div>
                              </div>
                            </div>

                            {task.description ? (
                              <div className="task-description-block">
                                <p
                                  className={
                                    expandedTaskIds.includes(task.id)
                                      ? "task-description task-aux is-expanded"
                                      : "task-description task-aux"
                                  }
                                >
                                  {task.description}
                                </p>
                                <p
                                  aria-hidden="true"
                                  className="task-description task-aux task-description-measure"
                                  ref={(node) => setDescriptionMeasureRef(task.id, node)}
                                >
                                  {task.description}
                                </p>
                                {collapsibleTaskIds.includes(task.id) ? (
                                  <button
                                    className="text-button task-description-toggle"
                                    onClick={() => toggleTaskDescription(task.id)}
                                    type="button"
                                  >
                                    {expandedTaskIds.includes(task.id) ? "Esconder" : "Visualizar"}
                                  </button>
                                ) : null}
                              </div>
                            ) : null}
                          </>
                        )}
                      </div>
                    </div>
                  </article>
                  ))
                )}
              </div>
            )}
          </article>
        </section>
        <button aria-label="Nova tarefa" className="mobile-fab" onClick={openTaskSheet} type="button">
          +
        </button>
        <div className={isTaskSheetOpen ? "mobile-sheet is-open" : "mobile-sheet"}>
          <button
            aria-label="Fechar nova tarefa"
            className="mobile-sheet-backdrop"
            onClick={closeTaskSheet}
            type="button"
          />
          <section className="mobile-sheet-panel">
            <div className="mobile-sheet-header">
              <div>
                <span className="eyebrow">Nova tarefa</span>
                <h2>Adicionar tarefa</h2>
              </div>
              <button className="ghost-button" onClick={closeTaskSheet} type="button">
                Fechar
              </button>
            </div>
            <form className="form" onSubmit={handleTaskSubmit}>
              <label className="field">
                <span>Titulo</span>
                <input
                  ref={mobileSheetTitleInputRef}
                  maxLength={MAX_TASK_TITLE_LENGTH}
                  name="title"
                  onChange={handleTaskFieldChange}
                  placeholder="Ex.: revisar API"
                  value={taskForm.title}
                />
              </label>
              <label className="field">
                <span>Descricao</span>
                <textarea
                  name="description"
                  onChange={handleTaskFieldChange}
                  placeholder="Detalhes opcionais"
                  rows="4"
                  value={taskForm.description}
                />
              </label>
              <button className="primary-button" disabled={taskLoading} type="submit">
                {taskLoading ? "Salvando..." : "Criar tarefa"}
              </button>
            </form>
          </section>
        </div>
      </section>
      {undoDeleteInfo ? (
        <div className="toast">
          <span>Tarefa "{undoDeleteInfo.title}" removida.</span>
          <button className="text-button toast-action" onClick={handleUndoDelete} type="button">
            Desfazer
          </button>
        </div>
      ) : null}
      {statusToast ? <div className={`status-toast ${statusToast.type}`}>{statusToast.text}</div> : null}
    </main>
  );
}

export default App;
