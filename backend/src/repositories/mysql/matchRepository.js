const mysql = require('../../config/mysql');

// Partidos y cuotas en MySQL. Consultas parametrizadas; `match` es palabra reservada.
// Los equipos se identifican por team_code (sus nombres están en PostgreSQL).

const MATCH_SELECT = `
  SELECT m.id, m.match_code, m.home_team_code, m.away_team_code, m.match_date,
         s.code AS status, s.name AS status_name, m.home_goals, m.away_goals,
         l.code AS league_code, l.name AS league_name, l.season_year, l.season_half,
         md.number AS matchday, st.name AS stadium_name, st.city AS stadium_city
  FROM \`match\` m
  JOIN match_status s ON s.id_status_match = m.status
  JOIN league l       ON l.id = m.league_id
  JOIN matchday md    ON md.id = m.matchday_id
  JOIN stadium st     ON st.id = m.stadium_id
`;

// Días hacia atrás que cuentan como "actuales" (resultados recientes junto a los programados).
const RECENT_DAYS = 30;

// view 'current': programados o en juego, y cualquier partido de los últimos RECENT_DAYS días.
// view 'history': finalizados más viejos (el histórico real de API-Football), del más reciente al
// más antiguo, paginados y opcionalmente de un solo equipo.
async function listMatches({ view = 'current', teamCode = null, limit = 50, offset = 0 } = {}) {
  if (view === 'history') {
    const params = [RECENT_DAYS];
    let teamFilter = '';
    if (teamCode) {
      teamFilter = 'AND (m.home_team_code = ? OR m.away_team_code = ?)';
      params.push(teamCode, teamCode);
    }
    // mysql2 con execute exige LIMIT/OFFSET como texto; ya vienen validados como enteros.
    params.push(String(limit), String(offset));
    return mysql.query(`${MATCH_SELECT}
      WHERE s.code = 'FINISHED' AND m.match_date < UTC_TIMESTAMP() - INTERVAL ? DAY ${teamFilter}
      ORDER BY m.match_date DESC, m.match_code LIMIT ? OFFSET ?`, params);
  }
  return mysql.query(`${MATCH_SELECT}
    WHERE s.code IN ('SCHEDULED', 'LIVE') OR m.match_date >= UTC_TIMESTAMP() - INTERVAL ? DAY
    ORDER BY m.match_date, m.match_code`, [RECENT_DAYS]);
}

async function findByCode(matchCode) {
  const rows = await mysql.query(`${MATCH_SELECT} WHERE m.match_code = ?`, [matchCode]);
  return rows[0] || null;
}

async function findByCodes(matchCodes) {
  if (matchCodes.length === 0) return [];
  const placeholders = matchCodes.map(() => '?').join(', ');
  return mysql.query(`${MATCH_SELECT} WHERE m.match_code IN (${placeholders})`, matchCodes);
}

// Cuotas vigentes (is_active) de una lista de partidos.
async function listActiveOdds(matchIds) {
  if (matchIds.length === 0) return [];
  const placeholders = matchIds.map(() => '?').join(', ');
  return mysql.query(`
    SELECT o.match_id, o.market_code, o.outcome_code, o.line, o.odd_value
    FROM odds o
    WHERE o.is_active = TRUE AND o.match_id IN (${placeholders})
    ORDER BY o.match_id, o.market_code, o.line, o.outcome_code
  `, matchIds);
}

// La cuota vigente de una selección. La API apuesta con este valor, nunca con el del cliente.
async function findActiveOdd(matchId, marketCode, outcomeCode, line) {
  const rows = await mysql.query(`
    SELECT odd_value FROM odds
    WHERE match_id = ? AND market_code = ? AND outcome_code = ? AND line = ? AND is_active = TRUE
  `, [matchId, marketCode, outcomeCode, String(line)]);
  return rows[0] ? rows[0].odd_value : null;
}

// Marca el partido como FINISHED solo si sigue programado o en juego. Es atómico:
// si dos administradores lo finalizan a la vez, solo uno cambia la fila (affectedRows = 1).
async function finishMatch(matchCode, homeGoals, awayGoals) {
  const result = await mysql.query(`
    UPDATE \`match\`
    SET status = (SELECT id_status_match FROM match_status WHERE code = 'FINISHED'),
        home_goals = ?, away_goals = ?
    WHERE match_code = ?
      AND status IN (SELECT id_status_match FROM match_status WHERE code IN ('SCHEDULED', 'LIVE'))
  `, [homeGoals, awayGoals, matchCode]);
  return result.affectedRows === 1;
}

// Compensación: si la liquidación en PostgreSQL falla, el partido vuelve a su estado anterior.
async function revertFinish(matchCode, previousStatusCode) {
  await mysql.query(`
    UPDATE \`match\`
    SET status = (SELECT id_status_match FROM match_status WHERE code = ?),
        home_goals = NULL, away_goals = NULL
    WHERE match_code = ?
  `, [previousStatusCode, matchCode]);
}

module.exports = {
  listMatches, findByCode, findByCodes, listActiveOdds, findActiveOdd, finishMatch, revertFinish,
};
