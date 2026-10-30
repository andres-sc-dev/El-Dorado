/**
 * ⚠️ BASE DE DATOS IMPROVISADA (MOCK) — SOLO PARA DESARROLLO DEL FRONTEND ⚠️
 * -----------------------------------------------------------------------
 * Simula la tabla "matches". No es real, se reemplazará por el backend.
 * -----------------------------------------------------------------------
 */

/**
 * @typedef {Object} Match
 * @property {string} id
 * @property {string} leagueId
 * @property {string} homeTeamId
 * @property {string} awayTeamId
 * @property {string} startTime
 * @property {'scheduled'|'live'|'finished'|'cancelled'} status
 * @property {number|null} homeScore
 * @property {number|null} awayScore
 */

export const matches = [
  { id: 'm1', leagueId: 'l1', homeTeamId: 't1', awayTeamId: 't2', startTime: '2026-08-25T18:30:00Z', status: 'scheduled', homeScore: null, awayScore: null },
  { id: 'm2', leagueId: 'l1', homeTeamId: 't3', awayTeamId: 't1', startTime: '2026-08-24T20:00:00Z', status: 'live', homeScore: 1, awayScore: 1 },
  { id: 'm3', leagueId: 'l1', homeTeamId: 't4', awayTeamId: 't5', startTime: '2026-08-26T16:00:00Z', status: 'scheduled', homeScore: null, awayScore: null },
  { id: 'm4', leagueId: 'l1', homeTeamId: 't6', awayTeamId: 't7', startTime: '2026-08-20T18:30:00Z', status: 'finished', homeScore: 2, awayScore: 1 },
  { id: 'm5', leagueId: 'l1', homeTeamId: 't8', awayTeamId: 't9', startTime: '2026-08-27T21:00:00Z', status: 'scheduled', homeScore: null, awayScore: null },
  { id: 'm6', leagueId: 'l1', homeTeamId: 't10', awayTeamId: 't3', startTime: '2026-08-18T19:00:00Z', status: 'finished', homeScore: 3, awayScore: 0 },
  { id: 'm7', leagueId: 'l1', homeTeamId: 't5', awayTeamId: 't8', startTime: '2026-08-28T20:15:00Z', status: 'scheduled', homeScore: null, awayScore: null },
  { id: 'm8', leagueId: 'l1', homeTeamId: 't2', awayTeamId: 't10', startTime: '2026-08-25T21:45:00Z', status: 'scheduled', homeScore: null, awayScore: null },
];
