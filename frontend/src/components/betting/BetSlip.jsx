import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useBetSlip } from '../../context/BetSlipContext';
import { formatCOP, formatOdds } from '../../utils/format';
import Button from '../ui/Button';
import Panel from '../ui/Panel';
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
      <Panel as="aside" tone="steel" innerClassName="p-4 text-sm text-ink-muted">
        Los administradores no apuestan. Usa el <Link to="/admin" className="font-semibold text-gold underline-offset-2 hover:underline">panel de administración</Link>.
      </Panel>
    );
  }

  return (
    <Panel as="aside" tone="steel" aria-labelledby="betslip-title" innerClassName="p-4">
      <div className="-mx-4 -mt-4 mb-4 flex min-h-[52px] items-center justify-between border-b border-line bg-surface-2/60 px-4">
        <h3 id="betslip-title" className="font-display text-sm font-bold">
          <span className="uppercase tracking-[0.24em] text-gold">Cupón</span>{' '}
          <span className="font-sans font-medium text-ink-muted">· Apuesta simple</span>
        </h3>
        {selection ? (
          <button type="button" className="min-h-[44px] px-2 font-display text-xs font-bold uppercase tracking-[0.16em] text-gold hover:text-ink" onClick={clear}>
            Quitar
          </button>
        ) : null}
      </div>

      {!selection ? (
        <div className="border border-dashed border-line-strong bg-night/60 p-4 text-sm text-ink-muted">
          Elige una cuota para armar tu apuesta. Solo se permite una selección por tiquete.
        </div>
      ) : (
        <div className="cut-s bg-surface-2 p-3">
          {selection.homeTeam && selection.awayTeam ? (
            <div className="mb-2 flex items-center gap-2" aria-hidden="true">
              <TeamShield team={selection.homeTeam} size="sm" />
              <span className="font-display text-xs font-bold text-ink-muted">VS</span>
              <TeamShield team={selection.awayTeam} size="sm" />
            </div>
          ) : null}
          <p className="eyebrow text-steel">{selection.matchLabel}</p>
          <p className="mt-1 text-sm text-ink-muted">{selection.marketName}</p>
          <p className="font-semibold text-ink">
            {selection.outcomeName} ·{' '}
            <span
              data-testid="slip-odds"
              className={`font-mono ${feedback?.type === 'odds' ? 'bg-amber-400/25 px-1.5 text-amber-200 ring-1 ring-amber-300' : 'text-gold'}`}
            >
              {formatOdds(selection.oddValue)}
            </span>
          </p>
        </div>
      )}

      <div className="mt-5 space-y-3">
        <div>
          <label htmlFor={`${idPrefix}-stake`} className="eyebrow mb-1 block text-ink-muted">Monto a apostar (COP)</label>
          <input
            id={`${idPrefix}-stake`}
            type="number"
            inputMode="decimal"
            value={stake}
            min={limits.min_stake}
            max={limits.max_stake}
            step={1000}
            onChange={(event) => setStake(event.target.value)}
            className="form-input font-mono"
          />
          <p className="mt-1 font-mono text-xs text-ink-muted">
            Mínimo {formatCOP(limits.min_stake)} · máximo {formatCOP(limits.max_stake)}
            {user?.balance !== null && user?.balance !== undefined ? ` · saldo ${formatCOP(user.balance)}` : ''}
          </p>
          {stakeError ? <p className="mt-1 text-xs text-red-300">{stakeError}</p> : null}
        </div>

        <div className="cut-s bg-gold/10 p-3">
          <div className="flex items-center justify-between gap-2 text-sm text-ink-muted">
            <span className="eyebrow">Pago posible</span>
            <span className="font-mono text-xl font-bold text-gold">{formatCOP(potentialPayout)}</span>
          </div>
        </div>

        {user ? (
          <Button
            type="button"
            className="w-full"
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
          <div role="alert" className="border-l-2 border-amber-400 bg-amber-400/10 px-3 py-2 text-sm text-amber-100">
            <p className="font-display font-bold uppercase tracking-[0.12em]">Las cuotas cambiaron</p>
            <p>
              {feedback.previousOdds ? <>Antes {formatOdds(feedback.previousOdds)}, </> : null}
              ahora <span className="font-mono font-bold text-amber-200">{formatOdds(feedback.currentOdds)}</span>.
              Pago posible {formatCOP(potentialPayout)}.
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <Button
                type="button"
                disabled={isSubmitting || Boolean(stakeError)}
                onClick={() => handleSubmit({ oddValue: feedback.currentOdds })}
              >
                {isSubmitting ? 'Registrando…' : 'Aceptar y apostar'}
              </Button>
              <button type="button" className="min-h-[44px] px-2 text-sm text-ink-muted underline hover:text-ink" onClick={() => { clear(); setFeedback(null); }}>
                Cancelar
              </button>
            </div>
          </div>
        ) : null}

        {feedback && feedback.type !== 'odds' ? (
          <div
            role={feedback.type === 'error' ? 'alert' : 'status'}
            className={`border-l-2 px-3 py-2 text-sm ${
              feedback.type === 'success'
                ? 'border-emerald-400 bg-emerald-500/10 text-emerald-200'
                : 'border-red-400 bg-red-500/10 text-red-200'
            }`}
          >
            {feedback.message}
          </div>
        ) : null}
      </div>
    </Panel>
  );
}

export default BetSlip;
