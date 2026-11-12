const { Pool } = require('pg');

// Pool propio de PostgreSQL (dinero y equipos). new Pool no se conecta todavía.
let pool;

function getPool() {
  if (!pool) {
    pool = new Pool({
      host: process.env.POSTGRES_HOST || 'localhost',
      port: Number(process.env.POSTGRES_PORT || 5432),
      database: process.env.POSTGRES_DB || 'el_dorado',
      user: process.env.POSTGRES_USER,
      password: process.env.POSTGRES_PASSWORD,
      max: 10,
      connectionTimeoutMillis: 3000,
      idleTimeoutMillis: 30000,
    });
    // Sin este manejador, un cliente inactivo que pierde la conexión tumbaría el proceso.
    pool.on('error', (error) => {
      console.error(`PostgreSQL: conexión inactiva perdida (${error.code || error.message})`);
    });
  }
  return pool;
}


// Marca el error con el motor para que el manejador de errores responda 503 con su nombre.
function tagEngine(error) {
  if (error && typeof error === 'object' && !error.engine) error.engine = 'postgres';
  throw error;
}

async function query(sqlText, params = []) {
  const result = await getPool().query(sqlText, params).catch(tagEngine);
  return result.rows;
}

// Ejecuta fn(client) dentro de una transacción. Si fn lanza un error, se hace ROLLBACK.
async function transaction(fn) {
  const client = await getPool().connect().catch(tagEngine);
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    return tagEngine(error);
  } finally {
    client.release();
  }
}

async function ping() {
  await getPool().query('SELECT 1');
}

async function close() {
  if (!pool) return;
  const current = pool;
  pool = undefined;
  await current.end().catch(() => {});
}

module.exports = { getPool, query, transaction, ping, close };
