import apiClient from './apiClient';

// GET /api/matches: la API ya combina MySQL (partidos y cuotas), PostgreSQL (equipos)
// y MongoDB (mercados). Todo se identifica por match_code, team_code y market_code.
export async function getMatches() {
  return apiClient.get('/api/matches');
}

// Histórico real (API-Football): partidos finalizados, del más reciente al más antiguo.
export async function getMatchHistory({ team = '', limit = 20, offset = 0 } = {}) {
  const params = new URLSearchParams({ view: 'history', limit: String(limit), offset: String(offset) });
  if (team) params.set('team', team);
  return apiClient.get(`/api/matches?${params}`);
}
