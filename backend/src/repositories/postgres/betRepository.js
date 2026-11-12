const postgres = require('../../config/postgres');

// Apuestas en PostgreSQL. Crear, liquidar y anular se hace solo con funciones PL/pgSQL
// (database/postgres/03_bets.sql); aquí no hay INSERT ni UPDATE de dinero.

async function createBet({
  username, matchCode, marketCode, outcomeCode, line, stake, odds, idempotencyKey,
}) {
  const rows = await postgres.query(
    'SELECT fn_crear_apuesta($1, $2, $3, $4, $5::numeric, $6::numeric, $7::uuid, $8::numeric) AS ticket',
    [username, matchCode, marketCode, outcomeCode, stake, odds, idempotencyKey, line],
  );
  return rows[0].ticket;
}

async function settleMatch(matchCode, resultado) {
  const rows = await postgres.query(
    'SELECT fn_liquidar_partido($1, $2::jsonb) AS summary',
    [matchCode, JSON.stringify(resultado)],
  );
  return rows[0].summary;
}

async function cancelBet(betId, reason) {
  const rows = await postgres.query('SELECT fn_anular_apuesta($1, $2) AS result', [betId, reason]);
  return rows[0].result;
}

// Selecciones distintas con apuestas abiertas en un partido: la API calcula el resultado de cada una.
async function listOpenSelections(matchCode) {
  return postgres.query(`
    SELECT DISTINCT l.market_code, l.outcome_code, l.line
    FROM bet_leg l
    JOIN bet b ON b.id = l.bet_id
    JOIN bet_status s ON s.id_status_bet = b.status
    WHERE l.match_code = $1 AND s.code = 'OPEN'
  `, [matchCode]);
}

// Apuestas abiertas por partido (para el panel de administración).
async function countOpenByMatch() {
  return postgres.query(`
    SELECT l.match_code, count(*)::int AS open_bets, COALESCE(sum(b.stake), 0) AS open_stake
    FROM bet_leg l
    JOIN bet b ON b.id = l.bet_id
    JOIN bet_status s ON s.id_status_bet = b.status
    WHERE s.code = 'OPEN'
    GROUP BY l.match_code
  `);
}

async function listByUsername(username, limit = 100) {
  return postgres.query(`
    SELECT b.id, b.ticket_code, b.stake, b.total_odds, b.potential_payout,
           s.code AS status, s.name AS status_name, b.placed_at, b.settled_at,
           l.match_code, l.market_code, l.outcome_code, l.line, l.odd_value
    FROM bet b
    JOIN account a    ON a.id = b.account_id
    JOIN bet_status s ON s.id_status_bet = b.status
    JOIN bet_leg l    ON l.bet_id = b.id
    WHERE a.username = $1
    ORDER BY b.placed_at DESC, b.id DESC
    LIMIT $2
  `, [username, limit]);
}

module.exports = {
  createBet, settleMatch, cancelBet, listOpenSelections, countOpenByMatch, listByUsername,
};
