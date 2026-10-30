const { sql } = require('../config/db');

// These definitions are the allow-list used to build queries. Values are
// always supplied through mssql parameters; table and column names never come
// from a request.
const domainDefinitions = {
  country: {
    table: 'country',
    columns: { name: { type: sql.NVarChar(100), required: true }, code: { type: sql.Char(3) } },
  },
  sport: {
    table: 'sport',
    columns: { name: { type: sql.NVarChar(100), required: true } },
  },
  stadium: {
    table: 'stadium',
    columns: {
      name: { type: sql.NVarChar(150), required: true },
      city: { type: sql.NVarChar(100), required: true },
      capacity: { type: sql.Int },
    },
  },
  company: {
    table: 'company',
    columns: {
      name: { type: sql.NVarChar(150), required: true },
      tax_id: { type: sql.NVarChar(30), required: true },
      license: { type: sql.NVarChar(100) },
      address: { type: sql.NVarChar(200) },
      phone: { type: sql.NVarChar(30) },
      email: { type: sql.NVarChar(150) },
    },
  },
  users: {
    table: 'users',
    readOnly: true,
    passwordField: 'password',
    passwordRequired: true,
    columns: {
      username: { type: sql.NVarChar(50), required: true },
      email: { type: sql.NVarChar(150), required: true },
      password_hash: { type: sql.NVarChar(255), private: true },
      status: { type: sql.TinyInt },
    },
  },
  game_rule: {
    table: 'game_rule',
    columns: { sport_id: { type: sql.Int, required: true }, description: { type: sql.NVarChar(500), required: true } },
  },
  league: {
    table: 'league',
    columns: {
      country_id: { type: sql.Int, required: true },
      sport_id: { type: sql.Int, required: true },
      name: { type: sql.NVarChar(150), required: true },
      season: { type: sql.NVarChar(20), required: true },
    },
  },
  team: {
    table: 'team',
    columns: {
      league_id: { type: sql.Int, required: true },
      stadium_id: { type: sql.Int, required: true },
      name: { type: sql.NVarChar(150), required: true },
      crest_url: { type: sql.NVarChar(255) },
    },
  },
  matchday: {
    table: 'matchday',
    columns: {
      league_id: { type: sql.Int, required: true },
      number: { type: sql.TinyInt, required: true },
      date: { type: sql.Date },
    },
  },
  customer: {
    table: 'customer',
    columns: {
      user_id: { type: sql.Int, required: true },
      full_name: { type: sql.NVarChar(150), required: true },
      document_number: { type: sql.NVarChar(30), required: true },
      birth_date: { type: sql.Date, required: true },
      phone: { type: sql.NVarChar(30) },
      address: { type: sql.NVarChar(200) },
    },
  },
  login_history: {
    table: 'login_history',
    readOnly: true,
    columns: {
      user_id: { type: sql.Int, required: true },
      login_time: { type: sql.DateTime2 },
      ip_address: { type: sql.VarChar(45) },
      successful: { type: sql.Bit },
    },
  },
  player: {
    table: 'player',
    columns: {
      team_id: { type: sql.Int, required: true },
      name: { type: sql.NVarChar(150), required: true },
      position: { type: sql.TinyInt },
      jersey_number: { type: sql.TinyInt },
      nationality_id: { type: sql.Int },
      birth_date: { type: sql.Date },
    },
  },
  team_stats: {
    table: 'team_stats',
    columns: {
      team_id: { type: sql.Int, required: true },
      points: { type: sql.TinyInt },
      matches_played: { type: sql.TinyInt },
      wins: { type: sql.TinyInt },
      draws: { type: sql.TinyInt },
      losses: { type: sql.TinyInt },
      goals_for: { type: sql.TinyInt },
      goals_against: { type: sql.TinyInt },
    },
  },
  account: {
    table: 'account',
    columns: {
      customer_id: { type: sql.Int, required: true },
      account_number: { type: sql.NVarChar(30), required: true },
      status: { type: sql.TinyInt },
    },
  },
  match: {
    table: '[match]',
    columns: {
      league_id: { type: sql.Int, required: true },
      matchday_id: { type: sql.Int, required: true },
      home_team_id: { type: sql.Int, required: true },
      away_team_id: { type: sql.Int, required: true },
      stadium_id: { type: sql.Int, required: true },
      match_date: { type: sql.DateTime2, required: true },
      status: { type: sql.TinyInt },
      home_goals: { type: sql.TinyInt },
      away_goals: { type: sql.TinyInt },
    },
  },
  player_stats: {
    table: 'player_stats',
    columns: {
      player_id: { type: sql.Int, required: true },
      goals: { type: sql.TinyInt },
      assists: { type: sql.TinyInt },
      yellow_cards: { type: sql.TinyInt },
      red_cards: { type: sql.TinyInt },
      matches_played: { type: sql.TinyInt },
    },
  },
  odds: {
    table: 'odds',
    columns: {
      match_id: { type: sql.Int, required: true },
      player_id: { type: sql.Int },
      market: { type: sql.TinyInt, required: true },
      outcome: { type: sql.TinyInt, required: true },
      odd_value: { type: sql.Decimal(6, 2), required: true },
    },
  },
  balance_movement: {
    table: 'balance_movement',
    columns: {
      account_id: { type: sql.Int, required: true },
      type: { type: sql.TinyInt, required: true },
      amount: { type: sql.Decimal(12, 2), required: true },
      movement_date: { type: sql.DateTime2 },
      resulting_balance: { type: sql.Decimal(12, 2), required: true },
    },
  },
  bet: {
    table: 'bet',
    columns: {
      customer_id: { type: sql.Int, required: true },
      match_id: { type: sql.Int, required: true },
      odd_id: { type: sql.Int, required: true },
      amount: { type: sql.Decimal(12, 2), required: true },
      odd_value_at_bet: { type: sql.Decimal(6, 2), required: true },
      potential_payout: { type: sql.Decimal(12, 2), required: true },
      status: { type: sql.TinyInt },
      bet_date: { type: sql.DateTime2 },
    },
  },
};

const catalogDefinitions = {
  user_status: { table: 'user_status', idColumn: 'id_status_user' },
  account_status: { table: 'account_status', idColumn: 'id_status_account' },
  match_status: { table: 'match_status', idColumn: 'id_status_match' },
  bet_status: { table: 'bet_status', idColumn: 'id_status_bet' },
  player_position: { table: 'player_position', idColumn: 'id_position' },
  odds_market: { table: 'odds_market', idColumn: 'id_odds' },
  odds_outcome: { table: 'odds_outcome', idColumn: 'id_outcome' },
  movement_type: { table: 'movement_type', idColumn: 'id_movement' },
};

module.exports = { domainDefinitions, catalogDefinitions };
