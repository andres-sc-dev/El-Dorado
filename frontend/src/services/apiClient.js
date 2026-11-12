const API_BASE_URL = import.meta.env.VITE_API_URL || '';

// Error de la API con el código HTTP y el cuerpo JSON (code, current_odds, database...).
export class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.status = status;
    this.code = data?.code;
    this.data = data || {};
  }
}

async function request(endpoint, { headers, ...options } = {}) {
  let response;
  try {
    response = await fetch(`${API_BASE_URL}${endpoint}`, {
      credentials: 'include',
      ...options,
      headers: { 'Content-Type': 'application/json', ...(headers || {}) },
    });
  } catch {
    throw new ApiError('No se pudo conectar con el servidor. Revisa tu conexión.', 0);
  }

  if (response.status === 204) return null;

  let data = null;
  try {
    data = await response.json();
  } catch {
    // Respuesta sin JSON: se usa el código HTTP.
  }

  if (!response.ok) {
    const fallback = response.status === 503
      ? 'Un servicio no está disponible. Intenta de nuevo en unos minutos.'
      : `Error ${response.status}`;
    throw new ApiError(data?.error || fallback, response.status, data);
  }
  return data;
}

export const apiClient = {
  get: (endpoint) => request(endpoint, { method: 'GET' }),
  post: (endpoint, body, headers) => request(endpoint, { method: 'POST', body: JSON.stringify(body ?? {}), headers }),
  baseUrl: API_BASE_URL,
};

export default apiClient;
