// Valores de apuesta: la API rechaza con 400 todo monto fuera de las reglas, antes de tocar PostgreSQL.
// (fn_crear_apuesta y el CHECK ck_bet_stake_limits lo vuelven a exigir dentro de la base;
// eso lo cubren las pruebas de integración.)
//   npm test
process.env.BET_MIN_COP = '1000';
process.env.BET_MAX_COP = '500000';
const test = require('node:test');
const assert = require('node:assert');
const { parseStake } = require('../src/services/bet.service');

const rejected = [
  ['texto', '10000', 'INVALID_STAKE'],
  ['null', null, 'INVALID_STAKE'],
  ['NaN', Number.NaN, 'INVALID_STAKE'],
  ['infinito', Number.POSITIVE_INFINITY, 'INVALID_STAKE'],
  ['cero', 0, 'INVALID_STAKE'],
  ['negativo', -5000, 'INVALID_STAKE'],
  ['menor al mínimo (999)', 999, 'STAKE_OUT_OF_RANGE'],
  ['mayor al máximo (500.001)', 500001, 'STAKE_OUT_OF_RANGE'],
  ['tres decimales', 1000.123, 'INVALID_STAKE'],
];

for (const [name, value, code] of rejected) {
  test(`monto de apuesta ${name}: 400 ${code}`, () => {
    assert.throws(() => parseStake(value), (error) => error.statusCode === 400 && error.errorCode === code);
  });
}

for (const value of [1000, 1000.5, 10000, 250000.25, 500000]) {
  test(`monto de apuesta válido ${value}`, () => {
    assert.equal(parseStake(value), value);
  });
}
