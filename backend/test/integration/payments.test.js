// Recargas contra PostgreSQL real (fn_recargar) y SQL Server real (registro).
// Firestore se reemplaza por un mapa en memoria para no escribir en el proyecto de Firebase
// en cada prueba, y los secretos de Wompi son de prueba (formato Sandbox).
//   docker compose exec backend npm run test:integration
process.env.WOMPI_PUBLIC_KEY = 'pub_test_integracion';
process.env.WOMPI_PRIVATE_KEY = 'prv_test_integracion';
process.env.WOMPI_EVENTS_SECRET = 'test_events_integracion';
process.env.WOMPI_INTEGRITY_SECRET = 'test_integrity_integracion';
process.env.WOMPI_API_URL = 'https://sandbox.wompi.co/v1';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const request = require('supertest');
const app = require('../../server');
const paymentService = require('../../src/services/payment.service');
const wompiService = require('../../src/services/wompi.service');
const postgres = require('../../src/config/postgres');
const h = require('./helpers');

const payments = new Map();
paymentService.deps.store = {
  async createPayment(payment) {
    payments.set(payment.reference, {
      reference: payment.reference, username: payment.username, amount_cop: payment.amountCop,
      amount_in_cents: payment.amountInCents, currency: payment.currency, status: 'CREATED', transaction_id: null,
    });
  },
  async getPayment(reference) { return payments.has(reference) ? { ...payments.get(reference) } : null; },
  async updatePayment(reference, patch) {
    const current = payments.get(reference);
    if (current.status === 'CREDITED' && patch.status && patch.status !== 'CREDITED') return { ...current };
    payments.set(reference, { ...current, ...patch });
    return { ...payments.get(reference) };
  },
};

// Wompi falso: transacciones por id y búsqueda por referencia (los caminos a, b y c).
const wompiTransactions = new Map();
paymentService.deps.wompi = {
  ...wompiService,
  async getTransaction(config, id) { return wompiTransactions.get(id) ?? null; },
  async findTransactionByReference(config, reference) {
    return [...wompiTransactions.values()].find((transaction) => transaction.reference === reference) ?? null;
  },
};

function signedEvent(transaction) {
  const event = {
    event: 'transaction.updated', data: { transaction }, environment: 'test',
    signature: { properties: ['transaction.id', 'transaction.status', 'transaction.amount_in_cents'], checksum: '' },
    timestamp: Math.floor(Date.now() / 1000), sent_at: new Date().toISOString(),
  };
  event.signature.checksum = wompiService.eventChecksum(event, process.env.WOMPI_EVENTS_SECRET);
  return event;
}
const send = (event) => request(app).post('/api/payments/webhook').set('Content-Type', 'application/json').send(JSON.stringify(event));
const summary = (response) => `${response.status}${response.body?.code ? ` ${response.body.code}` : ''}`;

async function depositMovements(username) {
  const rows = await postgres.query(`
    SELECT count(*)::int AS total FROM balance_movement m
    JOIN account a ON a.id = m.account_id JOIN movement_type t ON t.id_movement = m.movement_type
    WHERE a.username = $1 AND t.code = 'DEPOSIT'
  `, [username]);
  return rows[0].total;
}

before(async () => { await h.cleanup(); });
after(async () => {
  h.writeReport(require('path').join(__dirname, 'report-payments.md'));
  await h.cleanup();
  await h.closeAll();
});

const amountCases = [
  ['recarga: monto 0', 0, '400 INVALID_AMOUNT'],
  ['recarga: monto negativo (-10.000)', -10000, '400 INVALID_AMOUNT'],
  ['recarga: monto texto ("50000")', '50000', '400 INVALID_AMOUNT'],
  ['recarga: monto con decimales (10.000,5)', 10000.5, '400 INVALID_AMOUNT'],
  ['recarga: menor al mínimo (9.999)', 9999, '400 AMOUNT_OUT_OF_RANGE'],
  ['recarga: mínimo exacto (10.000)', 10000, '201'],
  ['recarga: máximo exacto (3.000.000)', 3000000, '201'],
  ['recarga: mayor al máximo (3.000.001)', 3000001, '400 AMOUNT_OUT_OF_RANGE'],
];

for (const [caso, amountCop, esperado] of amountCases) {
  test(caso, async () => {
    const user = await h.createUser();
    const response = await request(app).post('/api/payments/prepare').set('Cookie', user.cookie).send({ amountCop });
    h.record(caso, esperado, summary(response));
    assert.equal(summary(response), esperado);
  });
}

test('firma de integridad de prepare', async () => {
  const user = await h.createUser();
  const response = await request(app).post('/api/payments/prepare').set('Cookie', user.cookie).send({ amountCop: 50000 });
  const { reference, amountInCents, signature } = response.body;
  const expected = crypto.createHash('sha256').update(`${reference}${amountInCents}COP${process.env.WOMPI_INTEGRITY_SECRET}`).digest('hex');
  h.record('firma de integridad = SHA256(reference + centavos + COP + secreto)', 'coincide', signature === expected ? 'coincide' : 'distinta');
  assert.equal(signature, expected);
});

test('webhook con checksum inválido: 401 y el saldo no cambia', async () => {
  const user = await h.createUser();
  const prepared = await request(app).post('/api/payments/prepare').set('Cookie', user.cookie).send({ amountCop: 50000 });
  const event = signedEvent({ id: 'it-1', reference: prepared.body.reference, amount_in_cents: 5000000, currency: 'COP', status: 'APPROVED' });
  event.signature.checksum = 'f'.repeat(64);
  const response = await send(event);
  const balance = await h.getBalance(user.username);
  h.record('webhook con checksum inválido', '401 INVALID_CHECKSUM saldo 0', `${summary(response)} saldo ${balance}`);
  assert.equal(response.status, 401);
  assert.equal(balance, 0);
});

test('evento APPROVED duplicado (4 veces, 2 a la vez): se acredita una sola vez en PostgreSQL', async () => {
  const user = await h.createUser();
  const prepared = await request(app).post('/api/payments/prepare').set('Cookie', user.cookie).send({ amountCop: 50000 });
  const event = signedEvent({ id: 'it-2', reference: prepared.body.reference, amount_in_cents: 5000000, currency: 'COP', status: 'APPROVED' });
  const statuses = [];
  for (const batch of [[send(event), send(event)], [send(event)], [send(event)]]) {
    statuses.push(...(await Promise.all(batch)).map((response) => response.status));
  }
  const balance = await h.getBalance(user.username);
  const deposits = await depositMovements(user.username);
  h.record('evento APPROVED duplicado 4 veces', '200,200,200,200 saldo 50000 1 recarga',
    `${statuses.join(',')} saldo ${balance} ${deposits} recarga`);
  assert.equal(balance, 50000);
  assert.equal(deposits, 1);
});

test('pago DECLINED: no acredita', async () => {
  const user = await h.createUser();
  const prepared = await request(app).post('/api/payments/prepare').set('Cookie', user.cookie).send({ amountCop: 50000 });
  const reference = prepared.body.reference;
  const response = await send(signedEvent({ id: 'it-3', reference, amount_in_cents: 5000000, currency: 'COP', status: 'DECLINED' }));
  const balance = await h.getBalance(user.username);
  h.record('pago DECLINED', '200 DECLINED saldo 0', `${response.status} ${payments.get(reference).status} saldo ${balance}`);
  assert.equal(balance, 0);
});

test('webhook con monto distinto al firmado: ERROR y no acredita', async () => {
  const user = await h.createUser();
  const prepared = await request(app).post('/api/payments/prepare').set('Cookie', user.cookie).send({ amountCop: 50000 });
  const reference = prepared.body.reference;
  await send(signedEvent({ id: 'it-4', reference, amount_in_cents: 300000000, currency: 'COP', status: 'APPROVED' }));
  const balance = await h.getBalance(user.username);
  h.record('webhook APPROVED con otro monto (3.000.000 vs 50.000 firmado)', 'ERROR saldo 0', `${payments.get(reference).status} saldo ${balance}`);
  assert.equal(balance, 0);
});

test('registro con contraseña débil: 400 WEAK_PASSWORD con las reglas incumplidas', async () => {
  const username = `zt_${crypto.randomBytes(4).toString('hex')}`;
  const response = await request(app).post('/api/auth/register').send({
    fullName: 'Prueba Débil', documentNumber: String(crypto.randomInt(1e9, 9.99e9)), birthDate: '1990-01-01',
    username, email: `${username}@pruebas.eldorado.local`, password: `${username}x1`,
  });
  const ids = (response.body.failed_rules || []).map((rule) => rule.id).join(',');
  h.record('registro con contraseña débil (contiene el usuario)', '400 WEAK_PASSWORD UPPERCASE,NO_USERNAME,NO_EMAIL',
    `${summary(response)} ${ids}`);
  assert.equal(`${summary(response)} ${ids}`, '400 WEAK_PASSWORD UPPERCASE,NO_USERNAME,NO_EMAIL');
});

// ---------- Caminos de verificación (bug "Procesando…") ----------
async function preparedFor(user, amountCop = 50000) {
  const response = await request(app).post('/api/payments/prepare').set('Cookie', user.cookie).send({ amountCop });
  return response.body.reference;
}

test('camino c: sin id, Wompi todavía sin transacción -> PENDING; luego APPROVED -> CREDITED', async () => {
  const user = await h.createUser();
  const reference = await preparedFor(user);
  const pending = await request(app).get(`/api/payments/${reference}`).set('Cookie', user.cookie);
  wompiTransactions.set('it-c1', { id: 'it-c1', reference, amount_in_cents: 5000000, currency: 'COP', status: 'APPROVED' });
  const approved = await request(app).get(`/api/payments/${reference}`).set('Cookie', user.cookie);
  const balance = await h.getBalance(user.username);
  h.record('camino c: consulta por referencia (sin id), primero sin transacción y luego APPROVED',
    '200 PENDING -> 200 CREDITED saldo 50000', `${pending.status} ${pending.body.status} -> ${approved.status} ${approved.body.status} saldo ${balance}`);
  assert.equal(approved.body.status, 'CREDITED');
  assert.equal(balance, 50000);
});

test('camino a: redirect-url ?id= -> GET /api/payments/transactions/:id acredita una vez', async () => {
  const user = await h.createUser();
  const reference = await preparedFor(user);
  wompiTransactions.set('it-a1', { id: 'it-a1', reference, amount_in_cents: 5000000, currency: 'COP', status: 'APPROVED' });
  const first = await request(app).get('/api/payments/transactions/it-a1').set('Cookie', user.cookie);
  const second = await request(app).get('/api/payments/transactions/it-a1').set('Cookie', user.cookie);
  const balance = await h.getBalance(user.username);
  const deposits = await depositMovements(user.username);
  h.record('camino a: volver con ?id= (2 veces)', '200 CREDITED, 200 CREDITED saldo 50000 1 recarga',
    `${first.status} ${first.body.status}, ${second.status} ${second.body.status} saldo ${balance} ${deposits} recarga`);
  assert.equal(balance, 50000);
  assert.equal(deposits, 1);
});

test('camino a: el ?id= de una recarga de otro usuario responde 403 y no acredita', async () => {
  const owner = await h.createUser();
  const intruder = await h.createUser();
  const reference = await preparedFor(owner);
  wompiTransactions.set('it-a2', { id: 'it-a2', reference, amount_in_cents: 5000000, currency: 'COP', status: 'APPROVED' });
  const response = await request(app).get('/api/payments/transactions/it-a2').set('Cookie', intruder.cookie);
  const balances = [await h.getBalance(owner.username), await h.getBalance(intruder.username)];
  h.record('camino a: ?id= de la recarga de otro usuario', '403 saldos 0 0', `${response.status} saldos ${balances.join(' ')}`);
  assert.equal(response.status, 403);
});

test('caminos a + b + c + webhook a la vez: una sola recarga en PostgreSQL', async () => {
  const user = await h.createUser();
  const reference = await preparedFor(user);
  const transaction = { id: 'it-all', reference, amount_in_cents: 5000000, currency: 'COP', status: 'APPROVED' };
  wompiTransactions.set('it-all', transaction);
  const responses = await Promise.all([
    request(app).get('/api/payments/transactions/it-all').set('Cookie', user.cookie),
    request(app).get(`/api/payments/${reference}?transaction_id=it-all`).set('Cookie', user.cookie),
    request(app).get(`/api/payments/${reference}`).set('Cookie', user.cookie),
    send(signedEvent(transaction)),
  ]);
  const balance = await h.getBalance(user.username);
  const deposits = await depositMovements(user.username);
  h.record('redirect + callback + referencia + webhook a la vez', '200,200,200,200 saldo 50000 1 recarga',
    `${responses.map((response) => response.status).join(',')} saldo ${balance} ${deposits} recarga`);
  assert.equal(balance, 50000);
  assert.equal(deposits, 1);
});
