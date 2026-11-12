const sql = require('mssql');

// Pool propio de SQL Server (identidad). Se crea al primer uso: si la base está caída,
// el servidor arranca igual y solo fallan las rutas que la necesitan.
function buildConfig() {
  return {
    server: process.env.SQLSERVER_HOST || 'localhost',
    port: Number(process.env.SQLSERVER_PORT || 1433),
    database: process.env.SQLSERVER_DB || 'el_dorado',
    user: process.env.SQLSERVER_USER,
    password: process.env.SQLSERVER_PASSWORD,
    connectionTimeout: 3000,
    requestTimeout: 10000,
    options: { encrypt: false, trustServerCertificate: true },
    pool: { max: 10, min: 0, idleTimeoutMillis: 30000 },
  };
}

let poolPromise;

function getPool() {
  if (!poolPromise) {
    const pool = new sql.ConnectionPool(buildConfig());
    // Si la conexión se pierde, el siguiente uso abre un pool nuevo.
    pool.on('error', () => { poolPromise = undefined; });
    poolPromise = pool.connect().catch((error) => {
      poolPromise = undefined;
      throw error;
    });
  }
  return poolPromise;
}


// Marca el error con el motor para que el manejador de errores responda 503 con su nombre.
function tagEngine(error) {
  if (error && typeof error === 'object' && !error.engine) error.engine = 'sqlserver';
  throw error;
}

// Ejecuta fn(pool) y marca cualquier error como de SQL Server.
async function withPool(fn) {
  try {
    return await fn(await getPool());
  } catch (error) {
    return tagEngine(error);
  }
}

async function ping() {
  const pool = await getPool();
  await pool.request().query('SELECT 1 AS ok');
}

async function close() {
  if (!poolPromise) return;
  const pending = poolPromise;
  poolPromise = undefined;
  try { (await pending).close(); } catch { /* ya estaba cerrado */ }
}

module.exports = { sql, getPool, withPool, ping, close };
