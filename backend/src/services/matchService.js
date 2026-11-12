const matchRepository = require('../repositories/mysql/matchRepository');
const teamRepository = require('../repositories/postgres/teamRepository');
const marketRepository = require('../repositories/mongo/marketRepository');
const { getBetLimits } = require('../config/betLimits');

// Vista combinada de partidos: MySQL (partido, estado, cuotas) + PostgreSQL (nombres de equipos)
// + MongoDB (nombres de mercados y resultados). Se une en JavaScript por claves naturales:
// team_code, market_code y outcome_code. Si PostgreSQL o MongoDB están caídos, se muestran
// los códigos en lugar de los nombres; solo MySQL es obligatorio.

const SPORT = 'FUT';
const SEASON_HALF = { 1: 'I', 2: 'II' };

// Nombres de equipos por team_code. null si PostgreSQL no responde.
async function loadTeams(teamCodes) {
  try {
    const rows = await teamRepository.findByCodes([...new Set(teamCodes)]);
    return new Map(rows.map((team) => [team.team_code, team]));
  } catch {
    return null;
  }
}

// Mercados de MongoDB por market_code, con sus resultados por outcome_code. Vacío si Mongo no responde.
async function loadMarkets() {
  try {
    const markets = await marketRepository.listMarkets();
    return new Map(markets.map((market) => [market.market_code, {
      ...market,
      outcomeByCode: new Map(market.outcomes.map((outcome) => [outcome.outcome_code, outcome])),
    }]));
  } catch {
    return new Map();
  }
}

function toTeam(code, teams) {
  const team = teams?.get(code);
  return {
    team_code: code,
    name: team?.name ?? code,
    short_name: team?.short_name ?? code,
    crest_url: team?.crest_url ?? null,
  };
}

function isBettingOpen(row, now = new Date()) {
  return row.status === 'SCHEDULED' && new Date(row.match_date) > now;
}

function toMatch(row, teams) {
  const finished = row.status === 'FINISHED';
  return {
    match_code: row.match_code,
    league: {
      code: row.league_code,
      name: row.league_name,
      season: `${row.season_year}-${SEASON_HALF[row.season_half] ?? row.season_half}`,
    },
    matchday: row.matchday,
    stadium: { name: row.stadium_name, city: row.stadium_city },
    match_date: new Date(row.match_date).toISOString(),
    status: row.status,
    status_name: row.status_name,
    is_betting_open: isBettingOpen(row),
    home_team: toTeam(row.home_team_code, teams),
    away_team: toTeam(row.away_team_code, teams),
    score: finished ? { home: row.home_goals, away: row.away_goals } : null,
  };
}

function marketLabel(market, marketCode, line) {
  const name = market?.name ?? marketCode;
  if (market?.selection_type !== 'LINE') return name;
  const value = Number(line);
  return market.line?.applies_to === 'HOME'
    ? `${name} (local ${value > 0 ? '+' : ''}${value})`
    : `${name} ${value}`;
}

// Agrupa las cuotas de un partido por mercado y línea: "Total de goles 2.5" -> Más de / Menos de.
function groupOdds(oddsRows, markets) {
  const groups = new Map();
  for (const odd of oddsRows) {
    const line = Number(odd.line);
    const key = `${odd.market_code}|${line}`;
    const market = markets.get(odd.market_code);
    if (!groups.has(key)) {
      groups.set(key, {
        market_code: odd.market_code,
        line,
        name: marketLabel(market, odd.market_code, line),
        selection_type: market?.selection_type ?? null,
        outcomes: [],
      });
    }
    const outcome = market?.outcomeByCode.get(odd.outcome_code);
    groups.get(key).outcomes.push({
      outcome_code: odd.outcome_code,
      name: outcome?.name ?? odd.outcome_code,
      sort_order: outcome?.sort_order ?? 99,
      line,
      odd_value: Number(odd.odd_value),
    });
  }
  const marketOrder = ['1X2', 'BTTS', 'TOTAL_GOALS', 'HANDICAP', 'EXACT_SCORE'];
  return [...groups.values()]
    .map((group) => ({
      ...group,
      outcomes: group.outcomes.sort((a, b) => a.sort_order - b.sort_order).map(({ sort_order: _, ...rest }) => rest),
    }))
    .sort((a, b) => {
      const byMarket = (marketOrder.indexOf(a.market_code) + 1 || 99) - (marketOrder.indexOf(b.market_code) + 1 || 99);
      return byMarket || a.line - b.line;
    });
}

// GET /api/matches
async function listMatches() {
  const rows = await matchRepository.listMatches();
  const [teams, markets, odds] = await Promise.all([
    loadTeams(rows.flatMap((row) => [row.home_team_code, row.away_team_code])),
    loadMarkets(),
    matchRepository.listActiveOdds(rows.filter((row) => isBettingOpen(row)).map((row) => row.id)),
  ]);

  const oddsByMatch = new Map();
  for (const odd of odds) {
    if (!oddsByMatch.has(odd.match_id)) oddsByMatch.set(odd.match_id, []);
    oddsByMatch.get(odd.match_id).push(odd);
  }

  const { min, max, currency } = getBetLimits();
  return {
    matches: rows.map((row) => ({
      ...toMatch(row, teams),
      markets: isBettingOpen(row) ? groupOdds(oddsByMatch.get(row.id) || [], markets) : [],
    })),
    limits: { min_stake: min, max_stake: max, currency },
    // Avisa al frontend si los nombres llegan como códigos porque un motor está caído.
    degraded: [...(teams ? [] : ['postgres']), ...(markets.size ? [] : ['mongo'])],
  };
}

// Partidos por código, con nombres de equipos (lo usan "Mis apuestas" y el panel admin).
async function describeMatches(matchCodes) {
  const rows = await matchRepository.findByCodes([...new Set(matchCodes)]);
  const teams = await loadTeams(rows.flatMap((row) => [row.home_team_code, row.away_team_code]));
  return new Map(rows.map((row) => [row.match_code, toMatch(row, teams)]));
}

async function listAllWithTeams() {
  const rows = await matchRepository.listMatches();
  const teams = await loadTeams(rows.flatMap((row) => [row.home_team_code, row.away_team_code]));
  return rows.map((row) => toMatch(row, teams));
}

module.exports = {
  SPORT, listMatches, describeMatches, listAllWithTeams, loadMarkets, isBettingOpen, marketLabel,
};
