const TOKEN_KEY = 'cems_professor_token';
const STUDENT_KEY = 'cems_student_session';

function apiUrl(path) {
  return path;
}

async function api(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (options.body && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }
  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`;
  }
  const response = await fetch(apiUrl(path), {
    method: options.method || 'GET',
    headers,
    body: options.body
      ? options.body instanceof FormData
        ? options.body
        : JSON.stringify(options.body)
      : undefined,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || 'Something went wrong. Please try again.');
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data;
}

function professorToken() {
  return localStorage.getItem(TOKEN_KEY);
}

function setProfessorToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

function clearProfessor() {
  localStorage.removeItem(TOKEN_KEY);
}

function setStudentSession(session) {
  sessionStorage.setItem(STUDENT_KEY, JSON.stringify(session));
}

function getStudentSession() {
  try {
    return JSON.parse(sessionStorage.getItem(STUDENT_KEY) || 'null');
  } catch (error) {
    return null;
  }
}

function clearStudentSession() {
  sessionStorage.removeItem(STUDENT_KEY);
}

function showAlert(el, message, type = 'error') {
  if (!el) return;
  el.className = `alert ${type}`;
  el.textContent = message;
  el.classList.remove('hidden');
}

function hideAlert(el) {
  if (!el) return;
  el.classList.add('hidden');
}

function electionCodeFromLocation() {
  const parts = window.location.pathname.split('/').filter(Boolean);
  const idx = parts.findIndex((part) => part === 'election' || part === 'voting');
  if (idx >= 0 && parts[idx + 1]) {
    return parts[idx + 1].toUpperCase();
  }
  const params = new URLSearchParams(window.location.search);
  return (params.get('code') || '').toUpperCase();
}

function copyText(value) {
  return navigator.clipboard.writeText(value);
}

function formatDate(value) {
  return new Date(value).toLocaleString();
}
