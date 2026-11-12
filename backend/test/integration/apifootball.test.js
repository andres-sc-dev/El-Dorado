// Fase 5 contra los contenedores reales: loader idempotente, cuotas, fechas, partidos reales,
// escudos, y una apuesta + finalización sobre un partido con equipos reales.
//   docker compose exec backend npm run test:integration
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const request = require('supertest');
const app = require('../../server');
const mysql = require('../../src/config/mysql');
const loader = require('../../scripts/seed/apifootball-load');
const h = require('./helpers');

const summary = (response) => `${response.status}${response.body?.code ? ` ${response.body.code}` : ''}`;

before(async () => {
  await h.cleanup();
});

after(async () => {
  h.writeReport(process.env.PRUEBAS_REPORT_F5 || require('path').join(__dirname, 'report-fase5.md'));
  await h.cleanup();
  await h.closeAll();
});

test('loader idempotente: correrlo dos veces no cambia los conteos', async () => {
  const first = await loader.run();
  const second = await loader.run();
  const changed = Object.keys(second.after).filter((key) => second.after[key] !== first.after[key]);
  h.record('loader dos veces seguidas: tablas que cambian de conteo', 'ninguna', changed.length ? changed.join(', ') : 'ninguna');
  h.record('loader: equipos / partidos FINISHED / réplicas demo', '20 / 432 / 30',
    `${second.pg.teams} / ${second.mysql.finished} / ${second.mysql.demo}`);
  assert.deepEqual(second.after, first.after);
  assert.deepEqual(second.before, second.after);
});

test('todas las cuotas de MySQL son mayores que 1', async () => {
  const [row] = await mysql.query('SELECT COUNT(*) AS bad, MIN(odd_value) AS min_odd FROM odds WHERE odd_value <= 1');
  const [all] = await mysql.query('SELECT MIN(odd_value) AS min_odd FROM odds');
  h.record('cuotas <= 1 en la tabla odds', '0', `${row.bad} (mínima ${all.min_odd})`.replace(/ \(.*/, ''));
  assert.equal(Number(row.bad), 0);
  assert.ok(Number(all.min_odd) > 1);
});

test('ningún partido SCHEDULED tiene fecha pasada', async () => {
  // Se excluyen los ZT…, que son partidos temporales de otras pruebas (algunos a propósito en el pasado).
  const [row] = await mysql.query(`
    SELECT COUNT(*) AS past FROM \`match\` m JOIN match_status s ON s.id_status_match = m.status
    WHERE s.code = 'SCHEDULED' AND m.match_date <= UTC_TIMESTAMP() AND m.match_code NOT LIKE 'ZT%'
  `);
  h.record('partidos SCHEDULED con fecha pasada', '0', row.past);
  assert.equal(Number(row.past), 0);
});

test('GET /api/matches muestra equipos reales y escudos; el histórico trae los resultados', async () => {
  const current = await request(app).get('/api/matches');
  const demo = current.body.matches.filter((m) => m.match_code.startsWith('DM'));
  const open = demo.filter((m) => m.is_betting_open && m.markets.some((k) => k.market_code === '1X2'));
  h.record('réplicas demo abiertas con 1X2 y total de goles', 'sí', open.length > 0 && open.every((m) => m.markets.some((k) => k.market_code === 'TOTAL_GOALS')) ? 'sí' : 'no');
  assert.equal(current.status, 200);
  assert.ok(open.length > 0);
  for (const m of demo) {
    assert.notEqual(m.home_team.name, m.home_team.team_code, 'el nombre real debe venir de PostgreSQL');
    assert.equal(m.home_team.crest_url, `/api/teams/${m.home_team.team_code}/crest`);
  }

  const history = await request(app).get('/api/matches?view=history&team=MIL&limit=5');
  h.record('histórico de Millonarios (5 más recientes, FINISHED con marcador)', '200 5 FINISHED',
    `${history.status} ${history.body.matches.length} ${[...new Set(history.body.matches.map((m) => m.status))].join(',')}`);
  assert.equal(history.status, 200);
  assert.ok(history.body.matches.every((m) => m.score && (m.home_team.team_code === 'MIL' || m.away_team.team_code === 'MIL')));

  const bad = await request(app).get('/api/matches?view=history&limit=abc');
  h.record('GET /api/matches?limit=abc', '400 INVALID_QUERY', summary(bad));
  assert.equal(bad.status, 400);
});

test('escudos: imagen real o genérico, nunca 500', async () => {
  const real = await request(app).get('/api/teams/NAC/crest');
  const generic = await request(app).get('/api/teams/XYZ/crest');
  h.record('GET /api/teams/NAC/crest', '200 image/png', `${real.status} ${real.headers['content-type']}`);
  h.record('GET /api/teams/XYZ/crest (sin escudo)', '200 generic', `${generic.status} ${generic.headers['x-crest-source']}`);
  assert.equal(real.status, 200);
  assert.equal(generic.status, 200);
});

test('apuesta y finalización por el admin sobre un partido con equipos reales', async () => {
  // Copia temporal (ZT…) de la primera réplica demo: mismos equipos y cuotas del modelo.
  // Así la prueba no finaliza los partidos de demo que se usan en la interfaz.
  const [source] = await mysql.query(`
    SELECT m.* FROM \`match\` m JOIN league l ON l.id = m.league_id
    WHERE l.code = 'DM' AND m.status = 0 AND m.match_date > UTC_TIMESTAMP() ORDER BY m.match_date LIMIT 1
  `);
  const code = `ZT${String(crypto.randomInt(0, 999999)).padStart(6, '0')}`;
  await mysql.query(`
    INSERT INTO \`match\` (match_code, league_id, matchday_id, stadium_id, home_team_code, away_team_code, match_date, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, 0)
  `, [code, source.league_id, source.matchday_id, source.stadium_id, source.home_team_code, source.away_team_code, source.match_date]);
  await mysql.query(`
    INSERT INTO odds (match_id, market_code, outcome_code, line, odd_value)
    SELECT (SELECT id FROM \`match\` WHERE match_code = ?), market_code, outcome_code, line, odd_value FROM odds WHERE match_id = ?
  `, [code, source.id]);
  const [{ odd_value: homeOdd }] = await mysql.query(
    "SELECT odd_value FROM odds WHERE match_id = ? AND market_code = '1X2' AND outcome_code = 'HOME'", [source.id],
  );

  const user = await h.createUser({ balance: 50000 });
  const admin = await h.createUser({ role: 'ADM' });
  const placed = await request(app).post('/api/bets').set('Cookie', user.cookie).set('Idempotency-Key', crypto.randomUUID())
    .send({ match_code: code, market_code: '1X2', selection: 'HOME', stake: 10000 });
  h.record(`apuesta 1X2 HOME de 10.000 en ${source.home_team_code}-${source.away_team_code}`, `201 cuota ${Number(homeOdd)}`,
    `${placed.status} cuota ${placed.body.bet?.total_odds ?? placed.body.bet?.odds ?? '?'}`.replace(/cuota (\d+\.\d+)$/, (_, v) => `cuota ${Number(v)}`));
  assert.equal(placed.status, 201);

  const finished = await request(app).post(`/api/admin/matches/${code}/finish`).set('Cookie', admin.cookie)
    .send({ home_goals: 2, away_goals: 0 });
  const balance = await h.getBalance(user.username);
  const expected = 40000 + Math.round(10000 * Number(homeOdd) * 100) / 100;
  h.record('ADM finaliza 2-0: la apuesta HOME gana y se paga', `200 ganadas 1 saldo ${expected}`,
    `${finished.status} ganadas ${finished.body.won} saldo ${balance}`);
  assert.equal(finished.status, 200);
  assert.equal(finished.body.won, 1);
  assert.equal(balance, expected);
});
