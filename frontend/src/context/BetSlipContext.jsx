import { createContext, useContext, useMemo, useState } from 'react';
import { placeBet } from '../services/betService';
import { useAuth } from './AuthContext';

const BetSlipContext = createContext(null);

export function BetSlipProvider({ children }) {
  const { user, getAvailableBalance, updateUser } = useAuth();
  const [selections, setSelections] = useState([]);
  const [stake, setStake] = useState(20000);

  const totalOdds = useMemo(
    () => selections.reduce((accumulator, selection) => accumulator * Number(selection.value || 1), 1),
    [selections],
  );

  const potentialPayout = useMemo(() => stake * totalOdds, [stake, totalOdds]);

  const addSelection = (selection) => {
    const isDuplicate = selections.some(
      (item) => item.matchId === selection.matchId && item.oddId === selection.oddId,
    );

    if (isDuplicate) {
      return;
    }

    setSelections((current) => [...current, selection]);
  };

  const removeSelection = (oddId) => {
    setSelections((current) => current.filter((selection) => selection.oddId !== oddId));
  };

  const clear = () => {
    setSelections([]);
    setStake(20000);
  };

  const submitBet = async () => {
    if (!user) {
      throw new Error('Debes iniciar sesión para realizar una apuesta');
    }

    if (selections.length === 0) {
      throw new Error('Debes seleccionar al menos un evento antes de apostar');
    }

    if (!Number.isFinite(Number(stake)) || Number(stake) <= 0) {
      throw new Error('El valor apostado debe ser mayor a cero');
    }

    if (Number(stake) > getAvailableBalance()) {
      throw new Error('Fondos insuficientes para realizar la apuesta');
    }

    const betPayload = {
      status: 'pending',
      stake: Number(stake),
      totalOdds: Number(totalOdds),
      potentialPayout: Number(potentialPayout),
      selections: selections.map((selection, index) => ({
        id: `bs${Date.now()}${index}`,
        betId: 'temp',
        matchId: selection.matchId,
        matchLabel: selection.matchLabel || null,
        oddId: selection.oddId,
        oddLabel: selection.label || null,
        oddValueAtBetTime: Number(selection.value),
        result: 'pending',
      })),
    };

    const result = await placeBet(betPayload);
    updateUser({ balance: result.balance });
    clear();
    return result.bets;
  };

  const value = useMemo(
    () => ({
      selections,
      totalOdds,
      stake,
      setStake,
      potentialPayout,
      addSelection,
      removeSelection,
      clear,
      submitBet,
    }),
    [selections, stake, totalOdds, potentialPayout, updateUser],
  );

  return <BetSlipContext.Provider value={value}>{children}</BetSlipContext.Provider>;
}

export function useBetSlip() {
  const context = useContext(BetSlipContext);

  if (!context) {
    throw new Error('useBetSlip debe usarse dentro de BetSlipProvider');
  }

  return context;
}
