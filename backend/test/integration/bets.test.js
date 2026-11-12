// Pruebas de integración de apuestas, roles y liquidación contra los contenedores reales.
//   docker compose exec backend npm run test:integration
// Cada caso queda en la tabla de docs/PRUEBAS.md (caso -> esperado -> obtenido).
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const request = require('supertest');
const app = require('../../server');
const betRepository = require('../../src/repositories/postgres/betRepository');
const accountRepository = require('../../src/repositories/postgres/accountRepository');
const postgres = require('../../src/config/postgres');
const h = require('./helpers');

let rich;          // usuario con 2.000.000 de saldo para los casos de validación
let openMatch;     // partido programado dentro de 24 h
const uuid = () => crypto.randomUUID();

function bet(user, body, key = uuid()) {
  return request(app).post('/api/bets').set('Cookie', user.cookie).set('Idempotency-Key', key).send(body);
}

const baseBody = () => ({ match_code: openMatch, market_code: '1X2', selection: 'HOME', stake: 1000 });
const summary = (response) => `${response.status}${response.body?.code ? ` ${response.body.code}` : ''}`;

before(async () => {
  await h.cleanup();
  rich = await h.createUser({ balance: 2000000 });
  openMatch = await h.createMatch();
});

after(async () => {
  h.writeReport();
  await h.cleanup();
  await h.closeAll();
});

// ---------- Monto ----------
const stakeCases = [
  ['stake 0', 0, '400 INVALID_STAKE'],
  ['stake negativo (-5000)', -5000, '400 INVALID_STAKE'],
  ['stake NaN (texto "NaN")', 'NaN', '400 INVALID_STAKE'],
  ['stake null', null, '400 INVALID_STAKE'],
  ['stake texto ("cinco mil")', 'cinco mil', '400 INVALID_STAKE'],
  ['stake numérico como texto ("5000")', '5000', '400 INVALID_STAKE'],
  ['stake con 3 decimales (1000.123)', 1000.123, '400 INVALID_STAKE'],
  ['stake mínimo - 1 (999)', 999, '400 STAKE_OUT_OF_RANGE'],
  ['stake mínimo (1000)', 1000, '201'],
  ['stake mínimo + 1 (1001)', 1001, '201'],
  ['stake con 2 decimales (1000.55)', 1000.55, '201'],
  ['stake máximo - 1 (499999)', 499999, '201'],
  ['stake máximo (500000)', 500000, '201'],
  ['stake máximo + 1 (500001)', 500001, '400 STAKE_OUT_OF_RANGE'],
];

for (const [caso, stake, esperado] of stakeCases) {
  test(caso, async () => {
    const response = await bet(rich, { ...baseBody(), stake });
    h.record(caso, esperado, summary(response));
    assert.equal(summary(response), esperado);
  });
}

test('stake igual al saldo: pasa y el saldo queda en 0', async () => {
  const user = await h.createUser({ balance: 20000 });
  const response = await bet(user, { ...baseBody(), stake: 20000 });
  const balance = await h.getBalance(user.username);
  h.record('stake igual al saldo (20.000 de 20.000)', '201 saldo 0', `${response.status} saldo ${balance}`);
  assert.equal(response.status, 201);
  assert.equal(balance, 0);
});

test('stake mayor al saldo: 409 y el saldo no cambia', async () => {
  const user = await h.createUser({ balance: 20000 });
  const response = await bet(user, { ...baseBody(), stake: 20001 });
  const balance = await h.getBalance(user.username);
  h.record('stake mayor al saldo (20.001 de 20.000)', '409 INSUFFICIENT_FUNDS saldo 20000', `${summary(response)} saldo ${balance}`);
  assert.equal(response.status, 409);
  assert.equal(balance, 20000);
});

// ---------- Cuota ----------
test('cuota alterada: expected_odds distinta responde 409 ODDS_CHANGED con la cuota nueva', async () => {
  const response = await bet(rich, { ...baseBody(), expected_odds: 9.99 });
  h.record('cuota alterada por el cliente (expected_odds 9.99, real 2.00)', '409 ODDS_CHANGED 2', `${summary(response)} ${response.body.current_odds}`);
  assert.equal(response.status, 409);
  assert.equal(response.body.current_odds, 2);
});

test('la cuota cambió en MySQL después de mostrarse: 409 con la nueva', async () => {
  const match = await h.createMatch();
  await h.setOdd(match, '1X2', 'AWAY', 0, '4.25');
  const response = await bet(rich, { ...baseBody(), match_code: match, selection: 'AWAY', expected_odds: 3.5 });
  h.record('cuota cambió en MySQL (3.50 -> 4.25)', '409 ODDS_CHANGED 4.25', `${summary(response)} ${response.body.current_odds}`);
  assert.equal(response.body.current_odds, 4.25);
});

test('el cliente no puede fijar la cuota: se apuesta con la de MySQL', async () => {
  const response = await bet(rich, { ...baseBody(), odds: 50, odd_value: 50 });
  h.record('cliente envía odds: 50 en el cuerpo', '201 cuota 2', `${response.status} cuota ${response.body.bet?.odds}`);
  assert.equal(response.body.bet.odds, 2);
});

// ---------- Partido y mercado ----------
test('partido iniciado (fecha pasada, aún programado): 409 MATCH_STARTED', async () => {
  const match = await h.createMatch({ minutesFromNow: -5 });
  const response = await bet(rich, { ...baseBody(), match_code: match });
  h.record('partido ya iniciado', '409 MATCH_STARTED', summary(response));
  assert.equal(summary(response), '409 MATCH_STARTED');
});

test('partido en juego (LIVE): 409 MATCH_NOT_OPEN', async () => {
  const match = await h.createMatch({ status: 1 });
  const response = await bet(rich, { ...baseBody(), match_code: match });
  h.record('partido en juego (LIVE)', '409 MATCH_NOT_OPEN', summary(response));
  assert.equal(summary(response), '409 MATCH_NOT_OPEN');
});

test('partido finalizado: 409 MATCH_NOT_OPEN', async () => {
  const match = await h.createMatch({ minutesFromNow: -200, status: 2 });
  const response = await bet(rich, { ...baseBody(), match_code: match });
  h.record('partido finalizado', '409 MATCH_NOT_OPEN', summary(response));
  assert.equal(summary(response), '409 MATCH_NOT_OPEN');
});

test('partido inexistente: 404 MATCH_NOT_FOUND', async () => {
  const response = await bet(rich, { ...baseBody(), match_code: 'ZZ999999' });
  h.record('partido inexistente (ZZ999999)', '404 MATCH_NOT_FOUND', summary(response));
  assert.equal(summary(response), '404 MATCH_NOT_FOUND');
});

test('mercado inexistente: 404 MARKET_NOT_FOUND', async () => {
  const response = await bet(rich, { ...baseBody(), market_code: 'CORNERS' });
  h.record('mercado inexistente (CORNERS)', '404 MARKET_NOT_FOUND', summary(response));
  assert.equal(summary(response), '404 MARKET_NOT_FOUND');
});

test('selección inexistente en un mercado válido: 400 INVALID_SELECTION', async () => {
  const response = await bet(rich, { ...baseBody(), selection: 'OVER' });
  h.record('selección que no es del mercado (1X2 / OVER)', '400 INVALID_SELECTION', summary(response));
  assert.equal(summary(response), '400 INVALID_SELECTION');
});

test('línea no permitida por MongoDB: 400 INVALID_SELECTION', async () => {
  const response = await bet(rich, { ...baseBody(), market_code: 'TOTAL_GOALS', selection: 'OVER', line: 3 });
  h.record('línea no permitida (TOTAL_GOALS 3.0)', '400 INVALID_SELECTION', summary(response));
  assert.equal(summary(response), '400 INVALID_SELECTION');
});

test('apuesta combinada (selections): 400 SIMPLE_BETS_ONLY', async () => {
  const response = await bet(rich, { ...baseBody(), selections: [{}, {}] });
  h.record('apuesta combinada (varias selecciones)', '400 SIMPLE_BETS_ONLY', summary(response));
  assert.equal(summary(response), '400 SIMPLE_BETS_ONLY');
});

// ---------- Usuario y sesión ----------
test('usuario inactivo con JWT válido: 403 USER_INACTIVE', async () => {
  const user = await h.createUser({ balance: 50000, status: 0 });
  const response = await bet(user, baseBody());
  h.record('usuario inactivo en SQL Server (JWT aún válido)', '403 USER_INACTIVE', summary(response));
  assert.equal(summary(response), '403 USER_INACTIVE');
});

test('JWT ausente: 401', async () => {
  const response = await request(app).post('/api/bets').set('Idempotency-Key', uuid()).send(baseBody());
  h.record('JWT ausente', '401', summary(response));
  assert.equal(response.status, 401);
});

test('JWT vencido: 401', async () => {
  const token = jwt.sign({ userId: rich.userId, username: rich.username, role: 'USR' }, process.env.JWT_SECRET, { expiresIn: -10 });
  const response = await request(app).post('/api/bets').set('Cookie', h.cookieFor(token)).set('Idempotency-Key', uuid()).send(baseBody());
  h.record('JWT vencido', '401', summary(response));
  assert.equal(response.status, 401);
});

test('JWT firmado con otra clave: 401', async () => {
  const token = jwt.sign({ userId: rich.userId, username: rich.username, role: 'ADM' }, 'otra-clave');
  const response = await request(app).get('/api/admin/matches').set('Cookie', h.cookieFor(token));
  h.record('JWT con firma falsa (rol ADM inventado)', '401', summary(response));
  assert.equal(response.status, 401);
});

test('sin Idempotency-Key: 400', async () => {
  const response = await request(app).post('/api/bets').set('Cookie', rich.cookie).send(baseBody());
  h.record('sin header Idempotency-Key', '400 IDEMPOTENCY_KEY_REQUIRED', summary(response));
  assert.equal(summary(response), '400 IDEMPOTENCY_KEY_REQUIRED');
});

// ---------- Roles ----------
test('USR llamando GET /api/admin/matches: 403', async () => {
  const response = await request(app).get('/api/admin/matches').set('Cookie', rich.cookie);
  h.record('USR -> GET /api/admin/matches', '403 FORBIDDEN_ROLE', summary(response));
  assert.equal(response.status, 403);
});

test('USR llamando POST /api/admin/matches/:code/finish: 403 y el partido no cambia', async () => {
  const response = await request(app).post(`/api/admin/matches/${openMatch}/finish`)
    .set('Cookie', rich.cookie).send({ home_goals: 1, away_goals: 0 });
  const matches = await request(app).get('/api/matches');
  const match = matches.body.matches.find((item) => item.match_code === openMatch);
  h.record('USR -> POST /api/admin/.../finish', '403 FORBIDDEN_ROLE SCHEDULED', `${summary(response)} ${match.status}`);
  assert.equal(response.status, 403);
  assert.equal(match.status, 'SCHEDULED');
});

test('ADM no puede apostar: 403', async () => {
  const admin = await h.createUser({ role: 'ADM' });
  const response = await bet(admin, baseBody());
  h.record('ADM -> POST /api/bets', '403 FORBIDDEN_ROLE', summary(response));
  assert.equal(response.status, 403);
});

test('el registro público siempre crea USR aunque pida ADM', async () => {
  const username = `zt_${crypto.randomBytes(4).toString('hex')}`;
  await request(app).post('/api/auth/register').send({
    fullName: 'Intento Admin', documentNumber: String(crypto.randomInt(1e9, 9.99e9)), birthDate: '1990-01-01',
    username, email: `${username}@pruebas.eldorado.local`, password: h.TEST_PASSWORD, role: 'ADM', role_id: 2,
  });
  const login = await request(app).post('/api/auth/login').send({ username, password: h.TEST_PASSWORD });
  h.record('registro público con role: ADM en el cuerpo', 'USR', login.body.user?.role);
  assert.equal(login.body.user.role, 'USR');
});

// ---------- Inyección SQL ----------
test('inyección SQL en match_code: 400 y las tablas siguen intactas', async () => {
  const response = await bet(rich, { ...baseBody(), match_code: "BP261801' OR '1'='1" });
  const rows = await postgres.query('SELECT count(*)::int AS total FROM bet');
  h.record("inyección en match_code (BP261801' OR '1'='1)", '400 INVALID_MATCH', summary(response));
  assert.equal(summary(response), '400 INVALID_MATCH');
  assert.ok(rows[0].total >= 0);
});

test('inyección SQL en market_code: 400', async () => {
  const response = await bet(rich, { ...baseBody(), market_code: "1X2'; DROP TABLE bet;--" });
  h.record("inyección en market_code (1X2'; DROP TABLE bet;--)", '400 INVALID_SELECTION', summary(response));
  assert.equal(summary(response), '400 INVALID_SELECTION');
});

test('inyección SQL en el login: 401', async () => {
  const response = await request(app).post('/api/auth/login').send({ username: "' OR 1=1 --", password: "' OR '1'='1" });
  h.record("inyección en el login (' OR 1=1 --)", '401', summary(response));
  assert.equal(response.status, 401);
});

// ---------- Idempotencia y concurrencia ----------
test('doble clic con la misma Idempotency-Key: una sola apuesta y un solo cobro', async () => {
  const user = await h.createUser({ balance: 50000 });
  const key = uuid();
  const body = { ...baseBody(), stake: 10000 };
  const [first, second] = await Promise.all([bet(user, body, key), bet(user, body, key)]);
  const statuses = [first.status, second.status].sort().join('+');
  const balance = await h.getBalance(user.username);
  const bets = await h.countBets(user.username);
  h.record('doble clic (2 peticiones simultáneas, misma Idempotency-Key)', '200+201 mismo tiquete 1 apuesta saldo 40000',
    `${statuses} ${first.body.bet.ticket_code === second.body.bet.ticket_code ? 'mismo' : 'distinto'} tiquete ${bets} apuesta saldo ${balance}`);
  assert.equal(statuses, '200+201');
  assert.equal(bets, 1);
  assert.equal(balance, 40000);
});

test('misma Idempotency-Key con otra apuesta: 409', async () => {
  const user = await h.createUser({ balance: 50000 });
  const key = uuid();
  await bet(user, { ...baseBody(), stake: 1000 }, key);
  const response = await bet(user, { ...baseBody(), stake: 2000 }, key);
  h.record('misma Idempotency-Key con otro monto', '409 IDEMPOTENCY_KEY_REUSED', summary(response));
  assert.equal(summary(response), '409 IDEMPOTENCY_KEY_REUSED');
});

test('CONCURRENCIA: 30.000 de saldo y dos apuestas simultáneas de 20.000, solo una pasa', async () => {
  const user = await h.createUser({ balance: 30000 });
  const body = { ...baseBody(), stake: 20000 };
  const responses = await Promise.all([bet(user, body), bet(user, body)]);
  const statuses = responses.map(summary).sort().join(' + ');
  const balance = await h.getBalance(user.username);
  const bets = await h.countBets(user.username);
  h.record('CONCURRENCIA: saldo 30.000, 2 × 20.000 a la vez', '201 + 409 INSUFFICIENT_FUNDS saldo 10000 1 apuesta',
    `${statuses} saldo ${balance} ${bets} apuesta`);
  assert.equal(statuses, '201 + 409 INSUFFICIENT_FUNDS');
  assert.equal(balance, 10000);
  assert.equal(bets, 1);
});

test('CONCURRENCIA ampliada: 10 apuestas simultáneas de 5.000 con 30.000 de saldo, pasan 6', async () => {
  const user = await h.createUser({ balance: 30000 });
  const responses = await Promise.all(Array.from({ length: 10 }, () => bet(user, { ...baseBody(), stake: 5000 })));
  const created = responses.filter((response) => response.status === 201).length;
  const balance = await h.getBalance(user.username);
  h.record('CONCURRENCIA: saldo 30.000, 10 × 5.000 a la vez', '6 creadas saldo 0', `${created} creadas saldo ${balance}`);
  assert.equal(created, 6);
  assert.equal(balance, 0);
});

// ---------- Liquidación ----------
test('ADM finaliza un partido 2-1 y se liquidan las apuestas con el saldo correcto', async () => {
  const match = await h.createMatch();
  const admin = await h.createUser({ role: 'ADM' });
  const winner = await h.createUser({ balance: 100000 });
  const loser = await h.createUser({ balance: 100000 });
  const pusher = await h.createUser({ balance: 100000 });
  const other = await h.createUser({ balance: 100000 });
  const body = (market_code, selection, stake, line = 0) => ({ match_code: match, market_code, selection, stake, line });

  assert.equal((await bet(winner, body('1X2', 'HOME', 10000))).status, 201);             // gana 10.000 × 2.00
  assert.equal((await bet(winner, body('TOTAL_GOALS', 'OVER', 10000, 2.5))).status, 201); // 3 goles > 2.5: gana × 2.10
  assert.equal((await bet(loser, body('1X2', 'AWAY', 10000))).status, 201);              // pierde
  assert.equal((await bet(pusher, body('HANDICAP', 'HOME', 10000, -1))).status, 201);    // 2 - 1 - 1 = 0: devuelve
  assert.equal((await bet(other, body('EXACT_SCORE', '2-1', 5000))).status, 201);        // gana × 8.00

  const before = await request(app).get('/api/admin/matches').set('Cookie', admin.cookie);
  const row = before.body.find((item) => item.match_code === match);
  assert.equal(row.open_bets, 5);

  const response = await request(app).post(`/api/admin/matches/${match}/finish`)
    .set('Cookie', admin.cookie).send({ home_goals: 2, away_goals: 1 });
  const balances = await Promise.all([winner, loser, pusher, other].map((user) => h.getBalance(user.username)));
  h.record('ADM finaliza 2-1 (5 apuestas: 3 ganan, 1 pierde, 1 devuelta)', '200 liquidadas 5 ganadas 3 perdidas 1 devueltas 1 pagado 91000',
    `${response.status} liquidadas ${response.body.settled} ganadas ${response.body.won} perdidas ${response.body.lost} devueltas ${response.body.refunded} pagado ${response.body.total_paid}`);
  h.record('saldos después de liquidar', '121000 90000 100000 135000', balances.join(' '));
  assert.equal(response.status, 200);
  // winner: 100.000 - 20.000 + 20.000 + 21.000 = 121.000; loser: 90.000; pusher: 100.000; other: 95.000 + 40.000.
  assert.deepEqual(balances, [121000, 90000, 100000, 135000]);

  const again = await request(app).post(`/api/admin/matches/${match}/finish`)
    .set('Cookie', admin.cookie).send({ home_goals: 0, away_goals: 0 });
  const afterAgain = await h.getBalance(winner.username);
  h.record('finalizar dos veces el mismo partido', '409 MATCH_ALREADY_FINISHED saldo 121000', `${summary(again)} saldo ${afterAgain}`);
  assert.equal(again.status, 409);
  assert.equal(afterAgain, 121000);

  const myBets = await request(app).get('/api/bets/me').set('Cookie', winner.cookie);
  const statuses = myBets.body.map((item) => item.status).sort().join(',');
  h.record('GET /api/bets/me del ganador', 'WON,WON', statuses);
  assert.equal(statuses, 'WON,WON');
});

test('marcador inválido al finalizar: 400', async () => {
  const admin = await h.createUser({ role: 'ADM' });
  const response = await request(app).post(`/api/admin/matches/${openMatch}/finish`)
    .set('Cookie', admin.cookie).send({ home_goals: -1, away_goals: 'dos' });
  h.record('marcador inválido (-1, "dos")', '400 INVALID_SCORE', summary(response));
  assert.equal(summary(response), '400 INVALID_SCORE');
});

test('finalizar partido inexistente: 404', async () => {
  const admin = await h.createUser({ role: 'ADM' });
  const response = await request(app).post('/api/admin/matches/ZZ999999/finish')
    .set('Cookie', admin.cookie).send({ home_goals: 1, away_goals: 0 });
  h.record('finalizar partido inexistente', '404 MATCH_NOT_FOUND', summary(response));
  assert.equal(summary(response), '404 MATCH_NOT_FOUND');
});

// ---------- Funciones PL/pgSQL directas ----------
test('fn_anular_apuesta reintegra solo si la apuesta está abierta', async () => {
  const user = await h.createUser({ balance: 10000 });
  const placed = await bet(user, { ...baseBody(), stake: 4000 });
  const [{ id }] = await postgres.query('SELECT id FROM bet WHERE ticket_code = $1', [placed.body.bet.ticket_code]);
  const result = await betRepository.cancelBet(id, 'prueba');
  const balance = await h.getBalance(user.username);
  let second = 'sin error';
  try { await betRepository.cancelBet(id, 'otra vez'); } catch (error) { second = error.message; }
  h.record('fn_anular_apuesta sobre abierta y luego sobre anulada', 'reintegra 4000 saldo 10000 luego BET_NOT_OPEN',
    `reintegra ${Number(result.refunded)} saldo ${balance} luego ${second}`);
  assert.equal(balance, 10000);
  assert.equal(second, 'BET_NOT_OPEN');
});

test('fn_recargar es idempotente por referencia', async () => {
  const user = await h.createUser();
  const first = await accountRepository.deposit(user.username, 15000, `TEST:recarga:${user.username}`);
  const second = await accountRepository.deposit(user.username, 15000, `TEST:recarga:${user.username}`);
  const balance = await h.getBalance(user.username);
  h.record('fn_recargar dos veces con la misma referencia', 'true false saldo 15000', `${first.credited} ${second.credited} saldo ${balance}`);
  assert.equal(balance, 15000);
});
