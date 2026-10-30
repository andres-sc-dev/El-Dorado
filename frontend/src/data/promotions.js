/**
 * ⚠️ BASE DE DATOS IMPROVISADA (MOCK) — SOLO PARA DESARROLLO DEL FRONTEND ⚠️
 * -----------------------------------------------------------------------
 * Simula la tabla "promotions". No es real, se reemplazará por el backend.
 * -----------------------------------------------------------------------
 */

/**
 * @typedef {Object} Promotion
 * @property {string} id
 * @property {string} title
 * @property {string} description
 * @property {string} imageUrl
 * @property {boolean} isActive
 * @property {string} validUntil
 */

export const promotions = [
  { id: 'p1', title: 'Bono de bienvenida Primera A', description: 'Recibe 100% hasta $200.000 para apostar en la Primera División de Colombia.', imageUrl: 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?auto=format&fit=crop&w=800&q=80&v=1', isActive: true, validUntil: '2026-12-31T23:59:59Z' },
  { id: 'p2', title: 'Cashback del fin de semana', description: 'Obtén 15% de cashback en apuestas de jornada de la Primera A.', imageUrl: 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?auto=format&fit=crop&w=800&q=80&v=1', isActive: true, validUntil: '2026-09-15T23:59:59Z' },
  { id: 'p3', title: 'Apuesta segura local', description: 'Cobertura parcial en tus primeras cuatro apuestas del torneo colombiano.', imageUrl: 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?auto=format&fit=crop&w=800&q=80&v=1', isActive: false, validUntil: '2026-08-30T23:59:59Z' },
];
