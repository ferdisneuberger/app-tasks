import { useEffect, useState } from "react";
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
  const [loading, setLoading] = useState(false);
  const [taskLoading, setTaskLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

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
        setTasks(taskItems);
        localStorage.setItem("app-tasks-token", token);
        localStorage.setItem("app-tasks-user", JSON.stringify(profileUser));
      } catch (requestError) {
        if (cancelled) {
          return;
        }

        clearSession();
        setError(requestError.message);
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

  function clearFeedback() {
    setError("");
    setMessage("");
  }

  function clearSession() {
    setToken("");
    setUser(null);
    setTasks([]);
    localStorage.removeItem("app-tasks-token");
    localStorage.removeItem("app-tasks-user");
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
      setMessage("Conta criada. Agora faca login.");
      setMode("login");
      setAuthForm({
        name: "",
        email: authForm.email,
        password: "",
      });
    } catch (requestError) {
      setError(requestError.message);
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
      setError(requestError.message);
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
      setError(requestError.message);
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

      if (editingTaskId) {
        const { task } = await updateTask(token, editingTaskId, {
          title: taskForm.title,
          description: taskForm.description,
        });

        setTasks((current) => current.map((item) => (item.id === task.id ? task : item)));
        setMessage("Tarefa atualizada.");
      } else {
        const { task } = await createTask(token, {
          title: taskForm.title,
          description: taskForm.description,
          completed: false,
        });

        setTasks((current) => [task, ...current]);
        setMessage("Tarefa criada.");
      }

      setTaskForm(emptyTaskForm);
      setEditingTaskId("");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setTaskLoading(false);
    }
  }

  function startEditTask(task) {
    clearFeedback();
    setEditingTaskId(task.id);
    setTaskForm({
      title: task.title,
      description: task.description || "",
    });
  }

  function cancelEditTask() {
    clearFeedback();
    setEditingTaskId("");
    setTaskForm(emptyTaskForm);
  }

  async function handleToggleTask(task) {
    clearFeedback();

    try {
      const { task: updatedTask } = await updateTask(token, task.id, {
        completed: !task.completed,
      });

      setTasks((current) => current.map((item) => (item.id === updatedTask.id ? updatedTask : item)));
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  async function handleDeleteTask(taskId) {
    clearFeedback();

    try {
      await deleteTask(token, taskId);
      setTasks((current) => current.filter((item) => item.id !== taskId));

      if (editingTaskId === taskId) {
        cancelEditTask();
      }

      setMessage("Tarefa removida.");
    } catch (requestError) {
      setError(requestError.message);
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

              {error ? <p className="feedback error">{error}</p> : null}
              {message ? <p className="feedback success">{message}</p> : null}

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
          <div>
            <span className="eyebrow">Painel</span>
            <h1>Ola, {user.name}</h1>
            <p>Gerencie suas tarefas com foco no essencial.</p>
          </div>

          <div className="topbar-actions">
            <div className="soft-badge">
              {tasks.filter((task) => !task.completed).length} pendente(s)
            </div>
            <button className="ghost-button" onClick={handleLogout} type="button">
              Sair
            </button>
          </div>
        </header>

        <section className="content-grid">
          <article className="panel task-editor">
            <div className="section-header">
              <div>
                <span className="eyebrow">{editingTaskId ? "Edicao" : "Nova tarefa"}</span>
                <h2>{editingTaskId ? "Atualize a tarefa" : "Adicione uma tarefa"}</h2>
              </div>
              {editingTaskId ? (
                <button className="ghost-button" onClick={cancelEditTask} type="button">
                  Cancelar
                </button>
              ) : null}
            </div>

            <form onSubmit={handleTaskSubmit} className="form">
              <label className="field">
                <span>Titulo</span>
                <input
                  name="title"
                  value={taskForm.title}
                  onChange={handleTaskFieldChange}
                  placeholder="Ex.: revisar API"
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

              {error ? <p className="feedback error">{error}</p> : null}
              {message ? <p className="feedback success">{message}</p> : null}

              <button className="primary-button" disabled={taskLoading} type="submit">
                {taskLoading ? "Salvando..." : editingTaskId ? "Salvar alteracoes" : "Criar tarefa"}
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

            <div className="task-list">
              {tasks.length === 0 ? (
                <div className="empty-state">
                  <h3>Nenhuma tarefa ainda</h3>
                  <p>Crie a primeira tarefa para comecar.</p>
                </div>
              ) : (
                tasks.map((task) => (
                  <article className={task.completed ? "task-card is-done" : "task-card"} key={task.id}>
                    <div className="task-card-top">
                      <button
                        aria-label={task.completed ? "Marcar como pendente" : "Marcar como concluida"}
                        className={task.completed ? "toggle is-done" : "toggle"}
                        onClick={() => handleToggleTask(task)}
                        type="button"
                      >
                        <span />
                      </button>

                      <div className="task-copy">
                        <h3>{task.title}</h3>
                        <p>{task.description || "Sem descricao."}</p>
                      </div>
                    </div>

                    <div className="task-card-bottom">
                      <span className="soft-badge">
                        {task.completed ? "Concluida" : "Pendente"}
                      </span>

                      <div className="task-actions">
                        <button className="text-button" onClick={() => startEditTask(task)} type="button">
                          Editar
                        </button>
                        <button
                          className="text-button danger"
                          onClick={() => handleDeleteTask(task.id)}
                          type="button"
                        >
                          Excluir
                        </button>
                      </div>
                    </div>
                  </article>
                ))
              )}
            </div>
          </article>
        </section>
      </section>
    </main>
  );
}

export default App;
