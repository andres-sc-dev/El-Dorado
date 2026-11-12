const betService = require('../services/bet.service');
const matchService = require('../services/matchService');
const { getClientIp } = require('../utils/request');

// POST /api/bets. 201 si se creó; 200 si la Idempotency-Key ya tenía una apuesta (doble clic).
async function placeBet(request, response, next) {
  try {
    const result = await betService.placeBet(
      request.user,
      request.body,
      request.get('Idempotency-Key'),
      getClientIp(request),
    );
    response.status(result.created ? 201 : 200).json({ bet: result.bet, balance: result.balance, replayed: !result.created });
  } catch (error) {
    next(error);
  }
}

async function listMyBets(request, response, next) {
  try {
    response.json(await betService.listMyBets(request.user.username));
  } catch (error) {
    next(error);
  }
}

// GET /api/matches: vista combinada con equipos, cuotas y estado.
async function listMatches(request, response, next) {
  try {
    response.json(await matchService.listMatches());
  } catch (error) {
    next(error);
  }
}

module.exports = { placeBet, listMyBets, listMatches };
