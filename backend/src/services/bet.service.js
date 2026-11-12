const userRepository = require('../repositories/sqlserver/userRepository');
const matchRepository = require('../repositories/mysql/matchRepository');
const marketRepository = require('../repositories/mongo/marketRepository');
const betRepository = require('../repositories/postgres/betRepository');
const matchService = require('./matchService');
const auditService = require('./auditService');
const { getBetLimits } = require('../config/betLimits');
const {
  badRequest, forbidden, notFound, conflict,
} = require('../utils/httpError');

// Apuesta simple. Cada motor valida lo suyo, en este orden:
//   1. Entrada (400)            2. SQL Server: usuario activo
//   3. MySQL: partido y cuota   4. MongoDB: mercado y selección
//   5. PostgreSQL: fn_crear_apuesta (saldo, bloqueo e idempotencia)
//   6. Auditoría en MongoDB, sin bloquear si falla.
// El usuario sale del JWT y la cuota de MySQL; del cliente solo se acepta qué quiere apostar.

const ACTIVE_USER_STATUS = 1;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MATCH_CODE_PATTERN = /^[A-Z]{2}[0-9]{6}$/;
const MARKET_CODE_PATTERN = /^[A-Z0-9_]{2,20}$/;
const OUTCOME_CODE_PATTERN = /^[A-Z0-9_-]{1,10}$/;
const MONEY_PATTERN = /^\d+(\.\d{1,2})?$/;

const invalid = (message, errorCode = 'VALIDATION_ERROR') => badRequest(message, { errorCode });

// El monto debe llegar como número JSON: sin textos, NaN, negativos ni más de 2 decimales.
function parseStake(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw invalid('El monto debe ser un número.', 'INVALID_STAKE');
  }
  if (value <= 0) throw invalid('El monto debe ser mayor que cero.', 'INVALID_STAKE');
  const { min, max } = getBetLimits();
  if (value < min || value > max) {
    throw invalid(
      `El monto debe estar entre ${min.toLocaleString('es-CO')} y ${max.toLocaleString('es-CO')} COP.`,
      'STAKE_OUT_OF_RANGE',
    );
  }
  if (!MONEY_PATTERN.test(String(value))) {
    throw invalid('El monto puede tener máximo 2 decimales.', 'INVALID_STAKE');
  }
  return value;
}

function parseLine(value) {
  if (value === undefined || value === null) return 0;
  // Las líneas van de media en media (2.5, -1.0, -1.5).
  if (typeof value !== 'number' || !Number.isFinite(value) || Math.abs(value) > 20 || (value * 2) % 1 !== 0) {
    throw invalid('La línea no es válida.', 'INVALID_SELECTION');
  }
  return value;
}

function parseInput(body, idempotencyKey) {
  if (typeof idempotencyKey !== 'string' || !UUID_PATTERN.test(idempotencyKey)) {
    throw invalid('Falta el header Idempotency-Key o no es un UUID.', 'IDEMPOTENCY_KEY_REQUIRED');
  }
  const matchCode = body.match_code;
  const marketCode = body.market_code;
  const outcomeCode = body.selection ?? body.outcome_code;
  if (typeof matchCode !== 'string' || !MATCH_CODE_PATTERN.test(matchCode)) {
    throw invalid('El código de partido no es válido.', 'INVALID_MATCH');
  }
  if (typeof marketCode !== 'string' || !MARKET_CODE_PATTERN.test(marketCode)) {
    throw invalid('El código de mercado no es válido.', 'INVALID_SELECTION');
  }
  if (typeof outcomeCode !== 'string' || !OUTCOME_CODE_PATTERN.test(outcomeCode)) {
    throw invalid('La selección no es válida.', 'INVALID_SELECTION');
  }
  // Solo apuestas simples: una apuesta combinada (varias selecciones) se rechaza.
  if (Array.isArray(body.selections)) {
    throw invalid('Solo se permiten apuestas simples (una selección).', 'SIMPLE_BETS_ONLY');
  }
  let expectedOdds = null;
  if (body.expected_odds !== undefined && body.expected_odds !== null) {
    if (typeof body.expected_odds !== 'number' || !Number.isFinite(body.expected_odds) || body.expected_odds <= 1) {
      throw invalid('La cuota esperada no es válida.', 'INVALID_ODDS');
    }
    expectedOdds = body.expected_odds;
  }
  return {
    idempotencyKey: idempotencyKey.toLowerCase(),
    matchCode,
    marketCode,
    outcomeCode,
    line: parseLine(body.line),
    stake: parseStake(body.stake),
    expectedOdds,
  };
}

async function assertActiveUser(user) {
  const row = await userRepository.findById(user.userId);
  if (!row || row.username !== user.username) throw forbidden('Usuario no encontrado.', { errorCode: 'USER_INACTIVE' });
  if (row.status !== ACTIVE_USER_STATUS) {
    throw forbidden('Tu usuario está inactivo o bloqueado.', { errorCode: 'USER_INACTIVE' });
  }
}

async function loadPlayableMatch(matchCode) {
  const match = await matchRepository.findByCode(matchCode);
  if (!match) throw notFound('El partido no existe.', { errorCode: 'MATCH_NOT_FOUND' });
  if (match.status !== 'SCHEDULED') {
    throw conflict('El partido ya no acepta apuestas.', { errorCode: 'MATCH_NOT_OPEN', details: { match_status: match.status } });
  }
  if (new Date(match.match_date) <= new Date()) {
    throw conflict('El partido ya comenzó.', { errorCode: 'MATCH_STARTED' });
  }
  return match;
}

async function assertValidSelection(marketCode, outcomeCode, line) {
  const market = await marketRepository.findMarket(matchService.SPORT, marketCode);
  if (!market) throw notFound('El mercado no existe.', { errorCode: 'MARKET_NOT_FOUND' });
  if (!market.outcomes.some((outcome) => outcome.outcome_code === outcomeCode)) {
    throw badRequest('La selección no existe en este mercado.', { errorCode: 'INVALID_SELECTION' });
  }
  const allowedLines = market.selection_type === 'LINE' ? market.line.allowed.map(Number) : [0];
  if (!allowedLines.includes(line)) {
    throw badRequest('La línea no es válida para este mercado.', { errorCode: 'INVALID_SELECTION' });
  }
  return market;
}

function toTicket(ticket) {
  return {
    ticket_code: ticket.ticket_code,
    match_code: ticket.match_code,
    market_code: ticket.market_code,
    selection: ticket.outcome_code,
    line: Number(ticket.line),
    stake: Number(ticket.stake),
    odds: Number(ticket.odds),
    potential_payout: Number(ticket.potential_payout),
    status: ticket.status,
    placed_at: ticket.placed_at,
  };
}

// POST /api/bets
async function placeBet(user, body, idempotencyKey, ip) {
  const input = parseInput(body || {}, idempotencyKey);

  await assertActiveUser(user);
  const match = await loadPlayableMatch(input.matchCode);
  const oddValue = await matchRepository.findActiveOdd(match.id, input.marketCode, input.outcomeCode, input.line);
  await assertValidSelection(input.marketCode, input.outcomeCode, input.line);
  if (oddValue === null) {
    throw conflict('Esta selección no tiene una cuota vigente.', { errorCode: 'ODDS_UNAVAILABLE' });
  }

  const currentOdds = Number(oddValue);
  if (input.expectedOdds !== null && Math.abs(input.expectedOdds - currentOdds) >= 0.005) {
    throw conflict(`La cuota cambió de ${input.expectedOdds.toFixed(2)} a ${currentOdds.toFixed(2)}.`, {
      errorCode: 'ODDS_CHANGED',
      details: { current_odds: currentOdds, expected_odds: input.expectedOdds },
    });
  }

  const ticket = await betRepository.createBet({
    username: user.username,
    matchCode: input.matchCode,
    marketCode: input.marketCode,
    outcomeCode: input.outcomeCode,
    line: String(input.line),
    stake: String(input.stake),
    odds: String(oddValue),
    idempotencyKey: input.idempotencyKey,
  });

  if (ticket.created) {
    // Sin await: si MongoDB falla, la apuesta ya está hecha.
    auditService.log('BET_PLACED', user.username, {
      ticket_code: ticket.ticket_code,
      match_code: input.matchCode,
      market_code: input.marketCode,
      selection: input.outcomeCode,
      line: input.line,
      stake: input.stake,
      odds: currentOdds,
    }, ip);
  }

  return { created: ticket.created, bet: toTicket(ticket), balance: Number(ticket.balance) };
}

function payoutFor(row) {
  if (row.status === 'WON') return Number(row.potential_payout);
  if (row.status === 'REFUNDED' || row.status === 'CANCELLED') return Number(row.stake);
  return 0;
}

// GET /api/bets/me: apuestas de PostgreSQL + partido de MySQL + nombres de MongoDB.
async function listMyBets(username) {
  const rows = await betRepository.listByUsername(username);
  const [matches, markets] = await Promise.all([
    matchService.describeMatches(rows.map((row) => row.match_code)),
    matchService.loadMarkets(),
  ]);
  return rows.map((row) => {
    const market = markets.get(row.market_code);
    const line = Number(row.line);
    return {
      ticket_code: row.ticket_code,
      status: row.status,
      status_name: row.status_name,
      stake: Number(row.stake),
      odds: Number(row.total_odds),
      potential_payout: Number(row.potential_payout),
      payout: payoutFor(row),
      placed_at: row.placed_at,
      settled_at: row.settled_at,
      selection: {
        match_code: row.match_code,
        market_code: row.market_code,
        market_name: matchService.marketLabel(market, row.market_code, line),
        outcome_code: row.outcome_code,
        outcome_name: market?.outcomeByCode.get(row.outcome_code)?.name ?? row.outcome_code,
        line,
      },
      match: matches.get(row.match_code) ?? null,
    };
  });
}

module.exports = { placeBet, listMyBets, parseStake };
