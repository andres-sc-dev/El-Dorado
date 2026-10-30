/**
 * ⚠️ BASE DE DATOS IMPROVISADA (MOCK) — SOLO PARA DESARROLLO DEL FRONTEND ⚠️
 * -----------------------------------------------------------------------
 * Simula la tabla "bets". No es real, se reemplazará por el backend.
 * -----------------------------------------------------------------------
 */

/**
 * @typedef {Object} BetSelection
 * @property {string} id
 * @property {string} betId
 * @property {string} matchId
 * @property {string} oddId
 * @property {number} oddValueAtBetTime
 * @property {'pending'|'won'|'lost'} result
 */

/**
 * @typedef {Object} Bet
 * @property {string} id
 * @property {string} userId
 * @property {'pending'|'won'|'lost'|'cancelled'} status
 * @property {number} stake
 * @property {number} totalOdds
 * @property {number} potentialPayout
 * @property {string} createdAt
 * @property {BetSelection[]} selections
 */

export const bets = [
  {
    id: 'b1',
    userId: 'u1',
    status: 'won',
    stake: 20000,
    totalOdds: 2.4,
    potentialPayout: 48000,
    createdAt: '2026-08-18T19:15:00Z',
    selections: [
      { id: 'bs1', betId: 'b1', matchId: 'm6', oddId: 'o16', oddValueAtBetTime: 1.85, result: 'won' },
    ],
  },
  {
    id: 'b2',
    userId: 'u1',
    status: 'pending',
    stake: 50000,
    totalOdds: 3.2,
    potentialPayout: 160000,
    createdAt: '2026-08-21T17:20:00Z',
    selections: [
      { id: 'bs2', betId: 'b2', matchId: 'm3', oddId: 'o7', oddValueAtBetTime: 1.9, result: 'pending' },
    ],
  },
  {
    id: 'b3',
    userId: 'u1',
    status: 'lost',
    stake: 15000,
    totalOdds: 2.1,
    potentialPayout: 31500,
    createdAt: '2026-08-15T16:40:00Z',
    selections: [
      { id: 'bs3', betId: 'b3', matchId: 'm4', oddId: 'o12', oddValueAtBetTime: 2.1, result: 'lost' },
    ],
  },
];
