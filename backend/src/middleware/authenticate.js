const { verifyToken } = require('../utils/token');

const SESSION_COOKIE = 'el_dorado_token';

function readCookie(request, name) {
  const header = request.headers.cookie || '';
  const cookie = header.split(';').map((item) => item.trim()).find((item) => item.startsWith(`${name}=`));
  return cookie ? decodeURIComponent(cookie.slice(name.length + 1)) : null;
}

// Exige una sesión válida. El usuario y el rol salen del JWT, nunca del cuerpo de la petición.
function authenticate(request, response, next) {
  const token = readCookie(request, SESSION_COOKIE)
    || (request.headers.authorization || '').replace(/^Bearer\s+/i, '');

  if (!token) {
    response.status(401).json({ error: 'Autenticación requerida' });
    return;
  }

  try {
    const payload = verifyToken(token);
    // Los tokens anteriores a la Fase 1 no traen username: se pide iniciar sesión otra vez.
    if (!payload.userId || !payload.username) {
      response.status(401).json({ error: 'Sesión inválida o expirada' });
      return;
    }
    request.user = { userId: payload.userId, username: payload.username, role: payload.role };
    next();
  } catch {
    response.status(401).json({ error: 'Sesión inválida o expirada' });
  }
}

module.exports = { authenticate, readCookie, SESSION_COOKIE };
