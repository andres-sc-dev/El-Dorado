import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useBetSlip } from '../../context/BetSlipContext';
import { formatOdds } from '../../utils/format';
import BetSlip from './BetSlip';

// Rutas donde se apuesta: ahí la barra se ve aunque el cupón esté vacío.
const BETTING_PATHS = ['/', '/matches'];

// Solo en pantallas pequeñas (xl:hidden): barra fija abajo con el número de selecciones y la cuota.
// Al tocarla se abre el cupón como hoja deslizable desde abajo. Apuesta simple: 0 o 1 selección.
function MobileBetSlipBar() {
  const { isAdmin } = useAuth();
  const { selection, isOpen, setIsOpen } = useBetSlip();
  const { pathname } = useLocation();
  const visible = !isAdmin && (Boolean(selection) || BETTING_PATHS.includes(pathname));

  // Cambiar de página cierra la hoja; Escape también.
  useEffect(() => { setIsOpen(false); }, [pathname, setIsOpen]);
  useEffect(() => {
    if (!isOpen) return undefined;
    const onKey = (event) => { if (event.key === 'Escape') setIsOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, setIsOpen]);

  if (!visible) return null;
  const count = selection ? 1 : 0;

  return (
    <>
      {/* Espacio para que la barra fija no tape el pie de página. */}
      <div className="h-16 xl:hidden" aria-hidden="true" />

      <button
        type="button"
        onClick={() => setIsOpen(true)}
        aria-expanded={isOpen}
        aria-controls="mobile-betslip"
        className="fixed inset-x-0 bottom-0 z-40 flex h-16 items-center justify-between border-t border-steel/70 bg-surface/95 px-4 text-left backdrop-blur focus-visible:outline-offset-[-4px] xl:hidden"
      >
        <span className="flex items-center gap-3">
          <span className="cut-s flex h-9 w-9 items-center justify-center bg-gold font-mono text-sm font-bold text-night">{count}</span>
          <span className="font-display text-sm font-semibold uppercase tracking-[0.12em] text-ink">
            {count === 1 ? '1 selección' : 'Sin selecciones'}
            <span className="block font-sans text-xs font-normal normal-case tracking-normal text-ink-muted">{selection ? selection.outcomeName : 'Toca una cuota para apostar'}</span>
          </span>
        </span>
        <span className="text-right">
          <span className="eyebrow block text-ink-muted">Cuota</span>
          <span className="font-mono text-lg font-bold text-gold">{selection ? formatOdds(selection.oddValue) : '—'}</span>
        </span>
      </button>

      {isOpen ? (
        <div className="fixed inset-0 z-50 xl:hidden" role="dialog" aria-modal="true" aria-label="Cupón de apuesta">
          <button type="button" aria-label="Cerrar cupón" className="absolute inset-0 bg-night/80" onClick={() => setIsOpen(false)} />
          <div id="mobile-betslip" className="sheet-up absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto border-t-2 border-steel/70 bg-night p-3 pb-6">
            <div className="mb-2 flex items-center justify-between px-1">
              <span className="mx-auto h-1.5 w-12 rounded-full bg-line-strong" aria-hidden="true" />
            </div>
            <button type="button" className="mb-2 ml-auto block min-h-[44px] px-2 font-display text-xs font-bold uppercase tracking-[0.16em] text-ink-muted hover:text-ink" onClick={() => setIsOpen(false)}>Cerrar</button>
            <BetSlip idPrefix="mobile-slip" />
          </div>
        </div>
      ) : null}
    </>
  );
}

export default MobileBetSlipBar;
