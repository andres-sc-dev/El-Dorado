// Pruebas del parche de seguridad de la Fase 1.
// No necesitan bases de datos: las rutas protegidas deben rechazar la petición
// antes de tocar cualquier motor. Para comprobar el 503, los motores apuntan a un
// puerto cerrado (127.0.0.1:1), que rechaza la conexión al instante.
//   npm test
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');

process.env.JWT_SECRET = 'test-secret-solo-para-pruebas-automatizadas';
process.env.SQLSERVER_HOST = '127.0.0.1';
process.env.SQLSERVER_PORT = '1';
process.env.MYSQL_HOST = '127.0.0.1';
process.env.MYSQL_PORT = '1';
process.env.POSTGRES_HOST = '127.0.0.1';
process.env.POSTGRES_PORT = '1';
process.env.MONGO_URI = 'mongodb://127.0.0.1:1/?serverSelectionTimeoutMS=500';

const app = require('../server');
const { createToken } = require('../src/utils/token');
const databases = require('../src/config/databases');

let server;
let baseUrl;
const userCookie = `el_dorado_token=${createToken({ userId: 7, username: 'prueba', role: 'USR' })}`;

before(async () => {
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  await databases.closeAll();
});

async function call(method, path, { cookie, body } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  return { status: response.status, body: text ? JSON.parse(text) : null };
}

// 1. Escrituras genéricas: 403 con o sin sesión.
const genericWrites = [
  ['POST', '/api/balance_movement', { account_id: 1, type: 1, amount: 999999, resulting_balance: 999999 }],
  ['POST', '/api/balance-movements', { amount: 1 }],
  ['POST', '/api/account', { customer_id: 1, account_number: 'X' }],
  ['POST', '/api/customer', { user_id: 1 }],
  ['POST', '/api/match', { league_id: 1 }],
  ['POST', '/api/odds', { match_id: 1, odd_value: 99 }],
  ['POST', '/api/team', { name: 'X' }],
  ['POST', '/api/users', { username: 'x', password: 'x' }],
  ['POST', '/api/catalogs/bet_status', { name: 'X' }],
  ['PUT', '/api/match/1', { status: 2 }],
  ['PATCH', '/api/odds/1', { odd_value: 50 }],
  ['DELETE', '/api/team/1'],
];

for (const [method, path, body] of genericWrites) {
  test(`${method} ${path} sin sesión responde 403`, async () => {
    const result = await call(method, path, { body });
    assert.equal(result.status, 403);
  });
  test(`${method} ${path} con sesión de usuario responde 403`, async () => {
    const result = await call(method, path, { body, cookie: userCookie });
    assert.equal(result.status, 403);
  });
}

// 2. Datos personales y de dinero: 401 sin sesión.
const ownerReads = [
  '/api/customer', '/api/customers', '/api/customer/1', '/api/me/customer',
  '/api/account', '/api/account/1',
  '/api/balance_movement', '/api/balance-movements', '/api/balance_movement/1',
  '/api/bet', '/api/bets', '/api/bet/1', '/api/bets/1',
  '/api/login_history', '/api/login-history',
  '/api/users/1/balance', '/api/auth/me',
];

for (const path of ownerReads) {
  test(`GET ${path} sin sesión responde 401 (o 404 si la ruta ya no existe)`, async () => {
    const result = await call('GET', path);
    assert.ok([401, 404].includes(result.status), `respondió ${result.status}`);
    assert.ok(!JSON.stringify(result.body).includes('document_number'));
  });
}

test('GET /api/customer/1 con sesión ya no existe (no se consulta a otros clientes por id)', async () => {
  const result = await call('GET', '/api/customer/1', { cookie: userCookie });
  assert.equal(result.status, 404);
});

test('GET /api/users (lista de usuarios) ya no existe', async () => {
  const result = await call('GET', '/api/users', { cookie: userCookie });
  assert.equal(result.status, 404);
});

test('una cookie con firma inválida responde 401', async () => {
  const result = await call('GET', '/api/account', { cookie: 'el_dorado_token=abc.def.ghi' });
  assert.equal(result.status, 401);
});

test('GET /api/users/:id/balance de otro usuario responde 403', async () => {
  const result = await call('GET', '/api/users/8/balance', { cookie: userCookie });
  // requireDb corre antes: con PostgreSQL caído puede responder 503; nunca 200.
  assert.ok([403, 503].includes(result.status), `respondió ${result.status}`);
});

// 3. Depósito y retiro directos deshabilitados.
test('POST /api/auth/balance/deposit sin sesión responde 401', async () => {
  const result = await call('POST', '/api/auth/balance/deposit', { body: { amount: 1000000 } });
  assert.equal(result.status, 401);
});

test('POST /api/auth/balance/deposit con sesión responde 403', async () => {
  const result = await call('POST', '/api/auth/balance/deposit', { body: { amount: 1000000 }, cookie: userCookie });
  assert.equal(result.status, 403);
  assert.match(result.body.error, /Wompi/);
});

test('POST /api/auth/balance/withdraw con sesión responde 403', async () => {
  const result = await call('POST', '/api/auth/balance/withdraw', { body: { amount: 1 }, cookie: userCookie });
  assert.equal(result.status, 403);
});

test('POST /api/bets sin sesión responde 401', async () => {
  const result = await call('POST', '/api/bets', { body: { stake: 1000 } });
  assert.equal(result.status, 401);
});

// 4. Base caída: 503 y no 500.
test('GET /api/account con sesión y PostgreSQL caído responde 503', async () => {
  const result = await call('GET', '/api/account', { cookie: userCookie });
  assert.equal(result.status, 503);
  assert.equal(result.body.database, 'postgres');
});

test('GET /api/match con MySQL caído responde 503', async () => {
  const result = await call('GET', '/api/match');
  assert.equal(result.status, 503);
  assert.equal(result.body.database, 'mysql');
});

test('GET /api/health responde 200 con el estado de los 4 motores', async () => {
  const result = await call('GET', '/api/health');
  assert.equal(result.status, 200);
  assert.equal(result.body.status, 'degraded');
  assert.deepEqual(Object.keys(result.body.databases).sort(), ['mongo', 'mysql', 'postgres', 'sqlserver']);
  for (const engine of Object.values(result.body.databases)) assert.equal(engine.status, 'down');
});
