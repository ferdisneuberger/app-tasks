const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000/api";

async function request(path, options = {}) {
  const { headers, ...restOptions } = options;

  const response = await fetch(`${API_URL}${path}`, {
    ...restOptions,
    headers: {
      "Content-Type": "application/json",
      ...(headers || {}),
    },
  });

  const contentType = response.headers.get("content-type") || "";
  const data = contentType.includes("application/json") ? await response.json() : null;

  if (!response.ok) {
    throw new Error(data?.error || "Erro ao processar a requisicao.");
  }

  return data;
}

export async function createUser(payload) {
  return request("/users", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function login(payload) {
  return request("/auth/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function logout(token) {
  return request("/auth/logout", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export async function getProfile(token) {
  return request("/users/me", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export async function getUserPreferences(token) {
  return request("/users/preferences", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export async function updateUserPreferences(token, payload) {
  return request("/users/preferences", {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
}

export async function listTasks(token) {
  return request("/tasks", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export async function createTask(token, payload) {
  return request("/tasks", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
}

export async function updateTask(token, taskId, payload) {
  return request(`/tasks/${taskId}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
}

export async function deleteTask(token, taskId) {
  return request(`/tasks/${taskId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}
