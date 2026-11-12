// El registro de pagos nunca debe dejar pasar llaves, firmas ni datos personales.
//   npm test
const test = require('node:test');
const assert = require('node:assert');
const { clean } = require('../src/utils/paymentLog');

test('paymentLog solo deja pasar campos de diagnóstico', () => {
  const out = clean({
    reference: 'ELD-x', amount_cop: 50000, status: 'CREDITED', source: 'POLL',
    username: 'demo', email: 'a@b.co', document_number: '1.234.567', signature: 'abc',
    privateKey: 'prv_test_x', integritySecret: 'test_integrity_x', Authorization: 'Bearer x',
  });
  assert.deepStrictEqual(out, { reference: 'ELD-x', amount_cop: 50000, status: 'CREDITED', source: 'POLL' });
});
