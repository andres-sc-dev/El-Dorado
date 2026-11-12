const accountService = require('../services/accountService');
const { parsePositiveInt } = require('../utils/validation');
const { forbidden } = require('../utils/httpError');

// Todas estas rutas devuelven solo los datos del dueño de la sesión (request.user).

function handle(fn) {
  return async (request, response, next) => {
    try {
      response.json(await fn(request));
    } catch (error) {
      next(error);
    }
  };
}

const getAccount = handle((request) => accountService.getAccount(request.user.username));
const listMovements = handle((request) => accountService.listMovements(request.user.username));
const listBets = handle((request) => accountService.listBets(request.user.username));
const getBet = handle((request) => accountService.getBet(request.user.username, parsePositiveInt(request.params.id)));
const getCustomer = handle((request) => accountService.getCustomer(request.user.userId));
const listLoginHistory = handle((request) => accountService.listLoginHistory(request.user.userId));

// GET /api/users/:id/balance: solo el propio usuario.
const getUserBalance = handle(async (request) => {
  const userId = parsePositiveInt(request.params.id);
  if (userId !== request.user.userId) throw forbidden('No puedes consultar el saldo de otro usuario');
  return { userId, balance: await accountService.getBalance(request.user.username) };
});

// Las apuestas se crearán con la función PL/pgSQL fn_crear_apuesta (Fase 2).
function placeBetUnavailable(request, response) {
  response.status(503).json({
    error: 'Las apuestas están deshabilitadas mientras se migran a PostgreSQL (Fase 2).',
    database: 'postgres',
  });
}

module.exports = {
  getAccount, listMovements, listBets, getBet, getCustomer, listLoginHistory, getUserBalance, placeBetUnavailable,
};
