// El Dorado · MongoDB · reglas de juego, mercados, resultados y auditoría.
// Script de mongosh idempotente. Docker lo ejecuta la primera vez que se crea el volumen;
// también se puede repetir a mano (ver README).
// Los mercados se identifican por (sport, market_code): claves naturales que usan
// MySQL (odds.market_code) y PostgreSQL (bet_leg.market_code).

const fs = require('fs');
const path = require('path');

const seedDir = process.env.MONGO_SEED_DIR || '/docker-entrypoint-initdb.d';
const markets = JSON.parse(fs.readFileSync(path.join(seedDir, 'mercados.json'), 'utf8'));

db = db.getSiblingDB('el_dorado');

// Crea la colección con su validador, o actualiza el validador si ya existe.
function ensureCollection(name, schema) {
  const options = { validator: { $jsonSchema: schema }, validationLevel: 'strict', validationAction: 'error' };
  if (db.getCollectionNames().includes(name)) {
    db.runCommand({ collMod: name, ...options });
  } else {
    db.createCollection(name, options);
  }
}

const codePattern = '^[A-Z0-9_]{2,20}$';

// ---------- odds_market ----------
// Cada tipo de selección exige su propia estructura: LINE necesita "line", SCORE necesita "score".
ensureCollection('odds_market', {
  bsonType: 'object',
  required: ['sport', 'market_code', 'name', 'selection_type', 'settlement', 'is_active'],
  additionalProperties: false,
  properties: {
    _id: { bsonType: 'objectId' },
    sport: { bsonType: 'string', pattern: '^[A-Z]{3}$' },
    market_code: { bsonType: 'string', pattern: codePattern },
    name: { bsonType: 'string', minLength: 2, maxLength: 80 },
    description: { bsonType: 'string', maxLength: 300 },
    selection_type: { enum: ['FIXED', 'LINE', 'SCORE', 'YES_NO'] },
    line: {
      bsonType: 'object',
      required: ['allowed', 'default', 'applies_to'],
      properties: {
        allowed: { bsonType: 'array', minItems: 1, items: { bsonType: ['double', 'int', 'decimal'] } },
        default: { bsonType: ['double', 'int', 'decimal'] },
        applies_to: { enum: ['TOTAL', 'HOME'] },
      },
    },
    score: {
      bsonType: 'object',
      required: ['max_goals_per_team', 'pattern'],
      properties: {
        max_goals_per_team: { bsonType: 'int', minimum: 1, maximum: 9 },
        pattern: { bsonType: 'string' },
        includes_other: { bsonType: 'bool' },
      },
    },
    settlement: {
      bsonType: 'object',
      required: ['basis'],
      properties: { basis: { bsonType: 'string' }, push_on_tie: { bsonType: 'bool' } },
    },
    is_active: { bsonType: 'bool' },
    updated_at: { bsonType: 'date' },
  },
  oneOf: [
    { properties: { selection_type: { enum: ['FIXED', 'YES_NO'] } }, not: { anyOf: [{ required: ['line'] }, { required: ['score'] }] } },
    { properties: { selection_type: { enum: ['LINE'] } }, required: ['line'], not: { required: ['score'] } },
    { properties: { selection_type: { enum: ['SCORE'] } }, required: ['score'], not: { required: ['line'] } },
  ],
});
db.odds_market.createIndex({ sport: 1, market_code: 1 }, { unique: true, name: 'uq_sport_market_code' });

// ---------- odds_outcome ----------
ensureCollection('odds_outcome', {
  bsonType: 'object',
  required: ['sport', 'market_code', 'outcome_code', 'name', 'sort_order'],
  additionalProperties: false,
  properties: {
    _id: { bsonType: 'objectId' },
    sport: { bsonType: 'string', pattern: '^[A-Z]{3}$' },
    market_code: { bsonType: 'string', pattern: codePattern },
    outcome_code: { bsonType: 'string', minLength: 1, maxLength: 10 },
    name: { bsonType: 'string', minLength: 1, maxLength: 60 },
    sort_order: { bsonType: 'int', minimum: 1 },
    home_goals: { bsonType: 'int', minimum: 0 },
    away_goals: { bsonType: 'int', minimum: 0 },
  },
});
db.odds_outcome.createIndex(
  { sport: 1, market_code: 1, outcome_code: 1 },
  { unique: true, name: 'uq_sport_market_outcome' },
);

// ---------- game_rule ----------
ensureCollection('game_rule', {
  bsonType: 'object',
  required: ['sport', 'rule_code', 'title', 'description'],
  additionalProperties: false,
  properties: {
    _id: { bsonType: 'objectId' },
    sport: { bsonType: 'string', pattern: '^[A-Z]{3}$' },
    rule_code: { bsonType: 'string', pattern: codePattern },
    title: { bsonType: 'string', maxLength: 100 },
    description: { bsonType: 'string', maxLength: 1000 },
    applies_to_markets: { bsonType: 'array', items: { bsonType: 'string', pattern: codePattern } },
  },
});
db.game_rule.createIndex({ sport: 1, rule_code: 1 }, { unique: true, name: 'uq_sport_rule_code' });

// ---------- audit_log ----------
// Bitácora de eventos. Nunca guarda contraseñas ni números de documento.
ensureCollection('audit_log', {
  bsonType: 'object',
  required: ['event', 'at'],
  properties: {
    event: { enum: ['LOGIN', 'LOGIN_FAILED', 'LOGOUT', 'REGISTER', 'BET_PLACED', 'MATCH_FINISHED', 'DEPOSIT'] },
    username: { bsonType: ['string', 'null'], maxLength: 50 },
    at: { bsonType: 'date' },
    ip: { bsonType: ['string', 'null'], maxLength: 45 },
    meta: { bsonType: 'object' },
  },
});
db.audit_log.createIndex({ at: -1 }, { name: 'ix_at' });
db.audit_log.createIndex({ username: 1, at: -1 }, { name: 'ix_username_at' });
db.audit_log.createIndex({ event: 1, at: -1 }, { name: 'ix_event_at' });

// ---------- Datos ----------
const now = new Date();
for (const market of markets) {
  const { outcomes, ...fields } = market;
  // mongosh lee los enteros del JSON como double; el validador pide int.
  if (fields.score) fields.score.max_goals_per_team = NumberInt(fields.score.max_goals_per_team);
  db.odds_market.updateOne(
    { sport: fields.sport, market_code: fields.market_code },
    { $set: { ...fields, is_active: true, updated_at: now } },
    { upsert: true },
  );
  for (const outcome of outcomes) {
    const doc = { sport: fields.sport, market_code: fields.market_code, outcome_code: outcome.outcome_code, name: outcome.name, sort_order: NumberInt(outcome.sort_order) };
    if (outcome.home_goals !== undefined) doc.home_goals = NumberInt(outcome.home_goals);
    if (outcome.away_goals !== undefined) doc.away_goals = NumberInt(outcome.away_goals);
    db.odds_outcome.updateOne(
      { sport: doc.sport, market_code: doc.market_code, outcome_code: doc.outcome_code },
      { $set: doc },
      { upsert: true },
    );
  }
}

const rules = [
  { rule_code: 'REGULATION_TIME', title: 'Tiempo reglamentario', description: 'Todas las apuestas se liquidan con el resultado al final de los 90 minutos más el tiempo añadido. No cuentan prórroga ni penales.' },
  { rule_code: 'SIMPLE_BETS_ONLY', title: 'Solo apuestas simples', description: 'Cada tiquete tiene una sola selección. No se aceptan combinadas.' },
  { rule_code: 'NO_LIVE_BETS', title: 'Sin apuestas en vivo', description: 'Solo se puede apostar a partidos programados que aún no han comenzado.' },
  { rule_code: 'CANCELLED_MATCH', title: 'Partido cancelado', description: 'Si un partido se cancela, la apuesta se anula y se devuelve el monto apostado.' },
  { rule_code: 'HANDICAP_PUSH', title: 'Empate con hándicap', description: 'Si con el hándicap el resultado queda empatado, se devuelve el monto apostado.', applies_to_markets: ['HANDICAP'] },
];
for (const rule of rules) {
  db.game_rule.updateOne({ sport: 'FUT', rule_code: rule.rule_code }, { $set: { sport: 'FUT', ...rule } }, { upsert: true });
}

print(`el_dorado: ${db.odds_market.countDocuments()} mercados, ${db.odds_outcome.countDocuments()} resultados, ${db.game_rule.countDocuments()} reglas`);
