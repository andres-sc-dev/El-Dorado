/**
 * ⚠️ BASE DE DATOS IMPROVISADA (MOCK) — SOLO PARA DESARROLLO DEL FRONTEND ⚠️
 * -----------------------------------------------------------------------
 * Simula la tabla "transactions". No es real, se reemplazará por el backend.
 * -----------------------------------------------------------------------
 */

/**
 * @typedef {Object} Transaction
 * @property {string} id
 * @property {string} userId
 * @property {'deposit'|'withdrawal'|'bet_placed'|'bet_payout'} type
 * @property {number} amount
 * @property {string} createdAt
 * @property {'completed'|'pending'|'failed'} status
 */

export const transactions = [
  { id: 'tr1', userId: 'u1', type: 'deposit', amount: 250000, createdAt: '2026-08-01T12:00:00Z', status: 'completed' },
  { id: 'tr2', userId: 'u1', type: 'bet_placed', amount: -50000, createdAt: '2026-08-21T17:20:00Z', status: 'completed' },
  { id: 'tr3', userId: 'u1', type: 'bet_payout', amount: 48000, createdAt: '2026-08-18T19:30:00Z', status: 'completed' },
];
