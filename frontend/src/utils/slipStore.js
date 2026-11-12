const STORAGE_KEY = 'eldorado.betslip';
export const DEFAULT_STAKE = 10000;

// El cupón se guarda en sessionStorage: sobrevive a recargar la página y a cambiar de ruta,
// y se borra al cerrar la pestaña. Si el almacenamiento está bloqueado, el cupón sigue en memoria.
// Solo se guarda lo que se ve en el cupón: nada de sesión ni datos personales.
export const slipStore = {
  read() {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const saved = JSON.parse(raw);
      const selection = saved?.selection;
      // Una selección guardada debe tener lo mínimo para apostar; si no, se descarta.
      const valid = selection && typeof selection.matchCode === 'string'
        && typeof selection.marketCode === 'string' && typeof selection.outcomeCode === 'string'
        && Number.isFinite(Number(selection.oddValue));
      return {
        selection: valid ? { ...selection, oddValue: Number(selection.oddValue) } : null,
        stake: saved?.stake ?? DEFAULT_STAKE,
      };
    } catch {
      return null;
    }
  },
  write(state) {
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* sin almacenamiento */ }
  },
  clear() {
    try { sessionStorage.removeItem(STORAGE_KEY); } catch { /* sin almacenamiento */ }
  },
};
