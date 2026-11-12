const postgres = require('../../config/postgres');

// Equipos del dataset en PostgreSQL, por clave natural team_code.
async function findByCodes(teamCodes) {
  if (teamCodes.length === 0) return [];
  return postgres.query(`
    SELECT team_code, name, short_name, crest_url
    FROM team
    WHERE team_code = ANY($1::char(3)[])
  `, [teamCodes]);
}

module.exports = { findByCodes };
