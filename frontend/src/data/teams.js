/**
 * ⚠️ BASE DE DATOS IMPROVISADA (MOCK) — SOLO PARA DESARROLLO DEL FRONTEND ⚠️
 * -----------------------------------------------------------------------
 * Simula la tabla "teams". No es real, se reemplazará por el backend.
 * -----------------------------------------------------------------------
 */

/**
 * @typedef {Object} Team
 * @property {string} id
 * @property {string} name
 * @property {string} shortName
 * @property {string} logoUrl
 * @property {string} leagueId
 */

export const teams = [
  { id: 't1', name: 'Millonarios', shortName: 'MIL', logoUrl: 'https://placehold.co/80x80/1D4ED8/ffffff?text=MIL', leagueId: 'l1' },
  { id: 't2', name: 'Junior', shortName: 'JUN', logoUrl: 'https://placehold.co/80x80/F59E0B/ffffff?text=JUN', leagueId: 'l1' },
  { id: 't3', name: 'Atlético Nacional', shortName: 'NAC', logoUrl: 'https://placehold.co/80x80/0F766E/ffffff?text=NAC', leagueId: 'l1' },
  { id: 't4', name: 'América de Cali', shortName: 'AME', logoUrl: 'https://placehold.co/80x80/EF4444/ffffff?text=AME', leagueId: 'l1' },
  { id: 't5', name: 'Santa Fe', shortName: 'SFE', logoUrl: 'https://placehold.co/80x80/14B8A6/ffffff?text=SFE', leagueId: 'l1' },
  { id: 't6', name: 'Medellín', shortName: 'DIM', logoUrl: 'https://placehold.co/80x80/DB2777/ffffff?text=DIM', leagueId: 'l1' },
  { id: 't7', name: 'Pasto', shortName: 'PAS', logoUrl: 'https://placehold.co/80x80/7C3AED/ffffff?text=PAS', leagueId: 'l1' },
  { id: 't8', name: 'Bucaramanga', shortName: 'BUC', logoUrl: 'https://placehold.co/80x80/0EA5E9/ffffff?text=BUC', leagueId: 'l1' },
  { id: 't9', name: 'Once Caldas', shortName: 'ONC', logoUrl: 'https://placehold.co/80x80/F97316/ffffff?text=ONC', leagueId: 'l1' },
  { id: 't10', name: 'Tolima', shortName: 'TOL', logoUrl: 'https://placehold.co/80x80/22C55E/ffffff?text=TOL', leagueId: 'l1' },
];
