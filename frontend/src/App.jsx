import { useEffect, useRef, useState } from "react";
import {
  createTask,
  createUser,
  deleteTask,
  getProfile,
  getUserPreferences,
  listTasks,
  login,
  logout,
  updateUserPreferences,
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
const MAX_NAME_LENGTH = 80;
const MAX_EMAIL_LENGTH = 254;
const MAX_PASSWORD_LENGTH = 128;
const MAX_TASK_TITLE_LENGTH = 100;
const MAX_TASK_DESCRIPTION_LENGTH = 1000;
const MAX_TASK_SEARCH_LENGTH = 120;
const LENGTH_WARNING_THRESHOLD = 0.9;
const STATUS_TOAST_DURATION_MS = 2600;
const THEME_SYNC_DEBOUNCE_MS = 300;
const THEME_STORAGE_KEY = "app-tasks-theme-cache-v1";
const DEFAULT_THEME = Object.freeze({
  baseColor: "#7aab9a",
  saturation: 100,
  intensity: 100,
});

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

function normalizeLeadingWhitespace(value) {
  return String(value).replace(/^\s+/, "");
}

function normalizeEdgeWhitespace(value) {
  return String(value).trim();
}

function getLimitWarning(value, maxLength) {
  if (String(value).length < Math.ceil(maxLength * LENGTH_WARNING_THRESHOLD)) {
    return "";
  }

  return `Voce esta perto do limite de ${maxLength} caracteres.`;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function isValidHexColor(value) {
  return typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value.trim());
}

function normalizeTheme(input = {}) {
  return {
    baseColor: isValidHexColor(input.baseColor) ? input.baseColor.toLowerCase() : DEFAULT_THEME.baseColor,
    saturation: clamp(Number(input.saturation) || DEFAULT_THEME.saturation, 40, 140),
    intensity: clamp(Number(input.intensity) || DEFAULT_THEME.intensity, 40, 140),
  };
}

function hexToHsl(hex) {
  const sanitized = hex.replace("#", "");
  const r = parseInt(sanitized.slice(0, 2), 16) / 255;
  const g = parseInt(sanitized.slice(2, 4), 16) / 255;
  const b = parseInt(sanitized.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const diff = max - min;

  let h = 0;
  if (diff !== 0) {
    if (max === r) {
      h = ((g - b) / diff) % 6;
    } else if (max === g) {
      h = (b - r) / diff + 2;
    } else {
      h = (r - g) / diff + 4;
    }
    h = Math.round(h * 60);
    if (h < 0) {
      h += 360;
    }
  }

  const l = (max + min) / 2;
  const s = diff === 0 ? 0 : diff / (1 - Math.abs(2 * l - 1));

  return {
    h,
    s: s * 100,
    l: l * 100,
  };
}

function toHsl(h, s, l) {
  return `hsl(${Math.round(h)} ${Math.round(s)}% ${Math.round(l)}%)`;
}

function applyThemeToDocument(themeInput) {
  const theme = normalizeTheme(themeInput);
  const baseHsl = hexToHsl(theme.baseColor);
  const saturationMultiplier = theme.saturation / 100;
  const intensityMultiplier = theme.intensity / 100;
  const h = baseHsl.h;
  const s = clamp(baseHsl.s * saturationMultiplier, 22, 88);
  const textS = clamp(s * 0.55, 12, 40);
  const main = clamp(42 * intensityMultiplier, 30, 56);
  const strong = clamp(main - 10, 20, 44);
  const soft = clamp(main + 24, 52, 78);
  const bgTop = clamp(96 - intensityMultiplier * 2, 88, 98);
  const bgBottom = clamp(93 - intensityMultiplier * 4, 80, 96);

  const root = document.documentElement;
  root.style.setProperty("--color-primary", toHsl(h, s, main));
  root.style.setProperty("--color-primary-strong", toHsl(h, s, strong));
  root.style.setProperty("--color-primary-soft", toHsl(h, s, soft));
  root.style.setProperty("--color-bg-start", toHsl(h, clamp(s * 0.36, 12, 42), bgTop));
  root.style.setProperty("--color-bg-end", toHsl(h, clamp(s * 0.32, 10, 34), bgBottom));
  root.style.setProperty("--color-surface-border", toHsl(h, clamp(s * 0.3, 10, 30), 72));
  root.style.setProperty("--color-text-main", toHsl(h, textS, 20));
  root.style.setProperty("--color-text-muted", toHsl(h, clamp(textS * 0.8, 10, 24), 42));
  root.style.setProperty("--color-badge-bg", toHsl(h, clamp(s * 0.25, 10, 30), 90));
  root.style.setProperty("--color-badge-text", toHsl(h, clamp(textS, 10, 26), 28));
  root.style.setProperty("--color-pending-bg", toHsl(h, clamp(s * 0.45, 18, 42), 88));
  root.style.setProperty("--color-pending-border", toHsl(h, clamp(s * 0.42, 16, 38), 74));
  root.style.setProperty("--color-done-bg", toHsl(h, clamp(s * 0.18, 8, 24), 93));
  root.style.setProperty("--color-done-border", toHsl(h, clamp(s * 0.2, 8, 24), 84));
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

function PaletteIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M12 3a9 9 0 1 0 0 18h1.2a2.8 2.8 0 0 0 0-5.6H12a1.6 1.6 0 0 1 0-3.2h2.7A5.3 5.3 0 0 0 20 6.9 3.9 3.9 0 0 0 16.1 3H12zm-5 8a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm3-4a1.3 1.3 0 1 1 0-2.6A1.3 1.3 0 0 1 10 7zm5.5.2a1.2 1.2 0 1 1 0-2.4 1.2 1.2 0 0 1 0 2.4z" />
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
  const [isListMenuOpen, setListMenuOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [undoDeleteInfo, setUndoDeleteInfo] = useState(null);
  const [statusToast, setStatusToast] = useState(null);
  const [themeConfig, setThemeConfig] = useState(DEFAULT_THEME);
  const [isThemePanelOpen, setThemePanelOpen] = useState(false);
  const descriptionMeasureRefs = useRef(new Map());
  const createTitleInputRef = useRef(null);
  const mobileSheetTitleInputRef = useRef(null);
  const pendingDeleteRef = useRef(null);
  const deleteTimeoutRef = useRef(null);
  const statusToastTimeoutRef = useRef(null);
  const themeSyncTimeoutRef = useRef(null);
  const themeSyncEnabledRef = useRef(false);

  useEffect(() => {
    const cachedThemeRaw = localStorage.getItem(THEME_STORAGE_KEY);
    if (cachedThemeRaw) {
      try {
        const cachedTheme = normalizeTheme(JSON.parse(cachedThemeRaw));
        setThemeConfig(cachedTheme);
        applyThemeToDocument(cachedTheme);
      } catch {
        setThemeConfig(DEFAULT_THEME);
        applyThemeToDocument(DEFAULT_THEME);
      }
      return;
    }

    applyThemeToDocument(DEFAULT_THEME);
  }, []);

  useEffect(() => {
    if (!token) {
      return;
    }

    let cancelled = false;

    async function loadSession() {
      try {
        setLoading(true);
        const [{ user: profileUser }, { tasks: taskItems }, preferencesResult] = await Promise.all([
          getProfile(token),
          listTasks(token),
          getUserPreferences(token).catch(() => null),
        ]);

        if (cancelled) {
          return;
        }

        setUser(profileUser);
        const savedOrder = localStorage.getItem(getTaskOrderKey(profileUser.id));
        const pendingOrder = savedOrder ? JSON.parse(savedOrder) : [];
        setTasks(orderTasks(taskItems, pendingOrder));
        if (preferencesResult?.preferences?.theme) {
          const normalizedTheme = normalizeTheme(preferencesResult.preferences.theme);
          setThemeConfig(normalizedTheme);
          applyThemeToDocument(normalizedTheme);
          localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(normalizedTheme));
        } else if (profileUser?.preferences?.theme) {
          const normalizedTheme = normalizeTheme(profileUser.preferences.theme);
          setThemeConfig(normalizedTheme);
          applyThemeToDocument(normalizedTheme);
          localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(normalizedTheme));
        }
        themeSyncEnabledRef.current = true;
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
    if (!isListMenuOpen) {
      return;
    }

    function handleOutsideClick(event) {
      if (!event.target.closest(".list-menu")) {
        setListMenuOpen(false);
      }
    }

    window.addEventListener("pointerdown", handleOutsideClick);
    return () => {
      window.removeEventListener("pointerdown", handleOutsideClick);
    };
  }, [isListMenuOpen]);

  useEffect(() => {
    if (!token || !user) {
      return;
    }

    if (!themeSyncEnabledRef.current) {
      return;
    }

    if (themeSyncTimeoutRef.current) {
      window.clearTimeout(themeSyncTimeoutRef.current);
    }

    themeSyncTimeoutRef.current = window.setTimeout(async () => {
      try {
        await updateUserPreferences(token, {
          theme: themeConfig,
        });
      } catch (requestError) {
        showStatusToast(requestError.message, "error");
      } finally {
        themeSyncTimeoutRef.current = null;
      }
    }, THEME_SYNC_DEBOUNCE_MS);

    return () => {
      if (themeSyncTimeoutRef.current) {
        window.clearTimeout(themeSyncTimeoutRef.current);
      }
    };
  }, [themeConfig, token, user]);

  useEffect(() => {
    return () => {
      if (deleteTimeoutRef.current) {
        window.clearTimeout(deleteTimeoutRef.current);
      }
      if (statusToastTimeoutRef.current) {
        window.clearTimeout(statusToastTimeoutRef.current);
      }
      if (themeSyncTimeoutRef.current) {
        window.clearTimeout(themeSyncTimeoutRef.current);
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

  useEffect(() => {
    if (!isThemePanelOpen) {
      return;
    }

    function handleEscape(event) {
      if (event.key === "Escape") {
        setThemePanelOpen(false);
      }
    }

    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("keydown", handleEscape);
    };
  }, [isThemePanelOpen]);

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
    setThemePanelOpen(false);
    themeSyncEnabledRef.current = false;
    if (themeSyncTimeoutRef.current) {
      window.clearTimeout(themeSyncTimeoutRef.current);
      themeSyncTimeoutRef.current = null;
    }
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
      [name]: normalizeLeadingWhitespace(value),
    }));
  }

  function handleAuthFieldBlur(event) {
    const { name, value } = event.target;
    setAuthForm((current) => ({
      ...current,
      [name]: normalizeEdgeWhitespace(value),
    }));
  }

  function handleTaskFieldChange(event) {
    const { name, value } = event.target;
    setTaskForm((current) => ({
      ...current,
      [name]: normalizeLeadingWhitespace(value),
    }));
  }

  function handleTaskFieldBlur(event) {
    const { name, value } = event.target;
    setTaskForm((current) => ({
      ...current,
      [name]: normalizeEdgeWhitespace(value),
    }));
  }

  function handleSearchQueryChange(event) {
    setSearchQuery(normalizeLeadingWhitespace(event.target.value).slice(0, MAX_TASK_SEARCH_LENGTH));
  }

  function handleSearchQueryBlur(event) {
    setSearchQuery(normalizeEdgeWhitespace(event.target.value));
  }

  function updateThemeConfig(nextTheme, options = {}) {
    const { sync = true } = options;
    const normalizedTheme = normalizeTheme(nextTheme);
    themeSyncEnabledRef.current = sync;
    setThemeConfig(normalizedTheme);
    applyThemeToDocument(normalizedTheme);
    localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(normalizedTheme));
  }

  function handleThemeColorChange(event) {
    updateThemeConfig({
      ...themeConfig,
      baseColor: event.target.value,
    });
  }

  function handleThemeSaturationChange(event) {
    updateThemeConfig({
      ...themeConfig,
      saturation: Number(event.target.value),
    });
  }

  function handleThemeIntensityChange(event) {
    updateThemeConfig({
      ...themeConfig,
      intensity: Number(event.target.value),
    });
  }

  function handleResetTheme() {
    updateThemeConfig(DEFAULT_THEME);
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
      if (result.user?.preferences?.theme) {
        updateThemeConfig(result.user.preferences.theme, { sync: false });
      }
      themeSyncEnabledRef.current = true;
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
      [name]: normalizeLeadingWhitespace(value),
    }));
  }

  function handleInlineEditFieldBlur(event) {
    const { name, value } = event.target;
    setInlineEditForm((current) => ({
      ...current,
      [name]: normalizeEdgeWhitespace(value),
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

  function formatTasksForNotionChecklist(taskItems) {
    const dateLabel = new Date().toLocaleString("pt-BR");
    const lines = [`# Tarefas exportadas (${dateLabel})`, ""];

    taskItems.forEach((task) => {
      lines.push(`- [${task.completed ? "x" : " "}] ${task.title}`);
      if (task.description) {
        lines.push(`  - ${task.description}`);
      }
    });

    return `${lines.join("\n")}\n`;
  }

  async function handleExportTasksForNotion() {
    setListMenuOpen(false);

    if (tasks.length === 0) {
      showStatusToast("Nao ha tarefas para exportar.", "error");
      return;
    }

    const checklist = formatTasksForNotionChecklist(tasks);

    try {
      await navigator.clipboard.writeText(checklist);
      showStatusToast("Checklist copiado. Cole no Notion.");
      return;
    } catch {
      const blob = new Blob([checklist], { type: "text/markdown;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "tarefas-notion.md";
      anchor.click();
      URL.revokeObjectURL(url);
      showStatusToast("Arquivo .md baixado para importar no Notion.");
    }
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
                    maxLength={MAX_NAME_LENGTH}
                    name="name"
                    value={authForm.name}
                    onBlur={handleAuthFieldBlur}
                    onChange={handleAuthFieldChange}
                    placeholder="Seu nome"
                  />
                </label>
              ) : null}

              <label className="field">
                <span>Email</span>
                <input
                  maxLength={MAX_EMAIL_LENGTH}
                  name="email"
                  type="email"
                  value={authForm.email}
                  onBlur={handleAuthFieldBlur}
                  onChange={handleAuthFieldChange}
                  placeholder="voce@exemplo.com"
                />
              </label>

              <label className="field">
                <span>Senha</span>
                <input
                  maxLength={MAX_PASSWORD_LENGTH}
                  name="password"
                  type="password"
                  value={authForm.password}
                  onBlur={handleAuthFieldBlur}
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
          <div className="topbar-right">
            <button
              aria-label="Personalizar tema"
              className="icon-button theme-icon-button"
              onClick={() => setThemePanelOpen(true)}
              title="Personalizar tema"
              type="button"
            >
              <PaletteIcon />
            </button>
            <button className="ghost-button topbar-logout" onClick={handleLogout} type="button">
              Sair
            </button>
          </div>
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
                <div className="field-label-row">
                  <span>Titulo</span>
                  <span className="field-counter">
                    {taskForm.title.length}/{MAX_TASK_TITLE_LENGTH}
                  </span>
                </div>
                <input
                  ref={createTitleInputRef}
                  maxLength={MAX_TASK_TITLE_LENGTH}
                  name="title"
                  value={taskForm.title}
                  onBlur={handleTaskFieldBlur}
                  onChange={handleTaskFieldChange}
                  placeholder="Ex.: revisar..."
                />
                {getLimitWarning(taskForm.title, MAX_TASK_TITLE_LENGTH) ? (
                  <p className="field-warning">{getLimitWarning(taskForm.title, MAX_TASK_TITLE_LENGTH)}</p>
                ) : null}
              </label>

              <label className="field">
                <div className="field-label-row">
                  <span>Descricao</span>
                  <span className="field-counter">
                    {taskForm.description.length}/{MAX_TASK_DESCRIPTION_LENGTH}
                  </span>
                </div>
                <textarea
                  maxLength={MAX_TASK_DESCRIPTION_LENGTH}
                  name="description"
                  value={taskForm.description}
                  onBlur={handleTaskFieldBlur}
                  onChange={handleTaskFieldChange}
                  rows="5"
                  placeholder="Detalhes opcionais"
                />
                {getLimitWarning(taskForm.description, MAX_TASK_DESCRIPTION_LENGTH) ? (
                  <p className="field-warning">
                    {getLimitWarning(taskForm.description, MAX_TASK_DESCRIPTION_LENGTH)}
                  </p>
                ) : null}
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
              <div className="section-header-actions">
                {loading ? <span className="soft-badge">Atualizando...</span> : null}
                <div className="list-menu">
                  <button
                    aria-label="Opcoes da lista"
                    aria-expanded={isListMenuOpen}
                    aria-haspopup="menu"
                    className="icon-button"
                    onClick={() => setListMenuOpen((current) => !current)}
                    title="Opcoes"
                    type="button"
                  >
                    <MoreIcon />
                  </button>
                  {isListMenuOpen ? (
                    <div className="list-menu-popover" role="menu">
                      <button className="task-menu-item" onClick={handleExportTasksForNotion} role="menuitem" type="button">
                        Exportar para Notion
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
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
                maxLength={MAX_TASK_SEARCH_LENGTH}
                onBlur={handleSearchQueryBlur}
                onChange={handleSearchQueryChange}
                placeholder="Buscar tarefas..."
                value={searchQuery}
              />
              {getLimitWarning(searchQuery, MAX_TASK_SEARCH_LENGTH) ? (
                <p className="field-warning task-search-warning">
                  {getLimitWarning(searchQuery, MAX_TASK_SEARCH_LENGTH)}
                </p>
              ) : null}
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
                    className={
                      task.completed
                        ? openTaskMenuId === task.id
                          ? "task-card is-done has-open-menu"
                          : "task-card is-done"
                        : openTaskMenuId === task.id
                          ? "task-card has-open-menu"
                          : "task-card"
                    }
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
                    <div className="task-card-main">
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
                                onBlur={handleInlineEditFieldBlur}
                                onKeyDown={(event) => handleInlineEditKeyDown(event, task.id)}
                                onChange={handleInlineEditFieldChange}
                                placeholder="Titulo"
                                value={inlineEditForm.title}
                              />
                            </div>
                            <textarea
                              className="task-inline-description"
                              maxLength={MAX_TASK_DESCRIPTION_LENGTH}
                              name="description"
                              onBlur={handleInlineEditFieldBlur}
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
                            <p className="task-inline-hint">
                              {inlineEditForm.title.length}/{MAX_TASK_TITLE_LENGTH} no titulo •{" "}
                              {inlineEditForm.description.length}/{MAX_TASK_DESCRIPTION_LENGTH} na descricao
                            </p>
                            {getLimitWarning(inlineEditForm.title, MAX_TASK_TITLE_LENGTH) ||
                            getLimitWarning(inlineEditForm.description, MAX_TASK_DESCRIPTION_LENGTH) ? (
                              <p className="field-warning task-inline-warning">
                                {getLimitWarning(inlineEditForm.title, MAX_TASK_TITLE_LENGTH) ||
                                  getLimitWarning(inlineEditForm.description, MAX_TASK_DESCRIPTION_LENGTH)}
                              </p>
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
                <div className="field-label-row">
                  <span>Titulo</span>
                  <span className="field-counter">
                    {taskForm.title.length}/{MAX_TASK_TITLE_LENGTH}
                  </span>
                </div>
                <input
                  ref={mobileSheetTitleInputRef}
                  maxLength={MAX_TASK_TITLE_LENGTH}
                  name="title"
                  onBlur={handleTaskFieldBlur}
                  onChange={handleTaskFieldChange}
                  placeholder="Ex.: revisar API"
                  value={taskForm.title}
                />
                {getLimitWarning(taskForm.title, MAX_TASK_TITLE_LENGTH) ? (
                  <p className="field-warning">{getLimitWarning(taskForm.title, MAX_TASK_TITLE_LENGTH)}</p>
                ) : null}
              </label>
              <label className="field">
                <div className="field-label-row">
                  <span>Descricao</span>
                  <span className="field-counter">
                    {taskForm.description.length}/{MAX_TASK_DESCRIPTION_LENGTH}
                  </span>
                </div>
                <textarea
                  maxLength={MAX_TASK_DESCRIPTION_LENGTH}
                  name="description"
                  onBlur={handleTaskFieldBlur}
                  onChange={handleTaskFieldChange}
                  placeholder="Detalhes opcionais"
                  rows="4"
                  value={taskForm.description}
                />
                {getLimitWarning(taskForm.description, MAX_TASK_DESCRIPTION_LENGTH) ? (
                  <p className="field-warning">
                    {getLimitWarning(taskForm.description, MAX_TASK_DESCRIPTION_LENGTH)}
                  </p>
                ) : null}
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
      {isThemePanelOpen ? (
        <div className="theme-modal" role="dialog" aria-modal="true" aria-label="Personalizar tema">
          <button
            aria-label="Fechar personalizacao de tema"
            className="theme-modal-backdrop"
            onClick={() => setThemePanelOpen(false)}
            type="button"
          />
          <section className="panel theme-modal-panel">
            <div className="theme-panel-header">
              <h2>Personalizar tema</h2>
              <div className="theme-modal-actions">
                <button className="text-button" onClick={handleResetTheme} type="button">
                  Resetar padrão
                </button>
                <button className="ghost-button" onClick={() => setThemePanelOpen(false)} type="button">
                  Fechar
                </button>
              </div>
            </div>
            <div className="theme-controls">
              <label className="field">
                <span>Cor principal</span>
                <input type="color" value={themeConfig.baseColor} onChange={handleThemeColorChange} />
              </label>
              <label className="field">
                <span>Saturação ({themeConfig.saturation}%)</span>
                <input
                  max="140"
                  min="40"
                  onChange={handleThemeSaturationChange}
                  step="1"
                  type="range"
                  value={themeConfig.saturation}
                />
              </label>
              <label className="field">
                <span>Intensidade ({themeConfig.intensity}%)</span>
                <input
                  max="140"
                  min="40"
                  onChange={handleThemeIntensityChange}
                  step="1"
                  type="range"
                  value={themeConfig.intensity}
                />
              </label>
            </div>
          </section>
        </div>
      ) : null}
      {statusToast ? <div className={`status-toast ${statusToast.type}`}>{statusToast.text}</div> : null}
    </main>
  );
}

export default App;
