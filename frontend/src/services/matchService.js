import apiClient from './apiClient';

export async function getMatches() {
  return apiClient.get('/api/match');
}

function buildMatchDetails(matches, teams, odds, leagues, catalogs) {
  const teamById = Object.fromEntries(teams.map((team) => [team.id, team]));
  const leagueById = Object.fromEntries(leagues.map((league) => [league.id, league]));
  const marketById = Object.fromEntries((catalogs.odds_market || []).map((item) => [item.id, item.name]));
  const outcomeById = Object.fromEntries((catalogs.odds_outcome || []).map((item) => [item.id, item.name]));

  return matches.map((match) => {
    const status = (catalogs.match_status || []).find((item) => String(item.id) === String(match.status))?.name?.toLowerCase()
      || String(match.status).toLowerCase();
    const isBettingOpen = status === 'scheduled' || status === 'live';

    return {
    ...match,
    leagueId: match.league_id,
    startTime: match.match_date,
    status,
    isBettingOpen,
    homeScore: match.home_goals,
    awayScore: match.away_goals,
    leagueName: leagueById[match.league_id]?.name || match.league_id,
    homeTeam: teamById[match.home_team_id] ? {
      ...teamById[match.home_team_id],
      shortName: teamById[match.home_team_id].shortName || teamById[match.home_team_id].name,
      logoUrl: teamById[match.home_team_id].crest_url || teamById[match.home_team_id].logoUrl,
    } : null,
    awayTeam: teamById[match.away_team_id] ? {
      ...teamById[match.away_team_id],
      shortName: teamById[match.away_team_id].shortName || teamById[match.away_team_id].name,
      logoUrl: teamById[match.away_team_id].crest_url || teamById[match.away_team_id].logoUrl,
    } : null,
    odds: isBettingOpen ? odds.filter((odd) => String(odd.match_id) === String(match.id)).map((odd) => ({
      ...odd,
      id: odd.id,
      matchId: odd.match_id,
      market: marketById[odd.market] || odd.market,
      label: outcomeById[odd.outcome] || odd.outcome,
      value: Number(odd.odd_value),
    })) : [],
    };
  });
}

function hasBettingData(match) {
  return Boolean(
    match.homeTeam
    && match.awayTeam
    && match.startTime
    && Array.isArray(match.odds)
    && match.odds.length > 0
    && match.odds.every((odd) => odd.id !== undefined && Number.isFinite(odd.value) && odd.value > 1),
  );
}

export async function getMatchDetails() {
  const [matches, teams, odds, leagues, catalogs] = await Promise.all([
    apiClient.get('/api/match'),
    apiClient.get('/api/team'),
    apiClient.get('/api/odds'),
    apiClient.get('/api/league'),
    apiClient.get('/api/catalogs'),
  ]);
  return buildMatchDetails(matches, teams, odds, leagues, catalogs)
    .filter(hasBettingData);
}
