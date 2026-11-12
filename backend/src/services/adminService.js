const matchRepository = require('../repositories/mysql/matchRepository');
const betRepository = require('../repositories/postgres/betRepository');
const marketRepository = require('../repositories/mongo/marketRepository');
const matchService = require('./matchService');
const settlementService = require('./settlementService');
const auditService = require('./auditService');
const { badRequest, notFound, conflict } = require('../utils/httpError');

const MATCH_CODE_PATTERN = /^[A-Z]{2}[0-9]{6}$/;

function parseGoals(value, label) {
  if (!Number.isInteger(value) || value < 0 || value > 30) {
    throw badRequest(`${label} debe ser un entero entre 0 y 30.`, { errorCode: 'INVALID_SCORE' });
  }
  return value;
}

// GET /api/admin/matches: todos los partidos con sus apuestas abiertas (PostgreSQL).
async function listMatches() {
  const [matches, openCounts] = await Promise.all([
    matchService.listAllWithTeams(),
    betRepository.countOpenByMatch(),
  ]);
  const openByMatch = new Map(openCounts.map((row) => [row.match_code, row]));
  return matches.map((match) => ({
    ...match,
    open_bets: openByMatch.get(match.match_code)?.open_bets ?? 0,
    open_stake: Number(openByMatch.get(match.match_code)?.open_stake ?? 0),
    can_finish: match.status === 'SCHEDULED' || match.status === 'LIVE',
  }));
}

// POST /api/admin/matches/:matchCode/finish
// 1. MySQL: marca FINISHED de forma atómica (solo si estaba programado o en juego).
// 2. Calcula en JavaScript el resultado de cada selección apostada.
// 3. PostgreSQL: fn_liquidar_partido paga todo en una sola transacción.
// Si el paso 3 falla, se compensa el paso 1: el partido vuelve a su estado anterior
// y el administrador puede intentarlo de nuevo. No hay transacciones entre motores.
async function finishMatch(admin, matchCode, body, ip) {
  if (typeof matchCode !== 'string' || !MATCH_CODE_PATTERN.test(matchCode)) {
    throw badRequest('El código de partido no es válido.', { errorCode: 'INVALID_MATCH' });
  }
  const score = {
    homeGoals: parseGoals(body?.home_goals, 'Los goles del local'),
    awayGoals: parseGoals(body?.away_goals, 'Los goles del visitante'),
  };

  const match = await matchRepository.findByCode(matchCode);
  if (!match) throw notFound('El partido no existe.', { errorCode: 'MATCH_NOT_FOUND' });
  if (match.status === 'FINISHED') throw conflict('El partido ya fue finalizado.', { errorCode: 'MATCH_ALREADY_FINISHED' });
  if (match.status !== 'SCHEDULED' && match.status !== 'LIVE') {
    throw conflict('Solo se puede finalizar un partido programado o en juego.', { errorCode: 'MATCH_NOT_OPEN' });
  }

  // Los marcadores exactos listados en MongoDB (OTHER gana con cualquier otro).
  const exactScore = await marketRepository.findMarket(matchService.SPORT, 'EXACT_SCORE');
  const listedScores = (exactScore?.outcomes || [])
    .filter((outcome) => outcome.outcome_code !== 'OTHER')
    .map((outcome) => outcome.outcome_code);

  const claimed = await matchRepository.finishMatch(matchCode, score.homeGoals, score.awayGoals);
  if (!claimed) throw conflict('El partido ya fue finalizado.', { errorCode: 'MATCH_ALREADY_FINISHED' });

  let summary;
  try {
    const selections = await betRepository.listOpenSelections(matchCode);
    const resultado = settlementService.buildResultado(selections, score, listedScores);
    summary = await betRepository.settleMatch(matchCode, resultado);
  } catch (error) {
    await matchRepository.revertFinish(matchCode, match.status).catch(() => {
      console.error(`Liquidación: no se pudo revertir el partido ${matchCode} en MySQL`);
    });
    throw error;
  }

  const result = {
    match_code: matchCode,
    score: { home: score.homeGoals, away: score.awayGoals },
    settled: summary.settled,
    won: summary.won,
    lost: summary.lost,
    refunded: summary.refunded,
    total_paid: Number(summary.total_paid),
  };
  auditService.log('MATCH_FINISHED', admin.username, result, ip);
  return result;
}

module.exports = { listMatches, finishMatch };
