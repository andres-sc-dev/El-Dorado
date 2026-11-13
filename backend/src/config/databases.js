const sqlserver = require('./sqlserver');
const mysql = require('./mysql');
const postgres = require('./postgres');
const mongo = require('./mongo');
const firestore = require('./firebase');

// Registro de los cinco motores. 'pg' es un alias corto de 'postgres'.
// Firestore (pagos de Wompi) se comprueba igual que los otros cuatro.
const engines = { sqlserver, mysql, postgres, mongo, firestore };
const aliases = { pg: 'postgres', mssql: 'sqlserver', mongodb: 'mongo', firebase: 'firestore' };

const PING_TIMEOUT_MS = 3000;
const CACHE_MS = 3000;
const cache = new Map();

function resolveEngine(name) {
  const key = aliases[name] || name;
  if (!engines[key]) throw new Error(`Motor desconocido: ${name}`);
  return key;
}

function withTimeout(promise, ms) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(Object.assign(new Error('timeout'), { code: 'ETIMEOUT' })), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

// Comprueba un motor con una consulta mínima. El resultado se guarda unos segundos para
// no hacer un ping por cada petición.
async function checkEngine(name, { fresh = false } = {}) {
  const key = resolveEngine(name);
  const cached = cache.get(key);
  if (!fresh && cached && Date.now() - cached.checkedAt < CACHE_MS) return cached.result;

  const started = Date.now();
  let result;
  try {
    await withTimeout(engines[key].ping(), PING_TIMEOUT_MS);
    result = { status: 'ok', latencyMs: Date.now() - started };
  } catch (error) {
    result = { status: 'down', latencyMs: Date.now() - started, error: error.code || error.name || 'ERROR' };
  }
  cache.set(key, { checkedAt: Date.now(), result });
  return result;
}

async function checkAll(options) {
  const names = Object.keys(engines);
  const results = await Promise.all(names.map((name) => checkEngine(name, options)));
  return Object.fromEntries(names.map((name, index) => [name, results[index]]));
}

// Marca un motor como caído sin esperar al siguiente ping (lo usa el manejador de errores).
function markDown(name, error) {
  const key = resolveEngine(name);
  cache.set(key, { checkedAt: Date.now(), result: { status: 'down', latencyMs: 0, error: error?.code || 'ERROR' } });
}

async function closeAll() {
  await Promise.all(Object.values(engines).map((engine) => engine.close()));
}

module.exports = { engines, resolveEngine, checkEngine, checkAll, markDown, closeAll };
