/**
 * ⚠️ Este servicio consulta actualmente la BASE DE DATOS IMPROVISADA (MOCK)
 * de src/data/promotions.js, no un backend real. Está estructurado para que,
 * al conectar el backend real, solo haya que cambiar el cuerpo de cada
 * función por un fetch('/api/...') — el resto de la app no debería cambiar.
 */
import { promotions } from '../data/promotions.js';

export async function getPromotions() {
  // TODO: reemplazar por fetch('/api/promotions') cuando el backend esté listo — actualmente usa datos improvisados de src/data/
  return new Promise((resolve) => {
    setTimeout(() => resolve(promotions), 250);
  });
}
