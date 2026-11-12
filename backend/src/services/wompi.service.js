const crypto = require('crypto');
const { unavailable } = require('../utils/httpError');

// Integración con Wompi según docs.wompi.co (consultado el 12 de noviembre de 2026).

function sha256(text) {
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
}

// Firma de integridad del Widget ("Widget & Checkout Web"):
//   SHA256("<Referencia><Monto en centavos><Moneda><SecretoIntegridad>")
// Sin fecha de expiración (es opcional y no se usa).
function integritySignature(reference, amountInCents, currency, integritySecret) {
  return sha256(`${reference}${amountInCents}${currency}${integritySecret}`);
}

// Lee "transaction.id" dentro de data.
function readPath(data, path) {
  return path.split('.').reduce((value, key) => (value == null ? undefined : value[key]), data);
}

// Checksum de un evento ("Eventos"):
//   1. Concatenar los valores de signature.properties, tomados de data, en ese orden.
//   2. Agregar timestamp.  3. Agregar el secreto de eventos.  4. SHA256.
// La doc muestra el checksum en mayúsculas: se compara sin distinguir mayúsculas.
function eventChecksum(event, eventsSecret) {
  const properties = event?.signature?.properties;
  if (!Array.isArray(properties) || properties.length === 0) return null;
  const values = properties.map((path) => {
    const value = readPath(event.data, path);
    return value === undefined || value === null ? '' : String(value);
  });
  return sha256(`${values.join('')}${event.timestamp}${eventsSecret}`);
}

// Comparación en tiempo constante: no revela cuántos caracteres coinciden.
function verifyEventChecksum(event, eventsSecret) {
  const expected = eventChecksum(event, eventsSecret);
  const received = event?.signature?.checksum;
  if (!expected || typeof received !== 'string' || !/^[0-9a-f]{64}$/i.test(received)) return false;
  return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(received.toLowerCase(), 'hex'));
}

async function wompiGet(config, path) {
  let response;
  try {
    response = await fetch(`${config.apiUrl}${path}`, {
      // "Seguimiento de transacciones": la consulta solo funciona con la llave PRIVADA, desde el backend.
      headers: { Authorization: `Bearer ${config.privateKey}` },
      signal: AbortSignal.timeout(5000),
    });
  } catch (error) {
    throw unavailable('Wompi no responde. Intenta de nuevo en unos minutos.', { database: 'wompi', errorCode: 'WOMPI_UNAVAILABLE' });
  }
  if (response.status === 404) return null;
  if (!response.ok) {
    throw unavailable(`Wompi respondió ${response.status}.`, { database: 'wompi', errorCode: 'WOMPI_UNAVAILABLE' });
  }
  return response.json();
}

// GET /v1/transactions/{id}: documentado en "Transacciones" y "Seguimiento de transacciones".
async function getTransaction(config, transactionId) {
  const body = await wompiGet(config, `/transactions/${encodeURIComponent(transactionId)}`);
  return body?.data ?? null;
}

// GET /v1/transactions?reference=...: cuando aún no se conoce el id.
// No aparece en las guías oficiales que se leyeron, pero se verificó en vivo contra Sandbox
// (12-nov-2026): con la llave privada responde 200 con { data: [transacciones] }; con la pública, 401.
async function findTransactionByReference(config, reference) {
  const body = await wompiGet(config, `/transactions?reference=${encodeURIComponent(reference)}`);
  const list = Array.isArray(body?.data) ? body.data : [];
  return list.find((transaction) => transaction.reference === reference) ?? null;
}

module.exports = {
  sha256, integritySignature, eventChecksum, verifyEventChecksum, getTransaction, findTransactionByReference,
};
