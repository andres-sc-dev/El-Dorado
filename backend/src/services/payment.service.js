const crypto = require('crypto');
const wompiConfig = require('../config/wompi');
const { badRequest, forbidden, notFound, unauthorized } = require('../utils/httpError');

// Recargas con Wompi Sandbox.
// Flujo: prepare (firma y documento CREATED en Firestore) -> el usuario paga en el Widget ->
// el estado llega por dos caminos que terminan en la misma función applyTransaction:
//   a) GET /api/payments/:reference consulta a Wompi con la llave privada (hoy, sin URL pública);
//   b) POST /api/payments/webhook con el evento firmado (cuando haya URL pública).
// El saldo SOLO sube con fn_recargar(username, monto, reference), que es idempotente por reference:
// si los dos caminos llegan a la vez, o el evento se repite, se acredita una sola vez.

// Dependencias reemplazables en las pruebas (Firestore y Wompi falsos).
const deps = {
  store: require('./wompiFirebaseService'),
  wompi: require('./wompi.service'),
  accounts: require('../repositories/postgres/accountRepository'),
  audit: require('./auditService'),
};

const REFERENCE_PATTERN = /^ELD-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const TRANSACTION_ID_PATTERN = /^[A-Za-z0-9-]{3,64}$/;
const FINAL = ['CREDITED', 'DECLINED', 'ERROR', 'VOIDED'];
const DECLINED_STATUSES = ['DECLINED', 'ERROR', 'VOIDED'];

const invalid = (message, errorCode = 'INVALID_AMOUNT') => badRequest(message, { errorCode });
const formatCop = (value) => `$${value.toLocaleString('es-CO')}`;

function getConfig() {
  const { min, max, currency } = wompiConfig.readLimits();
  return {
    min_cop: min,
    max_cop: max,
    currency,
    sandbox_ready: wompiConfig.sandboxProblems(wompiConfig.readConfig(), ['publicKey', 'integritySecret']).length === 0,
  };
}

// El monto debe ser un entero JSON en pesos: sin textos, decimales, ceros ni negativos.
function parseAmount(value) {
  const { min, max } = wompiConfig.readLimits();
  const range = `Mínimo ${formatCop(min)} · Máximo ${formatCop(max)} por recarga.`;
  if (typeof value !== 'number' || !Number.isFinite(value)) throw invalid(`El monto debe ser un número. ${range}`);
  if (!Number.isInteger(value)) throw invalid(`El monto debe ser en pesos enteros, sin decimales. ${range}`);
  if (value <= 0) throw invalid(`El monto debe ser mayor que cero. ${range}`);
  if (value < min) throw invalid(`El monto mínimo es ${formatCop(min)}. ${range}`, 'AMOUNT_OUT_OF_RANGE');
  if (value > max) throw invalid(`El monto máximo es ${formatCop(max)}. ${range}`, 'AMOUNT_OUT_OF_RANGE');
  return value;
}

// POST /api/payments/prepare
async function prepare(user, body, ip) {
  const amountCop = parseAmount(body?.amountCop);
  const config = wompiConfig.requireSandbox(['publicKey', 'integritySecret']);
  const reference = `ELD-${crypto.randomUUID()}`;
  const amountInCents = amountCop * 100;
  const currency = 'COP';
  const signature = deps.wompi.integritySignature(reference, amountInCents, currency, config.integritySecret);

  await deps.store.createPayment({ reference, username: user.username, amountCop, amountInCents, currency });
  deps.audit.log('RECHARGE_CREATED', user.username, { reference, amount_cop: amountCop }, ip);

  // Solo datos públicos: la firma no revela el secreto y la llave pública es pública.
  return { reference, amountInCents, currency, signature, publicKey: config.publicKey };
}

function publicStatus(payment) {
  return {
    reference: payment.reference,
    status: payment.status,
    amount_cop: payment.amount_cop,
    currency: payment.currency,
    transaction_id: payment.transaction_id ?? null,
    balance: payment.balance ?? null,
    created_at: payment.created_at ?? null,
    updated_at: payment.updated_at ?? null,
  };
}

// Aplica el estado de una transacción de Wompi a un pago. Es el único lugar que acredita saldo.
async function applyTransaction(payment, transaction, source, ip = null) {
  if (FINAL.includes(payment.status)) return payment;

  // La transacción debe ser exactamente la que se firmó: misma referencia, monto y moneda.
  if (transaction.reference !== payment.reference
      || Number(transaction.amount_in_cents) !== payment.amount_in_cents
      || transaction.currency !== payment.currency) {
    console.error(`Pago ${payment.reference}: la transacción de Wompi no coincide con lo firmado (${source})`);
    return (await deps.store.updatePayment(payment.reference, { status: 'ERROR', wompi_status: 'MISMATCH' })) ?? payment;
  }

  const wompiStatus = transaction.status;
  const base = { wompi_status: wompiStatus, transaction_id: transaction.id ?? payment.transaction_id ?? null };

  if (wompiStatus === 'APPROVED') {
    await deps.store.updatePayment(payment.reference, { ...base, status: 'APPROVED' });
    const result = await deps.accounts.deposit(payment.username, payment.amount_cop, payment.reference);
    const updated = await deps.store.updatePayment(payment.reference, {
      ...base, status: 'CREDITED', balance: Number(result.balance),
    });
    if (result.credited) {
      deps.audit.log('RECHARGE_APPROVED', payment.username, {
        reference: payment.reference, amount_cop: payment.amount_cop, transaction_id: base.transaction_id, source,
      }, ip);
    }
    return updated ?? { ...payment, ...base, status: 'CREDITED', balance: Number(result.balance) };
  }

  if (DECLINED_STATUSES.includes(wompiStatus)) {
    const updated = await deps.store.updatePayment(payment.reference, { ...base, status: wompiStatus });
    deps.audit.log('RECHARGE_DECLINED', payment.username, {
      reference: payment.reference, amount_cop: payment.amount_cop, wompi_status: wompiStatus, source,
    }, ip);
    return updated ?? { ...payment, ...base, status: wompiStatus };
  }

  // PENDING: todavía no hay decisión; se guarda el id para la próxima consulta.
  return (await deps.store.updatePayment(payment.reference, base)) ?? payment;
}

// GET /api/payments/:reference (dueño o ADM)
async function getStatus(user, reference, transactionId, ip) {
  if (typeof reference !== 'string' || !REFERENCE_PATTERN.test(reference)) {
    throw notFound('La recarga no existe.', { errorCode: 'PAYMENT_NOT_FOUND' });
  }
  if (transactionId !== undefined && (typeof transactionId !== 'string' || !TRANSACTION_ID_PATTERN.test(transactionId))) {
    throw badRequest('El id de transacción no es válido.', { errorCode: 'INVALID_TRANSACTION_ID' });
  }

  let payment = await deps.store.getPayment(reference);
  if (!payment) throw notFound('La recarga no existe.', { errorCode: 'PAYMENT_NOT_FOUND' });
  if (payment.username !== user.username && user.role !== 'ADM') {
    throw forbidden('No puedes consultar la recarga de otro usuario.');
  }
  if (FINAL.includes(payment.status)) return publicStatus(payment);

  const config = wompiConfig.requireSandbox(['privateKey']);
  const id = transactionId || payment.transaction_id;
  const transaction = id
    ? await deps.wompi.getTransaction(config, id)
    : await deps.wompi.findTransactionByReference(config, reference);
  if (transaction) payment = await applyTransaction(payment, transaction, 'POLL', ip);
  return publicStatus(payment);
}

// POST /api/payments/webhook. rawBody es el cuerpo sin parsear (Buffer).
// Primero se verifica el checksum; nada se lee ni escribe antes.
async function handleWebhook(rawBody, ip) {
  const config = wompiConfig.requireSandbox(['eventsSecret']);
  let event;
  try {
    event = JSON.parse(Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : String(rawBody));
  } catch {
    throw unauthorized('Evento inválido.', { errorCode: 'INVALID_EVENT' });
  }
  if (!deps.wompi.verifyEventChecksum(event, config.eventsSecret)) {
    throw unauthorized('Checksum inválido.', { errorCode: 'INVALID_CHECKSUM' });
  }

  // Desde aquí el evento es auténtico. Se responde 200 aunque se ignore, para que Wompi no reintente.
  const transaction = event.data?.transaction;
  if (event.event !== 'transaction.updated' || !transaction) return { received: true, ignored: 'EVENT_TYPE' };
  if (event.environment !== 'test') return { received: true, ignored: 'NOT_SANDBOX' };
  if (!REFERENCE_PATTERN.test(transaction.reference || '')) return { received: true, ignored: 'FOREIGN_REFERENCE' };

  const payment = await deps.store.getPayment(transaction.reference);
  if (!payment) return { received: true, ignored: 'UNKNOWN_REFERENCE' };
  const updated = await applyTransaction(payment, transaction, 'WEBHOOK', ip);
  return { received: true, reference: updated.reference, status: updated.status };
}

module.exports = {
  getConfig, parseAmount, prepare, getStatus, handleWebhook, applyTransaction, deps, REFERENCE_PATTERN,
};
