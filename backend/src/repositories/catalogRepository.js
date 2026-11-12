const { withPool } = require('../config/sqlserver');
const mysql = require('../config/mysql');
const postgres = require('../config/postgres');
const marketRepository = require('./mongo/marketRepository');

// Catálogos repartidos por motor. Cada uno devuelve filas { id, code, name }.
const catalogs = {
  user_status: {
    engine: 'sqlserver',
    load: () => withPool(async (pool) => (await pool.request()
      .query('SELECT id_status_user AS id, name FROM dbo.user_status ORDER BY id_status_user')).recordset),
  },
  role: {
    engine: 'sqlserver',
    load: () => withPool(async (pool) => (await pool.request()
      .query('SELECT id_role AS id, code, name FROM dbo.role ORDER BY id_role')).recordset),
  },
  document_type: {
    engine: 'sqlserver',
    load: () => withPool(async (pool) => (await pool.request()
      .query('SELECT id_document_type AS id, code, name FROM dbo.document_type ORDER BY id_document_type')).recordset),
  },
  match_status: {
    engine: 'mysql',
    load: () => mysql.query('SELECT id_status_match AS id, code, name FROM match_status ORDER BY id_status_match'),
  },
  account_status: {
    engine: 'postgres',
    load: () => postgres.query('SELECT id_status_account AS id, code, name FROM account_status ORDER BY 1'),
  },
  bet_status: {
    engine: 'postgres',
    load: () => postgres.query('SELECT id_status_bet AS id, code, name FROM bet_status ORDER BY 1'),
  },
  movement_type: {
    engine: 'postgres',
    load: () => postgres.query('SELECT id_movement AS id, code, name, direction FROM movement_type ORDER BY 1'),
  },
  player_position: {
    engine: 'postgres',
    load: () => postgres.query('SELECT id_position AS id, code, name FROM player_position ORDER BY 1'),
  },
  odds_market: {
    engine: 'mongo',
    load: async () => (await marketRepository.listMarkets())
      .map((market) => ({ id: market.market_code, code: market.market_code, name: market.name })),
  },
  odds_outcome: {
    engine: 'mongo',
    load: async () => (await marketRepository.listOutcomes())
      .map((outcome) => ({ id: `${outcome.market_code}:${outcome.outcome_code}`, ...outcome })),
  },
};

module.exports = { catalogs };
