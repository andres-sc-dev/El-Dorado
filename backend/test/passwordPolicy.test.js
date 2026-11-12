// Política de contraseñas: reglas, registro del backend y paridad con la copia del frontend.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

process.env.JWT_SECRET = 'test-secret-solo-para-pruebas-automatizadas';
process.env.SQLSERVER_HOST = '127.0.0.1';
process.env.SQLSERVER_PORT = '1';
process.env.POSTGRES_HOST = '127.0.0.1';
process.env.POSTGRES_PORT = '1';

const { evaluatePassword } = require('../src/utils/passwordPolicy');
const authService = require('../src/services/authService');

const context = { username: 'andres', email: 'andres.perez@correo.com' };
const failedIds = (password, ctx = context) => evaluatePassword(password, ctx).failed.map((rule) => rule.id);

const cases = [
  ['vacía', '', ['MIN_LENGTH', 'UPPERCASE', 'LOWERCASE', 'NUMBER', 'SYMBOL', 'NO_SPACES', 'NO_USERNAME', 'NO_EMAIL']],
  ['corta (9 caracteres)', 'Ab1!Ab1!A', ['MIN_LENGTH']],
  ['sin mayúscula', 'dorado-2026x', ['UPPERCASE']],
  ['sin minúscula', 'DORADO-2026X', ['LOWERCASE']],
  ['sin número', 'Dorado-Futbol', ['NUMBER']],
  ['sin símbolo', 'Dorado2026Fut', ['SYMBOL']],
  ['con espacio', 'Dorado 2026-x', ['NO_SPACES']],
  ['contiene el usuario (sin importar mayúsculas)', 'XAndres-2026!', ['NO_USERNAME']],
  ['contiene la parte local del correo', 'Andres.Perez-1', ['NO_USERNAME', 'NO_EMAIL']],
  ['cumple todo', 'Dorado-2026!x', []],
];

for (const [name, password, expected] of cases) {
  test(`política: ${name}`, () => {
    assert.deepEqual(failedIds(password), expected);
  });
}

test('política: niveles 0 a 4 para la barra', () => {
  assert.equal(evaluatePassword('', context).level, 0);
  assert.equal(evaluatePassword('andres', context).level, 1);
  assert.equal(evaluatePassword('dorado', context).level, 2);
  assert.equal(evaluatePassword('Dorado2026Fut', context).level, 3);
  assert.equal(evaluatePassword('Dorado-2026!x', context).level, 4);
});

test('registro: una contraseña débil responde 400 WEAK_PASSWORD con la lista de reglas', async () => {
  await assert.rejects(authService.register({
    fullName: 'Prueba', documentNumber: '1234567890', birthDate: '1990-01-01',
    username: 'andres', email: 'andres.perez@correo.com', password: 'andres123',
  }), (error) => {
    assert.equal(error.statusCode, 400);
    assert.equal(error.errorCode, 'WEAK_PASSWORD');
    const ids = error.details.failed_rules.map((rule) => rule.id);
    assert.deepEqual(ids, ['MIN_LENGTH', 'UPPERCASE', 'SYMBOL', 'NO_USERNAME']);
    return true;
  });
});

// La copia del navegador debe dar exactamente el mismo resultado.
const frontendPolicy = path.join(__dirname, '..', '..', 'frontend', 'src', 'utils', 'passwordPolicy.js');
test('la copia del frontend da el mismo resultado que el backend', { skip: !fs.existsSync(frontendPolicy) && 'el frontend no está montado aquí' }, async () => {
  const frontend = await import(pathToFileURL(frontendPolicy).href);
  for (const [, password] of cases) {
    assert.deepEqual(frontend.evaluatePassword(password, context), evaluatePassword(password, context));
  }
});
