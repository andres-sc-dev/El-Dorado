const jwt = require('jsonwebtoken');

function readCookie(request, name) {
  const header = request.headers.cookie || '';
  const cookie = header.split(';').map((item) => item.trim()).find((item) => item.startsWith(`${name}=`));
  return cookie ? decodeURIComponent(cookie.slice(name.length + 1)) : null;
}

function authenticate(request, response, next) {
  const token = readCookie(request, 'el_dorado_token')
    || (request.headers.authorization || '').replace(/^Bearer\s+/i, '');

  if (!token) {
    response.status(401).json({ error: 'Autenticación requerida' });
    return;
  }

  try {
    request.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch (error) {
    response.status(401).json({ error: 'Sesión inválida o expirada' });
  }
}

module.exports = { authenticate, readCookie };
