// Formatos es-CO para dinero, fechas y documentos.

const copFormatter = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 2 });
const integerFormatter = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 });

export function formatCOP(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—';
  return copFormatter.format(Number(value));
}

export function formatOdds(value) {
  return Number(value).toFixed(2);
}

export function formatDateTime(value) {
  if (!value) return 'Sin fecha';
  return new Date(value).toLocaleString('es-CO', {
    weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  });
}

// Cédula con puntos de miles y sin enmascarar: 1000000001 -> 1.000.000.001.
// Los documentos con letras (pasaporte) se muestran tal cual.
export function formatDocument(documentNumber) {
  if (!documentNumber) return '—';
  const text = String(documentNumber);
  return /^\d+$/.test(text) ? integerFormatter.format(Number(text)) : text;
}

export const BET_STATUS_LABELS = {
  OPEN: 'Abierta',
  WON: 'Ganada',
  LOST: 'Perdida',
  CANCELLED: 'Anulada',
  REFUNDED: 'Devuelta',
};

export const MATCH_STATUS_LABELS = {
  SCHEDULED: 'Programado',
  LIVE: 'En juego',
  FINISHED: 'Finalizado',
  CANCELLED: 'Cancelado',
};
