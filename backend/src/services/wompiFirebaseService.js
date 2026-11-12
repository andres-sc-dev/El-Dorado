const { FieldValue } = require('firebase-admin/firestore');
const { withFirestore } = require('../config/firebase');

// Registro de cada recarga de Wompi en Firestore.
// Colección "payments"; el ID del documento es la reference (ELD-<uuid>), así un mismo pago
// nunca tiene dos documentos.
// Estados: CREATED (firmado, sin pagar), APPROVED (Wompi aprobó), CREDITED (saldo acreditado
// en PostgreSQL), DECLINED, ERROR y VOIDED. Finales: CREDITED, DECLINED, ERROR y VOIDED.

const COLLECTION = 'payments';
const STATUSES = ['CREATED', 'APPROVED', 'DECLINED', 'ERROR', 'VOIDED', 'CREDITED'];
const FINAL_STATUSES = ['CREDITED', 'DECLINED', 'ERROR', 'VOIDED'];

function toPlain(snapshot) {
  if (!snapshot.exists) return null;
  const data = snapshot.data();
  const plain = { ...data };
  for (const key of ['created_at', 'updated_at', 'credited_at']) {
    if (data[key]?.toDate) plain[key] = data[key].toDate().toISOString();
  }
  return plain;
}

// create() falla si el documento ya existe: dos recargas no pueden compartir referencia.
async function createPayment({ reference, username, amountCop, amountInCents, currency }) {
  return withFirestore((db) => db.collection(COLLECTION).doc(reference).create({
    reference,
    username,
    amount_cop: amountCop,
    amount_in_cents: amountInCents,
    currency,
    status: 'CREATED',
    wompi_status: null,
    transaction_id: null,
    created_at: FieldValue.serverTimestamp(),
    updated_at: FieldValue.serverTimestamp(),
  }));
}

async function getPayment(reference) {
  return withFirestore(async (db) => toPlain(await db.collection(COLLECTION).doc(reference).get()));
}

// Actualiza el estado con una transacción de Firestore. Un documento CREDITED nunca
// vuelve atrás (por ejemplo, un evento viejo que llega tarde).
async function updatePayment(reference, patch) {
  if (patch.status && !STATUSES.includes(patch.status)) throw new Error(`Estado de pago inválido: ${patch.status}`);
  return withFirestore((db) => db.runTransaction(async (transaction) => {
    const ref = db.collection(COLLECTION).doc(reference);
    const current = toPlain(await transaction.get(ref));
    if (!current) return null;
    if (current.status === 'CREDITED' && patch.status && patch.status !== 'CREDITED') return current;
    const update = { ...patch, updated_at: FieldValue.serverTimestamp() };
    if (patch.status === 'CREDITED') update.credited_at = FieldValue.serverTimestamp();
    transaction.update(ref, update);
    return { ...current, ...patch };
  }));
}

module.exports = { createPayment, getPayment, updatePayment, STATUSES, FINAL_STATUSES, COLLECTION };
