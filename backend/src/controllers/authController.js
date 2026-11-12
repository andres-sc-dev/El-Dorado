const authService = require('../services/authService');
const { SESSION_COOKIE } = require('../middleware/authenticate');
const { getClientIp } = require('../utils/request');

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
    const user = await authService.register({ ...(request.body || {}), ipAddress: getClientIp(request) });
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

// Los retiros siguen deshabilitados: llegarán con su propia función PL/pgSQL.
function withdrawDisabled(request, response) {
  response.status(403).json({ error: 'Retiros próximamente. Por ahora están deshabilitados.' });
}

module.exports = { login, register, currentUser, logout, withdrawDisabled };
