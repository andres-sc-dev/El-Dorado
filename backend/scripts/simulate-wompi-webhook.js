// Simula el webhook de Wompi sin túnel ni URL pública.
// Arma un evento transaction.updated (estructura de docs.wompi.co "Eventos"), lo firma con
// WOMPI_EVENTS_SECRET y lo envía a POST /api/payments/webhook del backend local.
//
//   node scripts/simulate-wompi-webhook.js <reference> [APPROVED|DECLINED|ERROR|VOIDED] [--bad-signature]
//
// La reference y el monto deben ser los de una recarga creada con POST /api/payments/prepare:
// si el monto no coincide con lo firmado, el backend marca la recarga ERROR y no acredita.
// El monto va en --amount=<pesos> (o WEBHOOK_AMOUNT_COP). El destino es WEBHOOK_TARGET
// (por defecto http://localhost:4000).
require('dotenv').config();
const crypto = require('crypto');
const { eventChecksum } = require('../src/services/wompi.service');

function parseArgs(argv) {
  const args = { reference: null, status: 'APPROVED', amountCop: Number(process.env.WEBHOOK_AMOUNT_COP || 0), badSignature: false };
  for (const arg of argv) {
    if (arg === '--bad-signature') args.badSignature = true;
    else if (arg.startsWith('--amount=')) args.amountCop = Number(arg.slice('--amount='.length));
    else if (/^(APPROVED|DECLINED|ERROR|VOIDED|PENDING)$/.test(arg)) args.status = arg;
    else if (!args.reference) args.reference = arg;
  }
  return args;
}

async function main() {
  const { reference, status, amountCop, badSignature } = parseArgs(process.argv.slice(2));
  const secret = process.env.WOMPI_EVENTS_SECRET;
  const baseUrl = (process.env.WEBHOOK_TARGET || `http://localhost:${process.env.PORT || 4000}`).replace(/\/$/, '');
  if (!reference) throw new Error('Uso: node scripts/simulate-wompi-webhook.js <reference> [APPROVED|DECLINED] --amount=<pesos>');
  if (!Number.isInteger(amountCop) || amountCop <= 0) throw new Error('Indica el monto de la recarga con --amount=<pesos>');
  if (!secret) throw new Error('Falta WOMPI_EVENTS_SECRET');

  const timestamp = Math.floor(Date.now() / 1000);
  const event = {
    event: 'transaction.updated',
    data: {
      transaction: {
        id: `sim-${timestamp}-${crypto.randomInt(10000, 99999)}`,
        amount_in_cents: amountCop * 100,
        reference,
        customer_email: 'simulacion@eldorado.local',
        currency: 'COP',
        payment_method_type: 'CARD',
        redirect_url: null,
        status,
        shipping_address: null,
        payment_link_id: null,
        payment_source_id: null,
      },
    },
    environment: 'test',
    signature: {
      properties: ['transaction.id', 'transaction.status', 'transaction.amount_in_cents'],
      checksum: '',
    },
    timestamp,
    sent_at: new Date().toISOString(),
  };
  // Wompi muestra el checksum en mayúsculas en su ejemplo; se envía igual.
  event.signature.checksum = (badSignature ? '0'.repeat(64) : eventChecksum(event, secret)).toUpperCase();

  const response = await fetch(`${baseUrl}/api/payments/webhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(event),
  });
  const text = await response.text();
  console.log(`Evento ${status} para ${reference} (transacción ${event.data.transaction.id})`);
  console.log(`-> ${response.status} ${text}`);
  if (!response.ok) process.exitCode = 1;
}

main().catch((error) => {
  console.error(`simulate-wompi-webhook falló: ${error.message}`);
  process.exitCode = 1;
});
