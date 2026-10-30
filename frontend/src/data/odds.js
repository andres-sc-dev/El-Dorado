/**
 * ⚠️ BASE DE DATOS IMPROVISADA (MOCK) — SOLO PARA DESARROLLO DEL FRONTEND ⚠️
 * -----------------------------------------------------------------------
 * Simula la tabla "odds". No es real, se reemplazará por el backend.
 * -----------------------------------------------------------------------
 */

/**
 * @typedef {Object} Odd
 * @property {string} id
 * @property {string} matchId
 * @property {'1x2'|'over_under'|'both_teams_score'} market
 * @property {'1'|'X'|'2'|'Over 2.5'|'Under 2.5'|'Yes'|'No'} label
 * @property {number} value
 * @property {string} updatedAt
 */

export const odds = [
  { id: 'o1', matchId: 'm1', market: '1x2', label: '1', value: 2.4, updatedAt: '2026-08-24T09:00:00Z' },
  { id: 'o2', matchId: 'm1', market: '1x2', label: 'X', value: 3.05, updatedAt: '2026-08-24T09:00:00Z' },
  { id: 'o3', matchId: 'm1', market: '1x2', label: '2', value: 2.8, updatedAt: '2026-08-24T09:00:00Z' },
  { id: 'o4', matchId: 'm2', market: '1x2', label: '1', value: 2.15, updatedAt: '2026-08-24T09:00:00Z' },
  { id: 'o5', matchId: 'm2', market: '1x2', label: 'X', value: 3.2, updatedAt: '2026-08-24T09:00:00Z' },
  { id: 'o6', matchId: 'm2', market: '1x2', label: '2', value: 2.95, updatedAt: '2026-08-24T09:00:00Z' },
  { id: 'o7', matchId: 'm3', market: '1x2', label: '1', value: 1.9, updatedAt: '2026-08-24T09:00:00Z' },
  { id: 'o8', matchId: 'm3', market: '1x2', label: 'X', value: 3.35, updatedAt: '2026-08-24T09:00:00Z' },
  { id: 'o9', matchId: 'm3', market: '1x2', label: '2', value: 3.8, updatedAt: '2026-08-24T09:00:00Z' },
  { id: 'o10', matchId: 'm4', market: '1x2', label: '1', value: 2.9, updatedAt: '2026-08-24T09:00:00Z' },
  { id: 'o11', matchId: 'm4', market: '1x2', label: 'X', value: 3.4, updatedAt: '2026-08-24T09:00:00Z' },
  { id: 'o12', matchId: 'm4', market: '1x2', label: '2', value: 2.1, updatedAt: '2026-08-24T09:00:00Z' },
  { id: 'o13', matchId: 'm5', market: '1x2', label: '1', value: 2.55, updatedAt: '2026-08-24T09:00:00Z' },
  { id: 'o14', matchId: 'm5', market: '1x2', label: 'X', value: 3.15, updatedAt: '2026-08-24T09:00:00Z' },
  { id: 'o15', matchId: 'm5', market: '1x2', label: '2', value: 2.7, updatedAt: '2026-08-24T09:00:00Z' },
  { id: 'o16', matchId: 'm6', market: '1x2', label: '1', value: 1.85, updatedAt: '2026-08-24T09:00:00Z' },
  { id: 'o17', matchId: 'm6', market: '1x2', label: 'X', value: 3.5, updatedAt: '2026-08-24T09:00:00Z' },
  { id: 'o18', matchId: 'm6', market: '1x2', label: '2', value: 4.2, updatedAt: '2026-08-24T09:00:00Z' },
  { id: 'o19', matchId: 'm7', market: '1x2', label: '1', value: 2.1, updatedAt: '2026-08-24T09:00:00Z' },
  { id: 'o20', matchId: 'm7', market: '1x2', label: 'X', value: 3.1, updatedAt: '2026-08-24T09:00:00Z' },
  { id: 'o21', matchId: 'm7', market: '1x2', label: '2', value: 3.0, updatedAt: '2026-08-24T09:00:00Z' },
  { id: 'o22', matchId: 'm8', market: '1x2', label: '1', value: 1.95, updatedAt: '2026-08-24T09:00:00Z' },
  { id: 'o23', matchId: 'm8', market: '1x2', label: 'X', value: 3.3, updatedAt: '2026-08-24T09:00:00Z' },
  { id: 'o24', matchId: 'm8', market: '1x2', label: '2', value: 3.6, updatedAt: '2026-08-24T09:00:00Z' },
];
