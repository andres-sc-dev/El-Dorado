import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { placeBet } from '../services/betService';
import { useAuth } from './AuthContext';
import { DEFAULT_STAKE, slipStore } from '../utils/slipStore';

const BetSlipContext = createContext(null);

function newKey() {
  return crypto.randomUUID();
}

// Cupón de apuesta SIMPLE: una sola selección. Elegir otra cuota reemplaza la anterior.
// selection = { matchCode, matchLabel, homeTeam, awayTeam, marketCode, marketName, outcomeCode, outcomeName, line, oddValue }
export function BetSlipProvider({ children }) {
  const { user, setBalance } = useAuth();
  const [initial] = useState(() => slipStore.read());
  const [selection, setSelection] = useState(initial?.selection ?? null);
  const [stake, setStakeState] = useState(initial?.stake ?? DEFAULT_STAKE);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isOpen, setIsOpen] = useState(false); // hoja deslizable en móvil
  // Límites de monto que entrega GET /api/matches; los usa el cupón esté donde esté.
  const [limits, setLimits] = useState(null);
  // Idempotency-Key: se mantiene mientras la apuesta no cambie. Un doble clic o un
  // reintento envían la misma clave y la API devuelve la misma apuesta, sin cobrar dos veces.
  const keyRef = useRef(newKey());

  const resetKey = () => { keyRef.current = newKey(); };

  useEffect(() => {
    if (selection) slipStore.write({ selection, stake });
    else slipStore.clear();
  }, [selection, stake]);

  const select = useCallback((next) => {
    setSelection(next);
    resetKey();
  }, []);

  const setStake = useCallback((value) => {
    setStakeState(value);
    resetKey();
  }, []);

  const clear = useCallback(() => {
    setSelection(null);
    resetKey();
  }, []);

  // Acepta la cuota nueva que devolvió la API (409 ODDS_CHANGED).
  const acceptOdds = useCallback((oddValue) => {
    setSelection((current) => (current ? { ...current, oddValue: Number(oddValue) } : current));
    resetKey();
  }, []);

  // overrides permite "Aceptar y apostar": se envía ya con la cuota nueva, sin esperar a que React
  // actualice el estado.
  const submitBet = useCallback(async (overrides = {}) => {
    if (!user) throw new Error('Debes iniciar sesión para apostar.');
    if (!selection) throw new Error('Elige una cuota antes de apostar.');
    const finalSelection = { ...selection, ...overrides };
    setIsSubmitting(true);
    try {
      const result = await placeBet({ selection: finalSelection, stake: Number(stake), idempotencyKey: keyRef.current });
      setBalance(result.balance);
      setSelection(null);
      resetKey();
      return result;
    } finally {
      setIsSubmitting(false);
    }
  }, [user, selection, stake, setBalance]);

  const potentialPayout = selection ? Math.round(Number(stake || 0) * selection.oddValue * 100) / 100 : 0;

  const value = useMemo(() => ({
    selection, stake, setStake, potentialPayout, isSubmitting, select, clear, acceptOdds, submitBet,
    limits, setLimits, isOpen, setIsOpen,
  }), [selection, stake, setStake, potentialPayout, isSubmitting, select, clear, acceptOdds, submitBet, limits, isOpen]);

  return <BetSlipContext.Provider value={value}>{children}</BetSlipContext.Provider>;
}

export function useBetSlip() {
  const context = useContext(BetSlipContext);
  if (!context) throw new Error('useBetSlip debe usarse dentro de BetSlipProvider');
  return context;
}
