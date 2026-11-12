const crypto = require('crypto');
const postgres = require('../../config/postgres');

// Acceso al dinero en PostgreSQL. La cuenta se identifica por username (clave natural
// del usuario en SQL Server); no hay FOREIGN KEY entre motores.

function newAccountNumber() {
  return `ED-${crypto.randomBytes(5).toString('hex').toUpperCase()}`;
}

async function findByUsername(username) {
  const rows = await postgres.query(`
    SELECT a.account_number, a.username, a.currency, a.balance, s.code AS status, a.created_at
    FROM account a
    JOIN account_status s ON s.id_status_account = a.status
    WHERE a.username = $1
  `, [username]);
  return rows[0] || null;
}

// Idempotente: si la cuenta ya existe no hace nada.
async function ensureAccount(username) {
  await postgres.query(`
    INSERT INTO account (account_number, username)
    VALUES ($1, $2)
    ON CONFLICT (username) DO NOTHING
  `, [newAccountNumber(), username]);
  return findByUsername(username);
}

async function deleteEmptyAccount(username) {
  await postgres.query(`
    DELETE FROM account a
    WHERE a.username = $1 AND a.balance = 0
      AND NOT EXISTS (SELECT 1 FROM balance_movement m WHERE m.account_id = a.id)
  `, [username]);
}

async function getBalance(username) {
  const rows = await postgres.query('SELECT balance FROM account WHERE username = $1', [username]);
  return rows[0] ? Number(rows[0].balance) : null;
}

async function listMovements(username, limit = 50) {
  return postgres.query(`
    SELECT m.id, t.code AS type, t.name AS type_name, t.direction, m.amount,
           m.resulting_balance, m.reference, m.created_at
    FROM balance_movement m
    JOIN account a ON a.id = m.account_id
    JOIN movement_type t ON t.id_movement = m.movement_type
    WHERE a.username = $1
    ORDER BY m.created_at DESC, m.id DESC
    LIMIT $2
  `, [username, limit]);
}

// Recarga con la función PL/pgSQL fn_recargar (idempotente por referencia).
// Hoy la usa la semilla de demo; en la Fase 3 la usará el webhook de Wompi.
async function deposit(username, amount, reference) {
  const rows = await postgres.query(
    'SELECT fn_recargar($1, $2::numeric, $3) AS result',
    [username, String(amount), reference],
  );
  return rows[0].result;
}

// Copia BET_MIN_COP y BET_MAX_COP a la tabla bet_limit, que lee fn_crear_apuesta.
async function syncBetLimits({ min, max, currency }) {
  await postgres.query(`
    INSERT INTO bet_limit (currency, min_stake, max_stake) VALUES ($1, $2, $3)
    ON CONFLICT (currency) DO UPDATE
    SET min_stake = EXCLUDED.min_stake, max_stake = EXCLUDED.max_stake, updated_at = now()
  `, [currency, min, max]);
}

module.exports = {
  findByUsername, ensureAccount, deleteEmptyAccount, getBalance, listMovements, deposit, syncBetLimits,
};
