const { withDb } = require('../../config/mongo');

// Mercados, resultados y reglas de juego en MongoDB.

async function listMarkets() {
  return withDb(async (db) => {
    const [markets, outcomes] = await Promise.all([
      db.collection('odds_market').find({ is_active: true }, { projection: { _id: 0 } })
        .sort({ sport: 1, market_code: 1 }).toArray(),
      db.collection('odds_outcome').find({}, { projection: { _id: 0 } })
        .sort({ market_code: 1, sort_order: 1 }).toArray(),
    ]);
    // Se combinan en JavaScript por la clave natural (sport, market_code).
    return markets.map((market) => ({
      ...market,
      outcomes: outcomes
        .filter((outcome) => outcome.sport === market.sport && outcome.market_code === market.market_code)
        .map(({ sport, market_code: marketCode, ...rest }) => rest),
    }));
  });
}

async function listOutcomes() {
  return withDb((db) => db.collection('odds_outcome')
    .find({}, { projection: { _id: 0 } })
    .sort({ market_code: 1, sort_order: 1 })
    .toArray());
}

async function listGameRules() {
  return withDb((db) => db.collection('game_rule')
    .find({}, { projection: { _id: 0 } })
    .sort({ sport: 1, rule_code: 1 })
    .toArray());
}

module.exports = { listMarkets, listOutcomes, listGameRules };
