import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useBetSlip } from '../../context/BetSlipContext';
import Button from '../ui/Button';

function BetSlip() {
  const { user } = useAuth();
  const { selections, totalOdds, stake, setStake, potentialPayout, removeSelection, clear, submitBet } = useBetSlip();
  const [feedback, setFeedback] = useState({ type: '', message: '' });

  const handleSubmit = async () => {
    if (!user) {
      setFeedback({ type: 'error', message: 'Debes iniciar sesión para realizar una apuesta' });
      return;
    }

    try {
      await submitBet();
      setFeedback({ type: 'success', message: 'Apuesta registrada correctamente' });
    } catch (error) {
      setFeedback({ type: 'error', message: error?.message || 'No se pudo completar la apuesta' });
    }
  };

  return (
    <aside className="glass-panel rounded-2xl p-4">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-xl font-bold text-white">Cupón de apuestas</h3>
        <button type="button" className="text-sm text-brand-gold" onClick={clear}>Vaciar</button>
      </div>

      {selections.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/10 bg-slate-900/20 p-4 text-sm text-slate-400">
          Todavía no has agregado selecciones.
        </div>
      ) : (
        <div className="space-y-3">
          {selections.map((selection) => (
            <div key={selection.oddId} className="rounded-xl border border-white/10 bg-slate-900/30 p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{selection.matchLabel}</p>
                  <p className="font-semibold text-white">{selection.label} · {selection.value.toFixed(2)}</p>
                </div>
                <button
                  type="button"
                  onClick={() => removeSelection(selection.oddId)}
                  className="text-sm text-red-300"
                >
                  Quitar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-5 space-y-3">
        <div>
          <label className="mb-1 block text-xs uppercase tracking-[0.2em] text-slate-400">Cuota total</label>
          <div className="rounded-lg border border-white/10 bg-brand-input px-3 py-2 text-lg font-bold text-brand-gold">
            {totalOdds.toFixed(2)}
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs uppercase tracking-[0.2em] text-slate-400">Monto a apostar</label>
          <input
            type="number"
            value={stake}
            min={1000}
            step={1000}
            onChange={(event) => setStake(Number(event.target.value))}
            className="form-input"
          />
        </div>

        <div className="rounded-xl bg-brand-gold/10 p-3">
          <div className="flex items-center justify-between text-sm text-slate-300">
            <span>Pago potencial</span>
            <span className="text-xl font-bold text-brand-gold">$ {potentialPayout.toLocaleString('es-CO')}</span>
          </div>
        </div>

        <Button type="button" className="w-full" onClick={handleSubmit} disabled={!user || selections.length === 0}>
          Realizar apuesta
        </Button>

        {feedback.message ? (
          <div
            className={`mt-3 rounded-lg border px-3 py-2 text-sm ${
              feedback.type === 'success'
                ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'
                : 'border-red-500/40 bg-red-500/10 text-red-200'
            }`}
          >
            {feedback.message}
          </div>
        ) : null}
      </div>
    </aside>
  );
}

export default BetSlip;
