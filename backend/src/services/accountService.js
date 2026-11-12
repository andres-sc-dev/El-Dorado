const accountRepository = require('../repositories/postgres/accountRepository');
const userRepository = require('../repositories/sqlserver/userRepository');
const { notFound } = require('../utils/httpError');

// Datos del dueño de la sesión. El usuario siempre sale del JWT (request.user).

async function getAccount(username) {
  const account = await accountRepository.findByUsername(username);
  if (!account) throw notFound('No tienes una cuenta creada');
  return { ...account, balance: Number(account.balance) };
}

async function getBalance(username) {
  const balance = await accountRepository.getBalance(username);
  if (balance === null) throw notFound('No tienes una cuenta creada');
  return balance;
}

async function listMovements(username) {
  return accountRepository.listMovements(username);
}

// Solo apuestas simples: cada fila del repositorio es un tiquete con su única selección.
// El detalle del partido (equipos, fecha) vive en MySQL y se combinará en la Fase 2.
async function listBets(username) {
  const rows = await accountRepository.listBets(username);
  return rows.map((row) => ({
    id: Number(row.id),
    ticketCode: row.ticket_code,
    stake: Number(row.stake),
    totalOdds: Number(row.total_odds),
    potentialPayout: Number(row.potential_payout),
    status: row.status,
    createdAt: row.placed_at,
    settledAt: row.settled_at,
    selections: [{
      matchCode: row.match_code,
      marketCode: row.market_code,
      outcomeCode: row.outcome_code,
      line: Number(row.line),
      oddValueAtBetTime: Number(row.odd_value),
      result: row.leg_status,
    }],
  }));
}

async function getBet(username, betId) {
  const bet = (await listBets(username)).find((item) => item.id === betId);
  if (!bet) throw notFound('Apuesta no encontrada');
  return bet;
}

async function getCustomer(userId) {
  const customer = await userRepository.findCustomerByUserId(userId);
  if (!customer) throw notFound('No tienes datos de cliente registrados');
  return customer;
}

async function listLoginHistory(userId) {
  return userRepository.listLoginHistory(userId);
}

module.exports = {
  getAccount, getBalance, listMovements, listBets, getBet, getCustomer, listLoginHistory,
};
