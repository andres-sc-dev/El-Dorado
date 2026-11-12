// Registro e inicio de sesión con Google contra SQL Server y PostgreSQL reales.
// verifyIdToken se reemplaza por uno falso: no se llama a Firebase ni se crean usuarios allí.
//   docker compose exec backend npm run test:integration
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const path = require('path');
const request = require('supertest');
const app = require('../../server');
const googleAuthService = require('../../src/services/googleAuthService');
const sqlserver = require('../../src/config/sqlserver');
const h = require('./helpers');

// Tokens falsos: el texto del token decide qué "devuelve" Firebase.
const tokens = new Map();
function googleToken({ uid = `uid-${crypto.randomBytes(6).toString('hex')}`, email, name = 'Persona de Prueba', verified = true, provider = 'google.com' }) {
  const token = `fake-google-id-token-${crypto.randomBytes(12).toString('hex')}`;
  tokens.set(token, { uid, email, name, email_verified: verified, firebase: { sign_in_provider: provider } });
  return token;
}
googleAuthService.deps.verifyIdToken = async (idToken) => {
  if (idToken === 'token-vencido-de-prueba-0000000000') throw Object.assign(new Error('expired'), { code: 'auth/id-token-expired' });
  const decoded = tokens.get(idToken);
  if (!decoded) throw Object.assign(new Error('invalid'), { code: 'auth/argument-error' });
  return decoded;
};

const newEmail = () => `zt_${crypto.randomBytes(4).toString('hex')}@pruebas.eldorado.local`;
const newCedula = () => String(crypto.randomInt(1e9, 9.99e9));
const summary = (response) => `${response.status}${response.body?.code ? ` ${response.body.code}` : ''}`;
const sessionCookie = (response) => (response.headers['set-cookie'] || []).find((cookie) => cookie.startsWith('el_dorado_token='));

function completeBody(idToken, overrides = {}) {
  return {
    idToken, document_type: 'CC', document_number: newCedula(), birth_date: '1995-03-10', accepted_terms: true, ...overrides,
  };
}

async function providerOf(username) {
  return sqlserver.withPool(async (pool) => {
    const result = await pool.request().input('u', sqlserver.sql.NVarChar(50), username).query(`
      SELECT p.code, CASE WHEN u.password_hash IS NULL THEN 0 ELSE 1 END AS has_password, u.google_uid
      FROM dbo.users u JOIN dbo.auth_provider p ON p.id_auth_provider = u.auth_provider_id WHERE u.username = @u`);
    return result.recordset[0] || null;
  });
}

before(async () => { await h.cleanup(); });
after(async () => {
  h.writeReport(path.join(__dirname, 'report-google.md'));
  await h.cleanup();
  await h.closeAll();
});

test('token inválido: 401', async () => {
  const response = await request(app).post('/api/auth/google').send({ idToken: 'esto-no-es-un-token-de-google' });
  h.record('Google: idToken inválido', '401 GOOGLE_TOKEN_INVALID', summary(response));
  assert.equal(response.status, 401);
});

test('token vencido: 401', async () => {
  const response = await request(app).post('/api/auth/google').send({ idToken: 'token-vencido-de-prueba-0000000000' });
  h.record('Google: idToken vencido', '401 GOOGLE_TOKEN_EXPIRED', summary(response));
  assert.equal(response.status, 401);
});

test('token ausente: 401', async () => {
  const response = await request(app).post('/api/auth/google').send({});
  h.record('Google: sin idToken', '401 GOOGLE_TOKEN_INVALID', summary(response));
  assert.equal(response.status, 401);
});

test('correo de Google no verificado: 401', async () => {
  const response = await request(app).post('/api/auth/google').send({ idToken: googleToken({ email: newEmail(), verified: false }) });
  h.record('Google: email_verified false', '401 GOOGLE_EMAIL_NOT_VERIFIED', summary(response));
  assert.equal(response.status, 401);
});

test('token de otro proveedor (no google.com): 401', async () => {
  const response = await request(app).post('/api/auth/google').send({ idToken: googleToken({ email: newEmail(), provider: 'password' }) });
  h.record('Google: token de otro proveedor (password)', '401 GOOGLE_TOKEN_INVALID', summary(response));
  assert.equal(response.status, 401);
});

test('usuario nuevo: 202 PROFILE_INCOMPLETE y no se crea nada', async () => {
  const email = newEmail();
  const response = await request(app).post('/api/auth/google').send({ idToken: googleToken({ email, name: 'Ana Nueva' }) });
  const created = await providerOf(email.split('@')[0]);
  h.record('Google: usuario nuevo', '202 PROFILE_INCOMPLETE sin cookie sin usuario',
    `${response.status} ${response.body.status} ${sessionCookie(response) ? 'con' : 'sin'} cookie ${created ? 'con' : 'sin'} usuario`);
  assert.equal(response.status, 202);
  assert.equal(response.body.email, email);
  assert.equal(response.body.name, 'Ana Nueva');
});

test('completar perfil: crea USR GOOGLE sin contraseña, saldo 0 y deja la sesión iniciada', async () => {
  const email = newEmail();
  const idToken = googleToken({ email, name: 'María Gómez' });
  const response = await request(app).post('/api/auth/google/complete').send(completeBody(idToken));
  const db = await providerOf(response.body.user?.username);
  const balance = await h.getBalance(response.body.user?.username);
  const me = await request(app).get('/api/auth/me').set('Cookie', sessionCookie(response).split(';')[0]);
  h.record('Google: completar perfil válido', '201 USR GOOGLE sin contraseña saldo 0 sesión iniciada',
    `${response.status} ${response.body.user?.role} ${db?.code} ${db?.has_password ? 'con' : 'sin'} contraseña saldo ${balance} ${me.status === 200 ? 'sesión iniciada' : 'sin sesión'}`);
  assert.equal(response.status, 201);
  assert.equal(response.body.user.username, email.split('@')[0]);
  assert.equal(db.code, 'GOOGLE');
  assert.equal(balance, 0);
  assert.equal(me.body.user.role, 'USR');
});

test('usuario existente (por google_uid): inicia sesión con cookie HttpOnly', async () => {
  const email = newEmail();
  const uid = `uid-${crypto.randomBytes(6).toString('hex')}`;
  await request(app).post('/api/auth/google/complete').send(completeBody(googleToken({ uid, email })));
  const response = await request(app).post('/api/auth/google').send({ idToken: googleToken({ uid, email }) });
  const cookie = sessionCookie(response) || '';
  h.record('Google: usuario existente inicia sesión', '200 LOGGED_IN HttpOnly', `${response.status} ${response.body.status} ${/HttpOnly/i.test(cookie) ? 'HttpOnly' : 'sin HttpOnly'}`);
  assert.equal(response.status, 200);
  assert.match(cookie, /HttpOnly/i);
});

test('usuario existente por correo de una cuenta GOOGLE (otro uid): inicia sesión', async () => {
  const email = newEmail();
  await request(app).post('/api/auth/google/complete').send(completeBody(googleToken({ email })));
  const response = await request(app).post('/api/auth/google').send({ idToken: googleToken({ email }) });
  h.record('Google: mismo correo de cuenta GOOGLE con otro uid', '200 LOGGED_IN', `${response.status} ${response.body.status}`);
  assert.equal(response.status, 200);
});

test('completar siendo menor de edad: 400 con la lista de campos', async () => {
  const today = new Date();
  const minor = `${today.getUTCFullYear() - 17}-01-01`;
  const response = await request(app).post('/api/auth/google/complete')
    .send(completeBody(googleToken({ email: newEmail() }), { birth_date: minor }));
  const fields = (response.body.fields || []).map((item) => item.field).join(',');
  h.record('Google: completar con 17 años', '400 VALIDATION_ERROR birth_date', `${summary(response)} ${fields}`);
  assert.equal(`${summary(response)} ${fields}`, '400 VALIDATION_ERROR birth_date');
});

test('completar con varios campos inválidos: 400 los lista todos', async () => {
  const response = await request(app).post('/api/auth/google/complete').send({
    idToken: googleToken({ email: newEmail() }), document_type: 'XX', document_number: '12', birth_date: '10/03/1995', accepted_terms: false,
  });
  const fields = (response.body.fields || []).map((item) => item.field).join(',');
  h.record('Google: tipo de documento, fecha y términos inválidos', '400 VALIDATION_ERROR document_type,birth_date,accepted_terms', `${summary(response)} ${fields}`);
  assert.equal(fields, 'document_type,birth_date,accepted_terms');
});

test('cédula con formato inválido: 400 document_number', async () => {
  const response = await request(app).post('/api/auth/google/complete')
    .send(completeBody(googleToken({ email: newEmail() }), { document_number: '12A45' }));
  const fields = (response.body.fields || []).map((item) => item.field).join(',');
  h.record('Google: cédula con letras', '400 VALIDATION_ERROR document_number', `${summary(response)} ${fields}`);
  assert.equal(fields, 'document_number');
});

test('documento duplicado: 409 y no se crea el usuario', async () => {
  const cedula = newCedula();
  await request(app).post('/api/auth/google/complete').send(completeBody(googleToken({ email: newEmail() }), { document_number: cedula }));
  const email = newEmail();
  const response = await request(app).post('/api/auth/google/complete')
    .send(completeBody(googleToken({ email }), { document_number: cedula.replace(/\B(?=(\d{3})+(?!\d))/g, '.') }));
  const created = await providerOf(email.split('@')[0]);
  h.record('Google: documento ya registrado (enviado con puntos)', '409 DOCUMENT_TAKEN sin usuario', `${summary(response)} ${created ? 'con' : 'sin'} usuario`);
  assert.equal(response.status, 409);
  assert.equal(created, null);
});

test('cuenta LOCAL con el mismo correo: 409 en login y en completar, sin enlazar', async () => {
  const local = await h.createUser();
  const email = `${local.username}@pruebas.eldorado.local`;
  const login = await request(app).post('/api/auth/google').send({ idToken: googleToken({ email }) });
  const complete = await request(app).post('/api/auth/google/complete').send(completeBody(googleToken({ email })));
  const db = await providerOf(local.username);
  h.record('Google: correo de una cuenta LOCAL', '409 LOCAL_ACCOUNT_EXISTS / 409 LOCAL_ACCOUNT_EXISTS / sigue LOCAL',
    `${summary(login)} / ${summary(complete)} / sigue ${db.code}`);
  assert.equal(login.status, 409);
  assert.match(login.body.error, /entra con tu contraseña/);
  assert.equal(complete.status, 409);
  assert.equal(db.code, 'LOCAL');
});

test('completar dos veces la misma cuenta de Google: 409', async () => {
  const email = newEmail();
  const uid = `uid-${crypto.randomBytes(6).toString('hex')}`;
  await request(app).post('/api/auth/google/complete').send(completeBody(googleToken({ uid, email })));
  const response = await request(app).post('/api/auth/google/complete').send(completeBody(googleToken({ uid, email })));
  h.record('Google: completar dos veces', '409 GOOGLE_ACCOUNT_EXISTS', summary(response));
  assert.equal(summary(response), '409 GOOGLE_ACCOUNT_EXISTS');
});

test('usuario GOOGLE intentando entrar con contraseña: rechazado con mensaje claro', async () => {
  const email = newEmail();
  const created = await request(app).post('/api/auth/google/complete').send(completeBody(googleToken({ email })));
  const byUsername = await request(app).post('/api/auth/login').send({ username: created.body.user.username, password: 'Cualquier-Clave-2026!' });
  const byEmail = await request(app).post('/api/auth/login').send({ username: email, password: '' + 'x' });
  h.record('Google: login con contraseña (por usuario y por correo)', '401 GOOGLE_ACCOUNT / 401 GOOGLE_ACCOUNT', `${summary(byUsername)} / ${summary(byEmail)}`);
  assert.equal(byUsername.status, 401);
  assert.match(byUsername.body.error, /Continuar con Google/);
  assert.equal(byEmail.body.code, 'GOOGLE_ACCOUNT');
});

test('usuario de correo corto o ya usado: se genera un username único', async () => {
  const first = `zt_${crypto.randomBytes(3).toString('hex')}`;
  const a = await request(app).post('/api/auth/google/complete').send(completeBody(googleToken({ email: `${first}@a.local` })));
  const b = await request(app).post('/api/auth/google/complete').send(completeBody(googleToken({ email: `${first}@b.local` })));
  h.record('Google: dos correos con la misma parte local', 'usernames distintos', a.body.user.username !== b.body.user.username ? 'usernames distintos' : 'iguales');
  assert.equal(a.body.user.username, first);
  assert.match(b.body.user.username, new RegExp(`^${first}\\d{4}$`));
});

test('PostgreSQL falla al crear la cuenta: 503 y se borra el usuario de SQL Server', async () => {
  const email = newEmail();
  const original = googleAuthService.deps.accounts;
  googleAuthService.deps.accounts = { ...original, ensureAccount: async () => { throw Object.assign(new Error('conexión'), { code: 'ECONNREFUSED', engine: 'postgres' }); } };
  try {
    const response = await request(app).post('/api/auth/google/complete').send(completeBody(googleToken({ email })));
    const created = await providerOf(email.split('@')[0]);
    h.record('Google: PostgreSQL falla al crear la cuenta', '503 sin usuario (compensado)', `${response.status} ${created ? 'con' : 'sin'} usuario`);
    assert.equal(response.status, 503);
    assert.equal(created, null);
  } finally {
    googleAuthService.deps.accounts = original;
  }
});

test('el login y el registro locales siguen funcionando', async () => {
  const username = `zt_${crypto.randomBytes(4).toString('hex')}`;
  const register = await request(app).post('/api/auth/register').send({
    fullName: 'Local de Prueba', documentNumber: newCedula(), birthDate: '1990-01-01',
    username, email: `${username}@pruebas.eldorado.local`, password: h.TEST_PASSWORD,
  });
  const login = await request(app).post('/api/auth/login').send({ username, password: h.TEST_PASSWORD });
  const db = await providerOf(username);
  h.record('Registro y login locales', '201 200 LOCAL', `${register.status} ${login.status} ${db?.code}`);
  assert.equal(register.status, 201);
  assert.equal(login.status, 200);
  assert.equal(db.code, 'LOCAL');
});
