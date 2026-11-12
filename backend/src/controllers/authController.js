const authService = require('../services/authService');
const { SESSION_COOKIE } = require('../middleware/authenticate');

function getClientIp(request) {
  return request.ip ? request.ip.replace('::ffff:', '') : null;
}

function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.COOKIE_SECURE === 'true',
    sameSite: process.env.COOKIE_SAMESITE || 'lax',
    maxAge: 2 * 60 * 60 * 1000,
    path: '/',
  };
}

async function login(request, response, next) {
  try {
    const body = request.body || {};
    const { token, user } = await authService.login({
      identifier: body.username || body.email,
      password: body.password,
      ipAddress: getClientIp(request),
    });
    response.cookie(SESSION_COOKIE, token, sessionCookieOptions());
    response.status(200).json({ user });
  } catch (error) {
    next(error);
  }
}

async function register(request, response, next) {
  try {
    const user = await authService.register(request.body || {});
    response.status(201).json({ user });
  } catch (error) {
    next(error);
  }
}

async function currentUser(request, response, next) {
  try {
    response.json({ user: await authService.currentUser(request.user.userId) });
  } catch (error) {
    next(error);
  }
}

function logout(request, response) {
  response.clearCookie(SESSION_COOKIE, { ...sessionCookieOptions(), maxAge: undefined });
  response.status(204).send();
}

// Parche de seguridad: el depósito directo sumaba saldo sin ningún pago.
// El saldo solo subirá con Wompi (Fase 3). El saldo de prueba entra por la semilla.
function depositDisabled(request, response) {
  response.status(403).json({ error: 'Recargas con Wompi próximamente. El depósito directo está deshabilitado.' });
}

// Los retiros también movían dinero desde Node; vuelven cuando existan las funciones PL/pgSQL.
function withdrawDisabled(request, response) {
  response.status(403).json({ error: 'Los retiros están deshabilitados temporalmente.' });
}

module.exports = { login, register, currentUser, logout, depositDisabled, withdrawDisabled };
