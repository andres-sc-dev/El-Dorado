// Carga en las bases los datos de API-Football que ya están en backend/data/apifootball/<season>/.
// NO llama a la API: solo lee archivos. Es idempotente (upsert por clave natural), así que se
// puede correr las veces que sea sin duplicar nada:
//   node scripts/seed/apifootball-load.js [--season=2024] [--quiet]
// PostgreSQL: team, player, player_position, team_stats (y player_stats si se bajaron jugadores).
// MySQL: league, stadium, matchday, match (histórico FINISHED + réplicas de demo SCHEDULED) y odds.
// Sin FOREIGN KEY entre motores: MySQL guarda team_code y PostgreSQL lo usa como clave natural.
const fs = require('node:fs');
const path = require('node:path');
require('dotenv').config({ quiet: true });

const postgres = require('../../src/config/postgres');
const mysql = require('../../src/config/mysql');
const { teamCodeFor, displayNames } = require('./teamCodes');
const { leagueAverage, buildMatchOdds } = require('./oddsModel');

const BACKEND_DIR = path.resolve(__dirname, '..', '..');
const DATA_DIR = path.join(BACKEND_DIR, 'data', 'apifootball');

// Réplicas de demo: las 3 primeras jornadas de la Finalización (Clausura) con fechas futuras.
const DEMO_LEAGUE = { code: 'DM', year: 2026, half: 2, name: 'Liga BetPlay · demo (réplica de 2024-II)' };
const DEMO_SOURCE_HALF = 'Clausura';
const DEMO_ROUNDS = [1, 2, 3];
// En match_code la jornada de la Finalización suma 50 (Apertura 01-26, Finalización 51-76),
// porque los dos torneos del año comparten liga (BP) y año (24) en el código.
const HALF_CODE_OFFSET = { 1: 0, 2: 50 };
const POSITION_BY_API = { Goalkeeper: 1, Defender: 2, Midfielder: 3, Attacker: 4 };

const args = Object.fromEntries(process.argv.slice(2).map((arg) => {
  const [key, value] = arg.replace(/^--/, '').split('=');
  return [key, value ?? true];
}));
const log = (...parts) => { if (!args.quiet) console.log(...parts); };
const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const readDir = (dir) => (fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => readJson(path.join(dir, f))) : []);

function latestSeason() {
  const seasons = fs.readdirSync(DATA_DIR).filter((d) => /^\d{4}$/.test(d) && fs.existsSync(path.join(DATA_DIR, d, 'teams.json')));
  if (!seasons.length) throw new Error('No hay datos descargados: corre primero apifootball-download.js');
  return Number(seasons.sort().at(-1));
}

// "Apertura - 7" -> { half: 1, number: 7 }; cuadrangulares 20-25 y final 26.
function parseRound(round) {
  const [stage, ...rest] = round.split(' - ');
  const half = stage === 'Apertura' ? 1 : 2;
  const tail = rest.join(' - ');
  let number;
  if (/^\d+$/.test(tail)) number = Number(tail);
  else if (/^Quadrangular - (\d+)$/.test(tail)) number = 19 + Number(tail.match(/(\d+)$/)[1]);
  else if (/^Final$/.test(tail)) number = 26;
  else return null;
  return { half, number, stage };
}

const pad2 = (n) => String(n).padStart(2, '0');
// Las columnas de texto de MySQL tienen tope (VARCHAR); se recorta por si la API trae algo más largo.
const cut = (text, max) => (text == null ? null : String(text).trim().slice(0, max));

function readSeasonData(season) {
  const dir = path.join(DATA_DIR, String(season));
  const teams = readJson(path.join(dir, 'teams.json')).response;
  const fixtures = fs.existsSync(path.join(dir, 'fixtures.json')) ? readJson(path.join(dir, 'fixtures.json')).response : [];
  const stats = readDir(path.join(dir, 'team-stats')).map((r) => r.response).filter(Boolean);
  const squads = readDir(path.join(dir, 'squads')).map((r) => r.response?.[0]).filter(Boolean);
  const playerPages = readDir(path.join(dir, 'players')).flatMap((r) => r.response || []);
  return { teams, fixtures, stats, squads, playerPages };
}

// ---------- Conteos (para comparar antes y después) ----------
const PG_TABLES = ['team', 'player', 'player_position', 'team_stats', 'player_stats', 'bet', 'bet_leg'];
const MY_TABLES = ['league', 'stadium', 'matchday', 'match', 'odds'];

async function counts() {
  const result = {};
  for (const table of PG_TABLES) {
    // Nombres de tabla fijos de la lista de arriba (no vienen del usuario).
    result[`pg.${table}`] = Number((await postgres.query(`SELECT count(*)::int AS n FROM ${table}`))[0].n);
  }
  for (const table of MY_TABLES) {
    result[`mysql.${table}`] = Number((await mysql.query(`SELECT COUNT(*) AS n FROM \`${table}\``))[0].n);
  }
  return result;
}

// ---------- PostgreSQL ----------
async function loadPostgres(season, data) {
  return postgres.transaction(async (client) => {
    await client.query(`
      INSERT INTO player_position (id_position, code, name) VALUES
        (1, 'GK', 'Portero'), (2, 'DF', 'Defensa'), (3, 'MF', 'Mediocampista'), (4, 'FW', 'Delantero')
      ON CONFLICT (id_position) DO UPDATE SET code = EXCLUDED.code, name = EXCLUDED.name
    `);

    // Equipos: upsert por team_code. Los 8 de la demo conservan su código y reciben el nombre real.
    const teamIdByApi = new Map();
    for (const { team } of data.teams) {
      const code = teamCodeFor(team);
      const { name, shortName } = displayNames(team, code);
      const founded = team.founded >= 1850 && team.founded <= 2100 ? team.founded : null;
      const { rows } = await client.query(`
        INSERT INTO team (team_code, api_football_id, name, short_name, country_code, founded, crest_url)
        VALUES ($1, $2, $3, $4, 'COL', $5, $6)
        ON CONFLICT (team_code) DO UPDATE SET
          api_football_id = EXCLUDED.api_football_id, name = EXCLUDED.name, short_name = EXCLUDED.short_name,
          founded = EXCLUDED.founded, crest_url = EXCLUDED.crest_url
        RETURNING id
      `, [code, team.id, name, shortName, founded, `/api/teams/${code}/crest`]);
      teamIdByApi.set(team.id, rows[0].id);
    }

    // Jugadores ficticios de la semilla: se reemplazan por los reales.
    await client.query(`
      DELETE FROM player_stats WHERE player_id IN (SELECT id FROM player WHERE api_football_id IS NULL AND name LIKE 'Jugador %')
    `);
    await client.query(`DELETE FROM player WHERE api_football_id IS NULL AND name LIKE 'Jugador %'`);

    // Plantillas: upsert por api_football_id. Nombres repetidos en un equipo llevan el dorsal.
    let players = 0;
    for (const squad of data.squads) {
      const teamId = teamIdByApi.get(squad.team.id);
      if (!teamId) continue;
      const seen = new Set();
      for (const p of squad.players) {
        let name = cut(p.name, 140);
        if (seen.has(name)) name = `${name} (${p.number ?? p.id})`;
        seen.add(name);
        const jersey = Number.isInteger(p.number) && p.number >= 1 && p.number <= 99 ? p.number : null;
        await client.query(`
          INSERT INTO player (api_football_id, team_id, name, position_id, jersey_number)
          VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT (api_football_id) DO UPDATE SET
            team_id = EXCLUDED.team_id, name = EXCLUDED.name,
            position_id = EXCLUDED.position_id, jersey_number = EXCLUDED.jersey_number
        `, [p.id, teamId, name, POSITION_BY_API[p.position] ?? null, jersey]);
        players += 1;
      }
    }

    // Estadísticas de la temporada por equipo.
    let teamStats = 0;
    for (const s of data.stats) {
      const teamId = teamIdByApi.get(s.team.id);
      const f = s.fixtures;
      if (!teamId || f.wins.total + f.draws.total + f.loses.total !== f.played.total) continue;
      await client.query(`
        INSERT INTO team_stats (team_id, season, matches_played, wins, draws, losses, goals_for, goals_against)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (team_id, season) DO UPDATE SET
          matches_played = EXCLUDED.matches_played, wins = EXCLUDED.wins, draws = EXCLUDED.draws,
          losses = EXCLUDED.losses, goals_for = EXCLUDED.goals_for, goals_against = EXCLUDED.goals_against
      `, [teamId, season, f.played.total, f.wins.total, f.draws.total, f.loses.total, s.goals.for.total.total, s.goals.against.total.total]);
      teamStats += 1;
    }
    // team_stats solo guarda temporadas descargadas: se quitan las cifras inventadas de la semilla.
    const downloaded = fs.readdirSync(DATA_DIR).filter((d) => /^\d{4}$/.test(d)).map(Number);
    await client.query('DELETE FROM team_stats WHERE NOT (season = ANY($1::smallint[]))', [downloaded]);

    // Estadísticas de jugador (solo si se descargaron las páginas de /players).
    // Un jugador de 2024 que ya no está en la plantilla actual se agrega con el equipo de esa
    // temporada; si ya existe (plantilla actual) no se cambia su equipo (DO NOTHING).
    let playerStats = 0;
    const leagueId = data.teams.length ? readJson(path.join(DATA_DIR, String(season), 'league.json')).league.id : null;
    for (const entry of data.playerPages) {
      const st = entry.statistics?.find((x) => x.league?.id === leagueId && x.league.season === season);
      if (!st) continue;
      const teamId = teamIdByApi.get(st.team?.id);
      if (teamId) {
        const birth = /^\d{4}-\d{2}-\d{2}$/.test(entry.player.birth?.date || '') ? entry.player.birth.date : null;
        await client.query(`
          INSERT INTO player (api_football_id, team_id, name, position_id, birth_date)
          VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT DO NOTHING
        `, [entry.player.id, teamId, cut(entry.player.name, 140), POSITION_BY_API[st.games?.position] ?? null, birth]);
      }
      const { rows } = await client.query('SELECT id FROM player WHERE api_football_id = $1', [entry.player.id]);
      if (!rows[0]) continue;
      const n = (v) => (Number.isInteger(v) && v >= 0 ? v : 0);
      await client.query(`
        INSERT INTO player_stats (player_id, season, matches_played, goals, assists, yellow_cards, red_cards)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (player_id, season) DO UPDATE SET
          matches_played = EXCLUDED.matches_played, goals = EXCLUDED.goals, assists = EXCLUDED.assists,
          yellow_cards = EXCLUDED.yellow_cards, red_cards = EXCLUDED.red_cards
      `, [rows[0].id, season, n(st.games?.appearences), n(st.goals?.total), n(st.goals?.assists), n(st.cards?.yellow), n(st.cards?.red)]);
      playerStats += 1;
    }

    return { teams: teamIdByApi.size, players, teamStats, playerStats };
  });
}

// ---------- MySQL ----------
async function mysqlTransaction(fn) {
  const connection = await mysql.getPool().getConnection();
  try {
    await connection.beginTransaction();
    const result = await fn(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback().catch(() => {});
    throw error;
  } finally {
    connection.release();
  }
}

async function upsertLeague(conn, { code, year, half, name }) {
  await conn.execute(`
    INSERT INTO league (code, country_id, sport_id, name, season_year, season_half)
    SELECT ?, c.id, s.id, ?, ?, ? FROM country c JOIN sport s ON s.code = 'FUT' WHERE c.code = 'COL'
    ON DUPLICATE KEY UPDATE name = VALUES(name)
  `, [code, cut(name, 150), year, half]);
  const [rows] = await conn.execute('SELECT id FROM league WHERE code = ? AND season_year = ? AND season_half = ?', [code, year, half]);
  return rows[0].id;
}

async function upsertMatchday(conn, leagueId, number, startDate) {
  await conn.execute(`
    INSERT INTO matchday (league_id, number, start_date) VALUES (?, ?, ?)
    ON DUPLICATE KEY UPDATE start_date = VALUES(start_date)
  `, [leagueId, number, startDate]);
  const [rows] = await conn.execute('SELECT id FROM matchday WHERE league_id = ? AND number = ?', [leagueId, number]);
  return rows[0].id;
}

// Todos los partidos con su código, liga y jornada ya calculados.
function planMatches(season, data) {
  const codeByApi = new Map(data.teams.map(({ team }) => [team.id, teamCodeFor(team)]));
  const venueByTeam = new Map(data.teams.map(({ team, venue }) => [team.id, venue]));
  const parsed = data.fixtures
    .map((f) => ({ f, round: parseRound(f.league.round) }))
    .filter(({ f, round }) => round && codeByApi.has(f.teams.home.id) && codeByApi.has(f.teams.away.id))
    .sort((a, b) => a.f.fixture.timestamp - b.f.fixture.timestamp || a.f.fixture.id - b.f.fixture.id);

  const counters = new Map();
  const real = parsed.map(({ f, round }) => {
    const key = `${round.half}-${round.number}`;
    counters.set(key, (counters.get(key) || 0) + 1);
    const venue = f.fixture.venue?.name ? f.fixture.venue : venueByTeam.get(f.teams.home.id);
    return {
      apiId: f.fixture.id,
      code: `BP${String(season).slice(-2)}${pad2(round.number + HALF_CODE_OFFSET[round.half])}${pad2(counters.get(key))}`,
      half: round.half, stage: round.stage, matchday: round.number,
      home: codeByApi.get(f.teams.home.id), away: codeByApi.get(f.teams.away.id),
      date: new Date(f.fixture.timestamp * 1000),
      homeGoals: f.goals.home, awayGoals: f.goals.away,
      finished: ['FT', 'AET', 'PEN'].includes(f.fixture.status.short) && f.goals.home !== null,
      venue: { name: cut(venue?.name, 150), city: cut(venue?.city, 100) || 'Sin ciudad' },
    };
  });

  // Réplicas de demo: mismas parejas, estadios y horas, con las fechas corridas para que la
  // primera quede mañana (UTC). Así se conserva el espaciado real entre jornadas.
  const source = real.filter((m) => m.stage === DEMO_SOURCE_HALF && DEMO_ROUNDS.includes(m.matchday));
  let demo = [];
  if (source.length) {
    const first = new Date(source[0].date);
    first.setUTCHours(0, 0, 0, 0);
    const tomorrow = new Date();
    tomorrow.setUTCHours(0, 0, 0, 0);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    const shift = tomorrow.getTime() - first.getTime();
    demo = source.map((m) => ({
      ...m,
      code: `${DEMO_LEAGUE.code}${String(DEMO_LEAGUE.year).slice(-2)}${m.code.slice(4)}`,
      matchday: m.matchday,
      date: new Date(m.date.getTime() + shift),
      sourceCode: m.code,
    }));
  }
  return { real, demo };
}

const toSqlDate = (date) => date.toISOString().slice(0, 19).replace('T', ' ');

async function loadMysql(season, data) {
  const { real, demo } = planMatches(season, data);
  const capacityByVenue = new Map(data.teams.map(({ venue }) => [venue.name, venue.capacity]));

  return mysqlTransaction(async (conn) => {
    await conn.execute(`INSERT IGNORE INTO match_status (id_status_match, code, name) VALUES
      (0, 'SCHEDULED', 'Programado'), (1, 'LIVE', 'En juego'), (2, 'FINISHED', 'Finalizado'), (3, 'CANCELLED', 'Cancelado')`);
    await conn.execute("INSERT IGNORE INTO country (code, name) VALUES ('COL', 'Colombia')");
    await conn.execute("INSERT IGNORE INTO sport (code, name) VALUES ('FUT', 'Fútbol')");

    const leagueIds = {
      1: await upsertLeague(conn, { code: 'BP', year: season, half: 1, name: `Liga BetPlay Dimayor ${season}-I` }),
      2: await upsertLeague(conn, { code: 'BP', year: season, half: 2, name: `Liga BetPlay Dimayor ${season}-II` }),
      demo: await upsertLeague(conn, DEMO_LEAGUE),
    };

    // Estadios: por nombre (UNIQUE). La capacidad sale de la sede de cada equipo cuando se conoce.
    const venues = new Map();
    for (const m of real) if (m.venue.name) venues.set(m.venue.name, m.venue.city);
    for (const { venue } of data.teams) if (venue?.name) venues.set(cut(venue.name, 150), cut(venue.city, 100) || 'Sin ciudad');
    const stadiumId = new Map();
    for (const [name, city] of venues) {
      const capacity = capacityByVenue.get(name) > 0 ? capacityByVenue.get(name) : null;
      await conn.execute(`
        INSERT INTO stadium (country_id, name, city, capacity)
        SELECT c.id, ?, ?, ? FROM country c WHERE c.code = 'COL'
        ON DUPLICATE KEY UPDATE city = VALUES(city), capacity = COALESCE(VALUES(capacity), capacity)
      `, [name, city, capacity]);
      const [rows] = await conn.execute('SELECT id FROM stadium WHERE name = ?', [name]);
      stadiumId.set(name, rows[0].id);
    }

    // Jornadas: la fecha de inicio es la del primer partido.
    const matchdayId = new Map();
    const ensureMatchday = async (leagueKey, number, date) => {
      const key = `${leagueKey}-${number}`;
      if (!matchdayId.has(key)) matchdayId.set(key, await upsertMatchday(conn, leagueIds[leagueKey], number, date.toISOString().slice(0, 10)));
      return matchdayId.get(key);
    };

    // Histórico real: FINISHED con marcador. Un partido real siempre se reescribe igual.
    let finished = 0;
    for (const m of real) {
      if (!m.finished || !m.venue.name) continue;
      const mdId = await ensureMatchday(m.half, m.matchday, m.date);
      await conn.execute(`
        INSERT INTO \`match\` (match_code, league_id, matchday_id, stadium_id, home_team_code, away_team_code,
                               match_date, status, home_goals, away_goals)
        VALUES (?, ?, ?, ?, ?, ?, ?, 2, ?, ?)
        ON DUPLICATE KEY UPDATE league_id = VALUES(league_id), matchday_id = VALUES(matchday_id),
          stadium_id = VALUES(stadium_id), home_team_code = VALUES(home_team_code), away_team_code = VALUES(away_team_code),
          match_date = VALUES(match_date), status = 2, home_goals = VALUES(home_goals), away_goals = VALUES(away_goals)
      `, [m.code, leagueIds[m.half], mdId, stadiumId.get(m.venue.name), m.home, m.away, toSqlDate(m.date), m.homeGoals, m.awayGoals]);
      finished += 1;
    }

    // Réplicas de demo: SCHEDULED y sin marcador. Si ya existen no se tocan su estado ni su marcador
    // (el administrador pudo finalizarlas); solo se corre la fecha si quedó en el pasado sin jugarse.
    for (const m of demo) {
      if (!m.venue.name) continue;
      const mdId = await ensureMatchday('demo', m.matchday, m.date);
      await conn.execute(`
        INSERT INTO \`match\` (match_code, league_id, matchday_id, stadium_id, home_team_code, away_team_code,
                               match_date, status, home_goals, away_goals)
        VALUES (?, ?, ?, ?, ?, ?, ?, 0, NULL, NULL)
        ON DUPLICATE KEY UPDATE match_date = IF(status = 0 AND match_date <= UTC_TIMESTAMP(), VALUES(match_date), match_date)
      `, [m.code, leagueIds.demo, mdId, stadiumId.get(m.venue.name), m.home, m.away, toSqlDate(m.date)]);
    }

    // Partidos de demo de la semilla (BP26…) que siguen programados con fecha pasada: se corren
    // semanas completas hasta quedar en el futuro. Se conservan (pueden tener apuestas) y siguen jugables.
    await conn.execute(`
      UPDATE \`match\` m JOIN league l ON l.id = m.league_id
      SET m.match_date = m.match_date + INTERVAL (FLOOR(TIMESTAMPDIFF(SECOND, m.match_date, UTC_TIMESTAMP()) / 604800) + 1) WEEK
      WHERE m.status = 0 AND m.match_date <= UTC_TIMESTAMP() AND l.code IN ('BP', 'DM') AND l.season_year >= 2026
    `);

    return { finished, demo: demo.length, stadiums: venues.size, demoCodes: demo.map((m) => m.code) };
  });
}

// Cuotas 1X2 y total de goles 2.5 de las réplicas SCHEDULED, con el modelo de oddsModel.js.
async function loadOdds(season) {
  const stats = await postgres.query(`
    SELECT t.team_code, s.matches_played, s.goals_for, s.goals_against
    FROM team_stats s JOIN team t ON t.id = s.team_id WHERE s.season = $1
  `, [season]);
  const byCode = new Map(stats.map((s) => [s.team_code, s]));
  const average = leagueAverage(stats);

  const matches = await mysql.query(`
    SELECT m.id, m.home_team_code, m.away_team_code FROM \`match\` m JOIN league l ON l.id = m.league_id
    WHERE l.code = ? AND m.status = 0
  `, [DEMO_LEAGUE.code]);
  let rows = 0;
  for (const m of matches) {
    for (const odd of buildMatchOdds(byCode.get(m.home_team_code), byCode.get(m.away_team_code), average)) {
      await mysql.query(`
        INSERT INTO odds (match_id, market_code, outcome_code, line, odd_value, is_active)
        VALUES (?, ?, ?, ?, ?, TRUE)
        ON DUPLICATE KEY UPDATE odd_value = VALUES(odd_value), is_active = TRUE
      `, [m.id, odd.market_code, odd.outcome_code, odd.line.toFixed(1), odd.odd_value.toFixed(2)]);
      rows += 1;
    }
  }
  return { matches: matches.length, rows, leagueAverage: Number(average.toFixed(3)) };
}

async function run({ season = latestSeason() } = {}) {
  const data = readSeasonData(season);
  const before = await counts();
  const pg = await loadPostgres(season, data);
  const my = await loadMysql(season, data);
  const odds = await loadOdds(season);
  const after = await counts();
  return { season, pg, mysql: my, odds, before, after };
}

async function main() {
  const result = await run({ season: args.season ? Number(args.season) : undefined });
  log(`Temporada: ${result.season}`);
  log(`PostgreSQL: ${result.pg.teams} equipos, ${result.pg.players} jugadores, ${result.pg.teamStats} team_stats, ${result.pg.playerStats} player_stats`);
  log(`MySQL: ${result.mysql.finished} partidos FINISHED, ${result.mysql.demo} réplicas demo, ${result.mysql.stadiums} estadios`);
  log(`Cuotas: ${result.odds.rows} filas para ${result.odds.matches} partidos SCHEDULED (promedio de liga ${result.odds.leagueAverage} goles por equipo)`);
  log('\nConteos           antes   después');
  for (const key of Object.keys(result.after)) {
    log(`${key.padEnd(18)}${String(result.before[key]).padStart(5)}   ${String(result.after[key]).padStart(5)}`);
  }
}

if (require.main === module) {
  main()
    .catch((error) => {
      console.error(`apifootball-load falló: ${error.message}`);
      process.exitCode = 1;
    })
    .finally(() => Promise.all([postgres.close(), mysql.close()]));
}

module.exports = { run, counts, planMatches, parseRound, readSeasonData, latestSeason, DEMO_LEAGUE };
