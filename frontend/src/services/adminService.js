import apiClient from './apiClient';

export async function getAdminMatches() {
  return apiClient.get('/api/admin/matches');
}

export async function finishMatch(matchCode, homeGoals, awayGoals) {
  return apiClient.post(`/api/admin/matches/${encodeURIComponent(matchCode)}/finish`, {
    home_goals: homeGoals,
    away_goals: awayGoals,
  });
}
