import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { placeBet } from '../services/betService';
import { useAuth } from './AuthContext';

const BetSlipContext = createContext(null);

function newKey() {
  return crypto.randomUUID();
}

// Cupón de apuesta SIMPLE: una sola selección. Elegir otra cuota reemplaza la anterior.
// selection = { matchCode, matchLabel, marketCode, marketName, outcomeCode, outcomeName, line, oddValue }
export function BetSlipProvider({ children }) {
  const { user, setBalance } = useAuth();
  const [selection, setSelection] = useState(null);
  const [stake, setStakeState] = useState(10000);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Idempotency-Key: se mantiene mientras la apuesta no cambie. Un doble clic o un
  // reintento envían la misma clave y la API devuelve la misma apuesta, sin cobrar dos veces.
  const keyRef = useRef(newKey());

  const resetKey = () => { keyRef.current = newKey(); };

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
    setSelection((current) => (current ? { ...current, oddValue } : current));
    resetKey();
  }, []);

  const submitBet = useCallback(async () => {
    if (!user) throw new Error('Debes iniciar sesión para apostar.');
    if (!selection) throw new Error('Elige una cuota antes de apostar.');
    setIsSubmitting(true);
    try {
      const result = await placeBet({ selection, stake: Number(stake), idempotencyKey: keyRef.current });
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
  }), [selection, stake, setStake, potentialPayout, isSubmitting, select, clear, acceptOdds, submitBet]);

  return <BetSlipContext.Provider value={value}>{children}</BetSlipContext.Provider>;
}

export function useBetSlip() {
  const context = useContext(BetSlipContext);
  if (!context) throw new Error('useBetSlip debe usarse dentro de BetSlipProvider');
  return context;
}
