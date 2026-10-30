const sql = require('mssql');

// Un pool mantiene varias conexiones reutilizables. Abrir una conexión nueva
// por cada petición es más lento y puede agotar los recursos de SQL Server.
const dbConfig = {
  server: process.env.DB_SERVER,
  database: process.env.DB_DATABASE || 'el_dorado',
  port: Number(process.env.DB_PORT || 1433),
  user: process.env.DB_USER || undefined,
  password: process.env.DB_PASSWORD || undefined,
  options: {
    encrypt: false,
    trustServerCertificate: true,
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  },
};

let poolPromise;

async function getConnection() {
  if (!poolPromise) {
    poolPromise = sql.connect(dbConfig)
      .then((pool) => {
        pool.on('error', () => {
          // Allow the next request to establish a fresh pool after a
          // connection drop or SQL Server restart.
          poolPromise = undefined;
        });
        return pool;
      })
      .catch((error) => {
        poolPromise = undefined;
        throw error;
      });
  }

  return poolPromise;
}

module.exports = { sql, getConnection };
