/**
 * ⚠️ BASE DE DATOS IMPROVISADA (MOCK) — SOLO PARA DESARROLLO DEL FRONTEND ⚠️
 * -----------------------------------------------------------------------
 * Simula la tabla "users". No es real, se reemplazará por el backend.
 * -----------------------------------------------------------------------
 */

/**
 * @typedef {Object} User
 * @property {string} id
 * @property {string} fullName
 * @property {string} username
 * @property {string} email
 * @property {string} password
 * @property {number} balance
 * @property {string} currency
 * @property {string} createdAt
 * @property {boolean} isActive
 * @property {'user'|'admin'} role
 */

export const users = [
  {
    id: 'u1',
    fullName: 'Andrés Salazar',
    username: 'andres10',
    email: 'andres@example.com',
    password: '123456',
    balance: 250000,
    currency: 'COP',
    createdAt: '2024-05-01T10:00:00Z',
    isActive: true,
    role: 'user',
  },
];
