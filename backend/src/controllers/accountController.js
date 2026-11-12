const accountService = require('../services/accountService');
const { parsePositiveInt } = require('../utils/validation');
const { forbidden, notFound } = require('../utils/httpError');

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

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const getAccount = handle((request) => accountService.getAccount(request.user.username));
const getWallet = handle((request) => accountService.getWallet(request.user.username));
const listMovements = handle((request) => accountService.listMovements(request.user.username));
const listBets = handle((request) => accountService.listBets(request.user.username));
const getBet = handle((request) => {
  if (!UUID_PATTERN.test(request.params.ticketCode)) throw notFound('Apuesta no encontrada');
  return accountService.getBet(request.user.username, request.params.ticketCode.toLowerCase());
});
const getCustomer = handle((request) => accountService.getCustomer(request.user.userId));
const listLoginHistory = handle((request) => accountService.listLoginHistory(request.user.userId));

// GET /api/users/:id/balance: solo el propio usuario.
const getUserBalance = handle(async (request) => {
  const userId = parsePositiveInt(request.params.id);
  if (userId !== request.user.userId) throw forbidden('No puedes consultar el saldo de otro usuario');
  return { userId, balance: await accountService.getBalance(request.user.username) };
});

module.exports = {
  getAccount, getWallet, listMovements, listBets, getBet, getCustomer, listLoginHistory, getUserBalance,
};
