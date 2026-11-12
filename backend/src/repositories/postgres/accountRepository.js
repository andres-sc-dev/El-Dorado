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

async function listBets(username, limit = 50) {
  return postgres.query(`
    SELECT b.id, b.ticket_code, b.stake, b.total_odds, b.potential_payout,
           s.code AS status, b.placed_at, b.settled_at,
           l.match_code, l.market_code, l.outcome_code, l.line, l.odd_value,
           ls.code AS leg_status
    FROM bet b
    JOIN account a ON a.id = b.account_id
    JOIN bet_status s ON s.id_status_bet = b.status
    JOIN bet_leg l ON l.bet_id = b.id
    JOIN bet_status ls ON ls.id_status_bet = l.status
    WHERE a.username = $1
    ORDER BY b.placed_at DESC, b.id DESC
    LIMIT $2
  `, [username, limit]);
}

// Saldo inicial de la semilla de demo. Una sola sentencia atómica: bloquea la cuenta
// (FOR UPDATE), inserta el movimiento y actualiza el saldo. Si la referencia ya existe,
// ON CONFLICT no inserta nada y el saldo no cambia, así la semilla se puede repetir.
// En la Fase 2 esto se reemplaza por la función fn_recargar.
async function seedDeposit(username, amount, reference) {
  const rows = await postgres.query(`
    WITH acc AS (
      SELECT id, balance FROM account WHERE username = $1 FOR UPDATE
    ), movement AS (
      INSERT INTO balance_movement (account_id, movement_type, amount, resulting_balance, reference)
      SELECT id, 1, $2, balance + $2, $3 FROM acc
      ON CONFLICT (reference) DO NOTHING
      RETURNING account_id, resulting_balance
    )
    UPDATE account a
    SET balance = movement.resulting_balance, updated_at = now()
    FROM movement
    WHERE a.id = movement.account_id
    RETURNING a.balance
  `, [username, amount, reference]);
  return rows.length > 0;
}

module.exports = {
  findByUsername, ensureAccount, deleteEmptyAccount, getBalance, listMovements, listBets, seedDeposit,
};
