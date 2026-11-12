const mysql = require('mysql2/promise');

// Pool propio de MySQL (competición y cuotas). createPool no se conecta todavía:
// la primera consulta abre la conexión, así el servidor arranca aunque MySQL esté caído.
let pool;

function getPool() {
  if (!pool) {
    pool = mysql.createPool({
      host: process.env.MYSQL_HOST || 'localhost',
      port: Number(process.env.MYSQL_PORT || 3306),
      database: process.env.MYSQL_DATABASE || 'el_dorado',
      user: process.env.MYSQL_USER,
      password: process.env.MYSQL_PASSWORD,
      connectionLimit: 10,
      connectTimeout: 3000,
      timezone: 'Z',          // Las fechas se guardan y se leen en UTC.
      dateStrings: false,
      decimalNumbers: false,  // Los DECIMAL llegan como texto para no perder precisión.
    });
  }
  return pool;
}


// Marca el error con el motor para que el manejador de errores responda 503 con su nombre.
function tagEngine(error) {
  if (error && typeof error === 'object' && !error.engine) error.engine = 'mysql';
  throw error;
}

async function query(sqlText, params = []) {
  const [rows] = await getPool().execute(sqlText, params).catch(tagEngine);
  return rows;
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

module.exports = { getPool, query, ping, close };
