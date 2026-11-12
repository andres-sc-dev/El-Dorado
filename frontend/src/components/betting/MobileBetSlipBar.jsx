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
        className="fixed inset-x-0 bottom-0 z-40 flex h-16 items-center justify-between border-t border-brand-gold/40 bg-brand-navyAlt/95 px-4 text-left backdrop-blur xl:hidden"
      >
        <span className="flex items-center gap-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-gold text-sm font-black text-slate-900">{count}</span>
          <span className="text-sm text-slate-200">
            {count === 1 ? '1 selección' : 'Sin selecciones'}
            <span className="block text-xs text-slate-400">{selection ? selection.outcomeName : 'Toca una cuota para apostar'}</span>
          </span>
        </span>
        <span className="text-right">
          <span className="block text-xs uppercase tracking-[0.2em] text-slate-400">Cuota</span>
          <span className="text-lg font-bold text-brand-gold">{selection ? formatOdds(selection.oddValue) : '—'}</span>
        </span>
      </button>

      {isOpen ? (
        <div className="fixed inset-0 z-50 xl:hidden" role="dialog" aria-modal="true" aria-label="Cupón de apuesta">
          <button type="button" aria-label="Cerrar cupón" className="absolute inset-0 bg-black/60" onClick={() => setIsOpen(false)} />
          <div id="mobile-betslip" className="sheet-up absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-3xl border-t border-white/10 bg-brand-navy p-3 pb-6">
            <div className="mb-2 flex items-center justify-between px-1">
              <span className="mx-auto h-1.5 w-12 rounded-full bg-white/20" aria-hidden="true" />
            </div>
            <button type="button" className="mb-2 ml-auto block text-sm text-slate-300" onClick={() => setIsOpen(false)}>Cerrar</button>
            <BetSlip idPrefix="mobile-slip" />
          </div>
        </div>
      ) : null}
    </>
  );
}

export default MobileBetSlipBar;
