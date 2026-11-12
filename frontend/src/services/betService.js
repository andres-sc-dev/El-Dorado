import apiClient from './apiClient';

export async function getMyBets() {
  return apiClient.get('/api/bets/me');
}

// Apuesta simple. La API toma el usuario de la sesión y la cuota de MySQL;
// expected_odds solo sirve para avisar si la cuota cambió (409 ODDS_CHANGED).
// La misma idempotencyKey en un reintento o doble clic devuelve la misma apuesta.
export async function placeBet({ selection, stake, idempotencyKey }) {
  return apiClient.post('/api/bets', {
    match_code: selection.matchCode,
    market_code: selection.marketCode,
    selection: selection.outcomeCode,
    line: selection.line,
    stake: Number(stake),
    expected_odds: selection.oddValue,
  }, { 'Idempotency-Key': idempotencyKey });
}
