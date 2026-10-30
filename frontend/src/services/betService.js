import apiClient from './apiClient';

export async function getUserBets(userId) {
  // The API derives the customer from the authenticated session. Keep the
  // argument for the service contract used by the pages, but never send it as
  // a client-controlled owner.
  void userId;
  return apiClient.get('/api/bets');
}

export async function placeBet(bet) {
  const response = await apiClient.post('/api/bets', {
    stake: Number(bet.stake),
    selections: bet.selections.map((selection) => ({
      matchId: Number(selection.matchId),
      oddId: Number(selection.oddId),
    })),
  });
  return response;
}
