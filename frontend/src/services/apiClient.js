const API_BASE_URL = import.meta.env.VITE_API_URL || '';
// Tope de espera por petición: ninguna pantalla se queda cargando para siempre.
export const REQUEST_TIMEOUT_MS = 15000;

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
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    response = await fetch(`${API_BASE_URL}${endpoint}`, {
      credentials: 'include',
      ...options,
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', ...(headers || {}) },
    });
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new ApiError('El servidor tardó demasiado en responder. Intenta de nuevo.', 0, { code: 'TIMEOUT' });
    }
    throw new ApiError('No se pudo conectar con el servidor. Revisa tu conexión.', 0);
  } finally {
    clearTimeout(timer);
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
