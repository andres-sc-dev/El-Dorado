const mysql = require('../config/mysql');
const postgres = require('../config/postgres');
const marketRepository = require('./mongo/marketRepository');

// Recursos de solo lectura y públicos (no contienen datos personales).
// Cada recurso declara su motor: la ruta usa requireDb(engine) para responder 503
// solo cuando ESE motor está caído. El SQL es fijo; nada viene de la petición salvo el id.

const resources = {
  // ---------- MySQL ----------
  country: {
    engine: 'mysql', aliases: ['countries'],
    list: 'SELECT id, code, name FROM country ORDER BY name',
    byId: 'SELECT id, code, name FROM country WHERE id = ?',
  },
  sport: {
    engine: 'mysql', aliases: ['sports'],
    list: 'SELECT id, code, name FROM sport ORDER BY name',
    byId: 'SELECT id, code, name FROM sport WHERE id = ?',
  },
  league: {
    engine: 'mysql', aliases: ['leagues'],
    list: 'SELECT id, code, country_id, sport_id, name, season_year, season_half FROM league ORDER BY season_year DESC, name',
    byId: 'SELECT id, code, country_id, sport_id, name, season_year, season_half FROM league WHERE id = ?',
  },
  stadium: {
    engine: 'mysql', aliases: ['stadiums'],
    list: 'SELECT id, country_id, name, city, capacity FROM stadium ORDER BY name',
    byId: 'SELECT id, country_id, name, city, capacity FROM stadium WHERE id = ?',
  },
  matchday: {
    engine: 'mysql', aliases: ['matchdays'],
    list: 'SELECT id, league_id, number, start_date FROM matchday ORDER BY league_id, number',
    byId: 'SELECT id, league_id, number, start_date FROM matchday WHERE id = ?',
  },
  match: {
    engine: 'mysql', aliases: ['matches'],
    list: `SELECT m.id, m.match_code, m.league_id, m.matchday_id, m.stadium_id, m.home_team_code,
                  m.away_team_code, m.match_date, m.status, s.code AS status_code, m.home_goals, m.away_goals
           FROM \`match\` m JOIN match_status s ON s.id_status_match = m.status
           ORDER BY m.match_date`,
    byId: `SELECT m.id, m.match_code, m.league_id, m.matchday_id, m.stadium_id, m.home_team_code,
                  m.away_team_code, m.match_date, m.status, s.code AS status_code, m.home_goals, m.away_goals
           FROM \`match\` m JOIN match_status s ON s.id_status_match = m.status
           WHERE m.id = ?`,
  },
  odds: {
    engine: 'mysql', aliases: [],
    list: `SELECT o.id, o.match_id, m.match_code, o.market_code, o.outcome_code, o.line, o.odd_value, o.updated_at
           FROM odds o JOIN \`match\` m ON m.id = o.match_id
           WHERE o.is_active = TRUE
           ORDER BY o.match_id, o.market_code, o.line, o.outcome_code`,
    byId: `SELECT o.id, o.match_id, m.match_code, o.market_code, o.outcome_code, o.line, o.odd_value, o.updated_at
           FROM odds o JOIN \`match\` m ON m.id = o.match_id
           WHERE o.id = ?`,
  },

  // ---------- PostgreSQL ----------
  team: {
    engine: 'postgres', aliases: ['teams'],
    list: 'SELECT id, team_code, name, short_name, country_code, founded, crest_url FROM team ORDER BY name',
    byId: 'SELECT id, team_code, name, short_name, country_code, founded, crest_url FROM team WHERE id = $1',
  },
  player: {
    engine: 'postgres', aliases: ['players'],
    list: `SELECT p.id, p.team_id, t.team_code, p.name, pp.code AS position, p.jersey_number, p.nationality_code, p.birth_date
           FROM player p JOIN team t ON t.id = p.team_id LEFT JOIN player_position pp ON pp.id_position = p.position_id
           ORDER BY t.team_code, p.jersey_number`,
    byId: `SELECT p.id, p.team_id, t.team_code, p.name, pp.code AS position, p.jersey_number, p.nationality_code, p.birth_date
           FROM player p JOIN team t ON t.id = p.team_id LEFT JOIN player_position pp ON pp.id_position = p.position_id
           WHERE p.id = $1`,
  },
  team_stats: {
    engine: 'postgres', aliases: ['team-stats'],
    list: `SELECT s.id, s.team_id, t.team_code, s.season, s.matches_played, s.wins, s.draws, s.losses,
                  s.goals_for, s.goals_against, s.points
           FROM team_stats s JOIN team t ON t.id = s.team_id
           ORDER BY s.season DESC, s.points DESC`,
    byId: `SELECT s.id, s.team_id, t.team_code, s.season, s.matches_played, s.wins, s.draws, s.losses,
                  s.goals_for, s.goals_against, s.points
           FROM team_stats s JOIN team t ON t.id = s.team_id WHERE s.id = $1`,
  },
  player_stats: {
    engine: 'postgres', aliases: ['player-stats'],
    list: `SELECT s.id, s.player_id, p.name AS player_name, s.season, s.matches_played, s.goals, s.assists,
                  s.yellow_cards, s.red_cards
           FROM player_stats s JOIN player p ON p.id = s.player_id
           ORDER BY s.season DESC, s.goals DESC`,
    byId: `SELECT s.id, s.player_id, p.name AS player_name, s.season, s.matches_played, s.goals, s.assists,
                  s.yellow_cards, s.red_cards
           FROM player_stats s JOIN player p ON p.id = s.player_id WHERE s.id = $1`,
  },

  // ---------- MongoDB ----------
  game_rule: { engine: 'mongo', aliases: ['game-rules'], listFn: marketRepository.listGameRules },
  odds_market: { engine: 'mongo', aliases: ['markets'], listFn: marketRepository.listMarkets },
};

const runners = { mysql: mysql.query, postgres: postgres.query };

async function list(name) {
  const resource = resources[name];
  if (resource.listFn) return resource.listFn();
  return runners[resource.engine](resource.list);
}

async function getById(name, id) {
  const resource = resources[name];
  if (!resource.byId) return null;
  const rows = await runners[resource.engine](resource.byId, [id]);
  return rows[0] || null;
}

module.exports = { resources, list, getById };
