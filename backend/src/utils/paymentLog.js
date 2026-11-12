// Registro de diagnóstico del flujo de pagos (una línea JSON por paso).
// Solo se permiten campos de esta lista: nunca llaves, firmas, secretos, usuario, correo ni cédula.
// La reference (ELD-<uuid aleatorio>) y el id de Wompi no identifican a una persona.
const ALLOWED = new Set([
  'reference', 'transaction_id', 'amount_cop', 'source', 'status', 'wompi_status',
  'stored_status', 'credited', 'ignored', 'http_status', 'error_code', 'ms', 'found',
]);

// Durante `node --test` no se escribe nada, para no ensuciar la salida de las pruebas.
const silent = () => Boolean(process.env.NODE_TEST_CONTEXT) || process.env.PAYMENT_LOGS === 'off';

function clean(fields) {
  const out = {};
  for (const [key, value] of Object.entries(fields || {})) {
    if (ALLOWED.has(key) && value !== undefined) out[key] = value;
  }
  return out;
}

function paymentLog(step, fields) {
  if (silent()) return;
  console.log(JSON.stringify({ at: new Date().toISOString(), scope: 'payments', step, ...clean(fields) }));
}

module.exports = { paymentLog, clean };
