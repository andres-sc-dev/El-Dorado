// Recargas con Wompi, sin bases ni red: Firestore, Wompi y PostgreSQL se reemplazan por
// versiones en memoria. fn_recargar falso imita la idempotencia por referencia (la real se
// prueba en test/integration/payments.test.js).
const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

process.env.JWT_SECRET = 'test-secret-solo-para-pruebas-automatizadas';
process.env.WOMPI_PUBLIC_KEY = 'pub_test_llavepublicadeprueba';
process.env.WOMPI_PRIVATE_KEY = 'prv_test_llaveprivadadeprueba';
process.env.WOMPI_EVENTS_SECRET = 'test_events_secretodeprueba';
process.env.WOMPI_INTEGRITY_SECRET = 'test_integrity_secretodeprueba';
process.env.WOMPI_API_URL = 'https://sandbox.wompi.co/v1';
process.env.WOMPI_MIN_COP = '10000';
process.env.WOMPI_MAX_COP = '3000000';
process.env.MONGO_URI = 'mongodb://127.0.0.1:1/?serverSelectionTimeoutMS=200';

const request = require('supertest');
const app = require('../server');
const paymentService = require('../src/services/payment.service');
const wompiService = require('../src/services/wompi.service');
const wompiConfig = require('../src/config/wompi');
const { normalizePrivateKey } = require('../src/config/firebase');
const { createToken } = require('../src/utils/token');

const cookie = (username, role = 'USR') => `el_dorado_token=${createToken({ userId: 1, username, role })}`;
const userCookie = cookie('cliente');

// ---------- Dobles en memoria ----------
let payments;
let balances;
let movements;
let wompiTransactions;

beforeEach(() => {
  payments = new Map();
  balances = new Map([['cliente', 0], ['otro', 0]]);
  movements = new Map();
  wompiTransactions = new Map();
  paymentService.deps.store = {
    async createPayment(payment) {
      if (payments.has(payment.reference)) throw new Error('ALREADY_EXISTS');
      payments.set(payment.reference, {
        reference: payment.reference, username: payment.username, amount_cop: payment.amountCop,
        amount_in_cents: payment.amountInCents, currency: payment.currency, status: 'CREATED', transaction_id: null,
      });
    },
    async getPayment(reference) { return payments.has(reference) ? { ...payments.get(reference) } : null; },
    async updatePayment(reference, patch) {
      const current = payments.get(reference);
      if (!current) return null;
      if (current.status === 'CREDITED' && patch.status && patch.status !== 'CREDITED') return { ...current };
      payments.set(reference, { ...current, ...patch });
      return { ...payments.get(reference) };
    },
  };
  paymentService.deps.accounts = {
    // Igual que fn_recargar: la misma referencia se acredita una sola vez.
    async deposit(username, amount, reference) {
      if (movements.has(reference)) return { credited: false, balance: balances.get(username) };
      movements.set(reference, amount);
      balances.set(username, balances.get(username) + amount);
      return { credited: true, balance: balances.get(username) };
    },
  };
  paymentService.deps.wompi = {
    ...wompiService,
    async getTransaction(config, id) { return wompiTransactions.get(id) ?? null; },
    async findTransactionByReference() { return null; },
  };
  paymentService.deps.audit = { log: async () => true };
});

async function prepare(amountCop, who = userCookie) {
  return request(app).post('/api/payments/prepare').set('Cookie', who).send({ amountCop });
}

function signedEvent(transaction, { environment = 'test', secret = process.env.WOMPI_EVENTS_SECRET } = {}) {
  const event = {
    event: 'transaction.updated',
    data: { transaction },
    environment,
    signature: { properties: ['transaction.id', 'transaction.status', 'transaction.amount_in_cents'], checksum: '' },
    timestamp: 1730000000,
    sent_at: new Date().toISOString(),
  };
  event.signature.checksum = wompiService.eventChecksum(event, secret).toUpperCase();
  return event;
}

const sendEvent = (event) => request(app).post('/api/payments/webhook')
  .set('Content-Type', 'application/json').send(JSON.stringify(event));

// ---------- Monto ----------
const invalidAmounts = [
  ['monto 0', 0],
  ['monto negativo', -50000],
  ['monto como texto', '50000'],
  ['monto con decimales', 50000.5],
  ['monto menor al mínimo (9.999)', 9999],
  ['monto mayor al máximo (3.000.001)', 3000001],
  ['monto ausente', undefined],
];
for (const [name, amount] of invalidAmounts) {
  test(`prepare: ${name} responde 400 con el rango en el mensaje`, async () => {
    const response = await prepare(amount);
    assert.equal(response.status, 400);
    assert.match(response.body.error, /Mínimo \$10\.000 · Máximo \$3\.000\.000/);
    assert.equal(payments.size, 0);
  });
}

test('prepare: mínimo (10.000) y máximo (3.000.000) exactos se aceptan', async () => {
  assert.equal((await prepare(10000)).status, 201);
  assert.equal((await prepare(3000000)).status, 201);
});

test('prepare: sin sesión responde 401 y un ADM responde 403', async () => {
  assert.equal((await request(app).post('/api/payments/prepare').send({ amountCop: 10000 })).status, 401);
  assert.equal((await prepare(10000, cookie('jefe', 'ADM'))).status, 403);
});

// ---------- Firma de integridad ----------
test('firma de integridad: coincide con el ejemplo oficial de docs.wompi.co', () => {
  // Cadena de ejemplo de la doc: "sk8-438k4-xmxm392-sn2m2490000COPprod_integrity_Z5mM..." =
  // referencia "sk8-438k4-xmxm392-sn2m" + monto 2490000 + "COP" + secreto.
  const docExample = 'sk8-438k4-xmxm392-sn2m2490000COPprod_integrity_Z5mMke9x0k8gpErbDqwrJXMqsI6SFli6';
  const signature = wompiService.integritySignature(
    'sk8-438k4-xmxm392-sn2m', 2490000, 'COP', 'prod_integrity_Z5mMke9x0k8gpErbDqwrJXMqsI6SFli6',
  );
  assert.equal(signature, wompiService.sha256(docExample));
  assert.equal(signature, '37c8407747e595535433ef8f6a811d853cd943046624a0ec04662b17bbf33bf5');
});

test('prepare: firma = SHA256(reference + centavos + COP + secreto) y no devuelve secretos', async () => {
  const response = await prepare(50000);
  const { reference, amountInCents, currency, signature, publicKey } = response.body;
  assert.match(reference, /^ELD-[0-9a-f-]{36}$/);
  assert.equal(amountInCents, 5000000);
  assert.equal(currency, 'COP');
  assert.equal(signature, wompiService.sha256(`${reference}5000000COP${process.env.WOMPI_INTEGRITY_SECRET}`));
  assert.equal(publicKey, process.env.WOMPI_PUBLIC_KEY);
  const text = JSON.stringify(response.body);
  for (const secret of ['WOMPI_PRIVATE_KEY', 'WOMPI_EVENTS_SECRET', 'WOMPI_INTEGRITY_SECRET']) {
    assert.ok(!text.includes(process.env[secret]), `la respuesta incluye ${secret}`);
  }
  assert.equal(payments.get(reference).status, 'CREATED');
  assert.equal(payments.get(reference).username, 'cliente');
});

test('GET /api/payments/config devuelve los límites', async () => {
  const response = await request(app).get('/api/payments/config').set('Cookie', userCookie);
  assert.equal(response.status, 200);
  assert.equal(response.body.min_cop, 10000);
  assert.equal(response.body.max_cop, 3000000);
  assert.equal(response.body.currency, 'COP');
});

// ---------- Checksum de eventos ----------
test('checksum: sigue la fórmula de docs.wompi.co (propiedades + timestamp + secreto)', () => {
  const event = {
    data: { transaction: { id: '1234-1610641025-49201', status: 'APPROVED', amount_in_cents: 4490000 } },
    signature: { properties: ['transaction.id', 'transaction.status', 'transaction.amount_in_cents'] },
    timestamp: 1530291411,
  };
  const expected = wompiService.sha256('1234-1610641025-49201APPROVED44900001530291411prod_events_OcHnIzeBl5socpwByQ4hA52Em3USQ93Z');
  assert.equal(wompiService.eventChecksum(event, 'prod_events_OcHnIzeBl5socpwByQ4hA52Em3USQ93Z'), expected);
});

// ---------- Webhook ----------
async function createdPayment(amountCop = 50000) {
  const response = await prepare(amountCop);
  return response.body.reference;
}

test('webhook: checksum inválido responde 401 y no toca nada', async () => {
  const reference = await createdPayment();
  const event = signedEvent({ id: 'tx-1', reference, amount_in_cents: 5000000, currency: 'COP', status: 'APPROVED' },
    { secret: 'test_events_secreto_equivocado' });
  const response = await sendEvent(event);
  assert.equal(response.status, 401);
  assert.equal(payments.get(reference).status, 'CREATED');
  assert.equal(balances.get('cliente'), 0);
});

test('webhook: un dato alterado después de firmar (monto) responde 401', async () => {
  const reference = await createdPayment();
  const event = signedEvent({ id: 'tx-2', reference, amount_in_cents: 5000000, currency: 'COP', status: 'APPROVED' });
  event.data.transaction.amount_in_cents = 500000000;
  assert.equal((await sendEvent(event)).status, 401);
});

test('webhook: cuerpo que no es JSON responde 401', async () => {
  const response = await request(app).post('/api/payments/webhook').set('Content-Type', 'application/json').send('{no es json');
  assert.equal(response.status, 401);
});

test('webhook: APPROVED acredita y marca CREDITED', async () => {
  const reference = await createdPayment(50000);
  const response = await sendEvent(signedEvent({ id: 'tx-3', reference, amount_in_cents: 5000000, currency: 'COP', status: 'APPROVED' }));
  assert.equal(response.status, 200);
  assert.equal(response.body.status, 'CREDITED');
  assert.equal(payments.get(reference).status, 'CREDITED');
  assert.equal(balances.get('cliente'), 50000);
});

test('webhook: el mismo evento tres veces se acredita una sola vez', async () => {
  const reference = await createdPayment(50000);
  const event = signedEvent({ id: 'tx-4', reference, amount_in_cents: 5000000, currency: 'COP', status: 'APPROVED' });
  const responses = await Promise.all([sendEvent(event), sendEvent(event), sendEvent(event)]);
  assert.deepEqual(responses.map((response) => response.status), [200, 200, 200]);
  assert.equal(balances.get('cliente'), 50000);
  assert.equal(movements.size, 1);
});

test('webhook: DECLINED no acredita y un APPROVED posterior tampoco', async () => {
  const reference = await createdPayment(50000);
  await sendEvent(signedEvent({ id: 'tx-5', reference, amount_in_cents: 5000000, currency: 'COP', status: 'DECLINED' }));
  assert.equal(payments.get(reference).status, 'DECLINED');
  await sendEvent(signedEvent({ id: 'tx-5', reference, amount_in_cents: 5000000, currency: 'COP', status: 'APPROVED' }));
  assert.equal(balances.get('cliente'), 0);
});

test('webhook: monto distinto al firmado marca ERROR y no acredita', async () => {
  const reference = await createdPayment(50000);
  await sendEvent(signedEvent({ id: 'tx-6', reference, amount_in_cents: 9900000, currency: 'COP', status: 'APPROVED' }));
  assert.equal(payments.get(reference).status, 'ERROR');
  assert.equal(balances.get('cliente'), 0);
});

test('webhook: un evento de producción se ignora (200) sin acreditar', async () => {
  const reference = await createdPayment(50000);
  const response = await sendEvent(signedEvent({ id: 'tx-7', reference, amount_in_cents: 5000000, currency: 'COP', status: 'APPROVED' }, { environment: 'prod' }));
  assert.equal(response.status, 200);
  assert.equal(response.body.ignored, 'NOT_SANDBOX');
  assert.equal(balances.get('cliente'), 0);
});

// ---------- Consulta directa (sin URL pública) ----------
test('consulta: APPROVED en Wompi acredita una vez aunque se consulte varias veces', async () => {
  const reference = await createdPayment(20000);
  wompiTransactions.set('tx-8', { id: 'tx-8', reference, amount_in_cents: 2000000, currency: 'COP', status: 'APPROVED' });
  const user = { username: 'cliente', role: 'USR' };
  const first = await paymentService.getStatus(user, reference, 'tx-8');
  const second = await paymentService.getStatus(user, reference, 'tx-8');
  assert.equal(first.status, 'CREDITED');
  assert.equal(second.status, 'CREDITED');
  assert.equal(balances.get('cliente'), 20000);
});

test('consulta: PENDING deja la recarga en CREATED', async () => {
  const reference = await createdPayment(20000);
  wompiTransactions.set('tx-9', { id: 'tx-9', reference, amount_in_cents: 2000000, currency: 'COP', status: 'PENDING' });
  const result = await paymentService.getStatus({ username: 'cliente', role: 'USR' }, reference, 'tx-9');
  assert.equal(result.status, 'CREATED');
  assert.equal(payments.get(reference).transaction_id, 'tx-9');
});

test('consulta: otro usuario recibe 403 y un ADM puede verla', async () => {
  const reference = await createdPayment(20000);
  await assert.rejects(paymentService.getStatus({ username: 'otro', role: 'USR' }, reference), { statusCode: 403 });
  wompiTransactions.set('tx-10', { id: 'tx-10', reference, amount_in_cents: 2000000, currency: 'COP', status: 'DECLINED' });
  const result = await paymentService.getStatus({ username: 'jefe', role: 'ADM' }, reference, 'tx-10');
  assert.equal(result.status, 'DECLINED');
});

test('consulta: referencia con formato inválido responde 404', async () => {
  await assert.rejects(paymentService.getStatus({ username: 'cliente', role: 'USR' }, "ELD-1' OR '1'='1"), { statusCode: 404 });
});

// ---------- Configuración ----------
test('llaves de producción: los pagos se bloquean (503 PAYMENTS_NOT_CONFIGURED)', async () => {
  const previous = process.env.WOMPI_INTEGRITY_SECRET;
  process.env.WOMPI_INTEGRITY_SECRET = 'prod_integrity_abc';
  try {
    const response = await prepare(10000);
    assert.equal(response.status, 503);
    assert.equal(response.body.code, 'PAYMENTS_NOT_CONFIGURED');
    assert.ok(!JSON.stringify(response.body).includes('prod_integrity_abc'));
  } finally {
    process.env.WOMPI_INTEGRITY_SECRET = previous;
  }
});

test('sandboxProblems detecta llaves de producción y URL de producción', () => {
  const problems = wompiConfig.sandboxProblems({
    publicKey: 'pub_prod_x', privateKey: 'prv_test_x', eventsSecret: 'test_events_x', integritySecret: 'test_integrity_x',
    apiUrl: 'https://production.wompi.co/v1',
  });
  assert.deepEqual(problems, ['publicKey no es de Sandbox', 'WOMPI_API_URL no es la de Sandbox']);
});

test('FIREBASE_PRIVATE_KEY acepta \\n escritos y saltos de línea reales', () => {
  const real = '-----BEGIN PRIVATE KEY-----\nABC\n-----END PRIVATE KEY-----\n';
  assert.equal(normalizePrivateKey('"-----BEGIN PRIVATE KEY-----\\nABC\\n-----END PRIVATE KEY-----\\n"'), real);
  assert.equal(normalizePrivateKey(real), real);
});

test('el depósito directo ya no existe (no suma saldo sin pago)', async () => {
  const response = await request(app).post('/api/auth/balance/deposit').set('Cookie', userCookie).send({ amount: 1000000 });
  assert.ok([403, 404].includes(response.status), `respondió ${response.status}`);
});
