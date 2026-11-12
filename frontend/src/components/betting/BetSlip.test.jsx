// Pruebas del cupón: persistencia en sessionStorage, barra móvil y 409 ODDS_CHANGED.
//   npm test
import { MemoryRouter } from 'react-router-dom';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import BetSlip from './BetSlip';
import MobileBetSlipBar from './MobileBetSlipBar';
import { BetSlipProvider } from '../../context/BetSlipContext';
import { ApiError } from '../../services/apiClient';
import * as bets from '../../services/betService';

vi.mock('../../services/betService', () => ({ placeBet: vi.fn() }));

const setBalance = vi.fn();
vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ user: { username: 'demo', role: 'USR', balance: 500000 }, isAdmin: false, setBalance }),
}));

const selection = {
  matchCode: 'M-1', matchLabel: 'Fecha 1', marketCode: '1X2', marketName: 'Resultado',
  outcomeCode: 'HOME', outcomeName: 'Local', line: null, oddValue: 2.1,
};

function renderSlip(path = '/matches') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <BetSlipProvider>
        <BetSlip />
        <MobileBetSlipBar />
      </BetSlipProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  sessionStorage.clear();
  vi.mocked(bets.placeBet).mockReset();
});
afterEach(cleanup);

describe('cupón', () => {
  it('recupera la selección guardada en sessionStorage al recargar', () => {
    sessionStorage.setItem('eldorado.betslip', JSON.stringify({ selection, stake: 20000 }));
    renderSlip();
    expect(screen.getByText(/Local/, { selector: 'p' })).toBeTruthy();
    expect(screen.getByLabelText(/Monto a apostar/).value).toBe('20000');
  });

  it('descarta una selección guardada inválida', () => {
    sessionStorage.setItem('eldorado.betslip', JSON.stringify({ selection: { matchCode: 1 }, stake: 'x' }));
    renderSlip();
    expect(screen.getByText(/Elige una cuota para armar tu apuesta/)).toBeTruthy();
  });

  it('la barra móvil muestra selecciones y cuota y abre la hoja', () => {
    sessionStorage.setItem('eldorado.betslip', JSON.stringify({ selection, stake: 10000 }));
    renderSlip();
    expect(screen.getByText('1 selección')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { expanded: false }));
    expect(screen.getByRole('dialog', { name: 'Cupón de apuesta' })).toBeTruthy();
  });

  it('409 ODDS_CHANGED: resalta la cuota nueva y "Aceptar y apostar" envía la nueva cuota', async () => {
    sessionStorage.setItem('eldorado.betslip', JSON.stringify({ selection, stake: 10000 }));
    vi.mocked(bets.placeBet)
      .mockRejectedValueOnce(new ApiError('La cuota cambió', 409, { code: 'ODDS_CHANGED', current_odds: 1.85 }))
      .mockResolvedValueOnce({ balance: 490000, bet: { ticket_code: 'abcdef1234', potential_payout: 18500 } });
    renderSlip();

    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Realizar apuesta' })); });
    expect(screen.getByText('Las cuotas cambiaron')).toBeTruthy();
    const odds = screen.getByTestId('slip-odds');
    expect(odds.textContent).toContain('1.85');
    expect(odds.className).toContain('ring');

    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Aceptar y apostar' })); });
    expect(bets.placeBet).toHaveBeenCalledTimes(2);
    expect(bets.placeBet.mock.calls[1][0].selection.oddValue).toBe(1.85);
    expect(screen.getByText(/Apuesta registrada/)).toBeTruthy();
    expect(sessionStorage.getItem('eldorado.betslip')).toBeNull();
  });
});
