import apiClient from './apiClient';

// GET /api/matches: la API ya combina MySQL (partidos y cuotas), PostgreSQL (equipos)
// y MongoDB (mercados). Todo se identifica por match_code, team_code y market_code.
export async function getMatches() {
  return apiClient.get('/api/matches');
}
