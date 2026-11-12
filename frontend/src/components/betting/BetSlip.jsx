import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useBetSlip } from '../../context/BetSlipContext';
import { formatCOP, formatOdds } from '../../utils/format';
import Button from '../ui/Button';
import TeamShield from '../ui/TeamShield';

const DEFAULT_LIMITS = { min_stake: 1000, max_stake: 500000 };

// Validación previa en la interfaz (la API y PostgreSQL vuelven a validar todo).
function validateStake(stake, limits, balance) {
  const value = Number(stake);
  if (stake === '' || !Number.isFinite(value)) return 'Escribe un monto válido.';
  if (value <= 0) return 'El monto debe ser mayor que cero.';
  if (!/^\d+(\.\d{1,2})?$/.test(String(stake))) return 'El monto puede tener máximo 2 decimales.';
  if (value < limits.min_stake || value > limits.max_stake) {
    return `El monto debe estar entre ${formatCOP(limits.min_stake)} y ${formatCOP(limits.max_stake)}.`;
  }
  if (balance !== null && balance !== undefined && value > balance) return 'Saldo insuficiente.';
  return null;
}

// Cupón de apuesta simple: una selección y un monto.
// limits llega desde la página (GET /api/matches); se comparte por el contexto para que la hoja
// móvil use los mismos límites.
function BetSlip({ limits: limitsProp, idPrefix = 'slip' }) {
  const { user, isAdmin } = useAuth();
  const {
    selection, stake, setStake, potentialPayout, isSubmitting, clear, acceptOdds, submitBet,
    limits: sharedLimits, setLimits,
  } = useBetSlip();
  const [rawFeedback, setFeedback] = useState(null);
  const limits = limitsProp ?? sharedLimits ?? DEFAULT_LIMITS;

  useEffect(() => {
    if (limitsProp) setLimits(limitsProp);
  }, [limitsProp, setLimits]);

  // Si cambia la selección (otra cuota o se quitó), el aviso de cuota cambiada ya no aplica.
  const selectionKey = selection ? `${selection.matchCode}|${selection.marketCode}|${selection.outcomeCode}|${selection.line}` : '';
  const feedback = rawFeedback?.type === 'odds' && rawFeedback.selectionKey !== selectionKey ? null : rawFeedback;

  const stakeError = selection ? validateStake(stake, limits, user?.balance) : null;

  const handleSubmit = async (overrides) => {
    setFeedback(null);
    try {
      const result = await submitBet(overrides);
      setFeedback({
        type: 'success',
        message: `Apuesta registrada. Tiquete ${result.bet.ticket_code.slice(0, 8).toUpperCase()} · pago posible ${formatCOP(result.bet.potential_payout)}.`,
      });
    } catch (error) {
      if (error.code === 'ODDS_CHANGED') {
        setFeedback({ type: 'odds', selectionKey, previousOdds: selection?.oddValue, currentOdds: Number(error.data.current_odds) });
        acceptOdds(error.data.current_odds);
        return;
      }
      setFeedback({ type: 'error', message: error.message || 'No se pudo registrar la apuesta.' });
    }
  };

  if (isAdmin) {
    return (
      <aside className="glass-panel rounded-2xl p-4 text-sm text-slate-300">
        Los administradores no apuestan. Usa el <Link to="/admin" className="text-brand-gold">panel de administración</Link>.
      </aside>
    );
  }

  return (
    <aside className="glass-panel rounded-2xl p-4" aria-labelledby="betslip-title">
      <div className="mb-4 flex items-center justify-between">
        <h3 id="betslip-title" className="text-xl font-bold text-white">Cupón · apuesta simple</h3>
        {selection ? <button type="button" className="text-sm text-brand-gold" onClick={clear}>Quitar</button> : null}
      </div>

      {!selection ? (
        <div className="rounded-xl border border-dashed border-white/10 bg-slate-900/20 p-4 text-sm text-slate-400">
          Elige una cuota para armar tu apuesta. Solo se permite una selección por tiquete.
        </div>
      ) : (
        <div className="rounded-xl border border-white/10 bg-slate-900/30 p-3">
          {selection.homeTeam && selection.awayTeam ? (
            <div className="mb-2 flex items-center gap-2" aria-hidden="true">
              <TeamShield team={selection.homeTeam} size="sm" />
              <span className="text-xs text-slate-500">vs</span>
              <TeamShield team={selection.awayTeam} size="sm" />
            </div>
          ) : null}
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{selection.matchLabel} · {selection.matchCode}</p>
          <p className="mt-1 text-sm text-slate-300">{selection.marketName}</p>
          <p className="font-semibold text-white">
            {selection.outcomeName} ·{' '}
            <span
              data-testid="slip-odds"
              className={feedback?.type === 'odds' ? 'rounded bg-amber-400/25 px-1.5 text-amber-200 ring-1 ring-amber-300' : ''}
            >
              {formatOdds(selection.oddValue)}
            </span>
          </p>
        </div>
      )}

      <div className="mt-5 space-y-3">
        <div>
          <label htmlFor={`${idPrefix}-stake`} className="mb-1 block text-xs uppercase tracking-[0.2em] text-slate-400">Monto a apostar (COP)</label>
          <input
            id={`${idPrefix}-stake`}
            type="number"
            inputMode="decimal"
            value={stake}
            min={limits.min_stake}
            max={limits.max_stake}
            step={1000}
            onChange={(event) => setStake(event.target.value)}
            className="form-input"
          />
          <p className="mt-1 text-xs text-slate-400">
            Mínimo {formatCOP(limits.min_stake)} · máximo {formatCOP(limits.max_stake)}
            {user?.balance !== null && user?.balance !== undefined ? ` · saldo ${formatCOP(user.balance)}` : ''}
          </p>
          {stakeError ? <p className="mt-1 text-xs text-red-300">{stakeError}</p> : null}
        </div>

        <div className="rounded-xl bg-brand-gold/10 p-3">
          <div className="flex items-center justify-between text-sm text-slate-300">
            <span>Pago posible</span>
            <span className="text-xl font-bold text-brand-gold">{formatCOP(potentialPayout)}</span>
          </div>
        </div>

        {user ? (
          <Button
            type="button"
            className="w-full disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() => handleSubmit()}
            disabled={!selection || Boolean(stakeError) || isSubmitting || feedback?.type === 'odds'}
          >
            {isSubmitting ? 'Registrando…' : 'Realizar apuesta'}
          </Button>
        ) : (
          <Link to="/login" className="block">
            <Button type="button" className="w-full">Inicia sesión para apostar</Button>
          </Link>
        )}

        {feedback?.type === 'odds' ? (
          <div role="alert" className="rounded-lg border border-amber-400/40 bg-amber-400/10 px-3 py-2 text-sm text-amber-100">
            <p className="font-bold">Las cuotas cambiaron</p>
            <p>
              {feedback.previousOdds ? <>Antes {formatOdds(feedback.previousOdds)}, </> : null}
              ahora <span className="font-bold text-amber-200">{formatOdds(feedback.currentOdds)}</span>.
              Pago posible {formatCOP(potentialPayout)}.
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <Button
                type="button"
                className="disabled:opacity-50"
                disabled={isSubmitting || Boolean(stakeError)}
                onClick={() => handleSubmit({ oddValue: feedback.currentOdds })}
              >
                {isSubmitting ? 'Registrando…' : 'Aceptar y apostar'}
              </Button>
              <button type="button" className="text-sm text-slate-300 underline" onClick={() => { clear(); setFeedback(null); }}>
                Cancelar
              </button>
            </div>
          </div>
        ) : null}

        {feedback && feedback.type !== 'odds' ? (
          <div
            role={feedback.type === 'error' ? 'alert' : 'status'}
            className={`rounded-lg border px-3 py-2 text-sm ${
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
