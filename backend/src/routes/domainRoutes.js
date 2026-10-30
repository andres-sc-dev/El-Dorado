const express = require('express');
const { domainDefinitions } = require('../domain/domainDefinitions');
const {
  createController, userBalance, userBets, userBetById, placeBets,
} = require('../controllers/domainController');
const { authenticate } = require('../middlewares/authenticate');

const router = express.Router();

for (const name of Object.keys(domainDefinitions)) {
  if (name === 'bet') continue;
  const controller = createController(name);
  const aliases = {
    country: ['countries'],
    sport: ['sports'],
    stadium: ['stadiums'],
    company: ['companies'],
    game_rule: ['game-rules'],
    league: ['leagues'],
    team: ['teams'],
    matchday: ['matchdays'],
    customer: ['customers'],
    login_history: ['login-history'],
    player: ['players'],
    team_stats: ['team-stats'],
    match: ['matches'],
    player_stats: ['player-stats'],
    balance_movement: ['balance-movements'],
    bet: ['bets'],
  }[name] || [];
  const routes = [`/${name}`, ...aliases.map((alias) => `/${alias}`)];
  // Data-entry endpoints remain open during this testing phase. Authentication
  // can be added later without changing the route/controller contract.
  const getMiddleware = name === 'users' ? [authenticate] : [];
  if (name === 'users') {
    router.get('/users/:id/balance', authenticate, userBalance);
  }
  routes.forEach((route) => {
    router.get(route, ...getMiddleware, controller.list);
    router.get(`${route}/:id`, ...getMiddleware, controller.getById);
    if (!domainDefinitions[name].readOnly) {
      router.post(route, controller.create);
    } else {
      router.post(route, (request, response) => {
        response.status(405).json({ error: 'Este recurso es de solo lectura' });
      });
    }
  });
}

// A bet is always owned by the authenticated customer. The generic data-entry
// route is intentionally not used because it could let a client choose another
// customer or skip the balance transaction.
router.get('/bets', authenticate, userBets);
router.post('/bets', authenticate, placeBets);
router.get('/bet', authenticate, userBets);
router.get('/bet/:id', authenticate, userBetById);
router.post('/bet', authenticate, (request, response) => {
  response.status(405).json({ error: 'Usa POST /api/bets para registrar una apuesta' });
});

module.exports = router;
