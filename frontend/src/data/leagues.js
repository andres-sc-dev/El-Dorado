/**
 * ⚠️ BASE DE DATOS IMPROVISADA (MOCK) — SOLO PARA DESARROLLO DEL FRONTEND ⚠️
 * -----------------------------------------------------------------------
 * Simula la tabla "leagues". No es real, se reemplazará por el backend.
 * -----------------------------------------------------------------------
 */

/**
 * @typedef {Object} League
 * @property {string} id
 * @property {string} name
 * @property {string} country
 * @property {string} logoUrl
 */

export const leagues = [
  {
    id: 'l1',
    name: 'Primera A - Colombia',
    country: 'Colombia',
    logoUrl: 'https://placehold.co/80x80/0F172A/ffffff?text=COL',
  },
];
