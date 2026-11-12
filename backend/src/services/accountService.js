const accountRepository = require('../repositories/postgres/accountRepository');
const userRepository = require('../repositories/sqlserver/userRepository');
const betService = require('./bet.service');
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

function toMovement(row) {
  return {
    type: row.type,
    type_name: row.type_name,
    direction: Number(row.direction),
    amount: Number(row.amount),
    resulting_balance: Number(row.resulting_balance),
    reference: row.reference,
    created_at: row.created_at,
  };
}

async function listMovements(username) {
  return (await accountRepository.listMovements(username)).map(toMovement);
}

// GET /api/wallet/me: saldo y últimos movimientos.
async function getWallet(username) {
  const account = await getAccount(username);
  return {
    account_number: account.account_number,
    currency: account.currency,
    status: account.status,
    balance: account.balance,
    movements: await listMovements(username),
  };
}

async function listBets(username) {
  return betService.listMyBets(username);
}

async function getBet(username, ticketCode) {
  const bet = (await listBets(username)).find((item) => item.ticket_code === ticketCode);
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
  getAccount, getBalance, listMovements, getWallet, listBets, getBet, getCustomer, listLoginHistory,
};
