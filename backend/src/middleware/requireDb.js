const databases = require('../config/databases');

const engineLabels = {
  sqlserver: 'SQL Server',
  mysql: 'MySQL',
  postgres: 'PostgreSQL',
  mongo: 'MongoDB',
};

// requireDb('pg') o requireDb('sqlserver', 'pg'): responde 503 si alguno de esos motores
// no está disponible. Las rutas que no lo usan siguen funcionando.
function requireDb(...names) {
  const keys = names.map((name) => databases.resolveEngine(name));

  return async function requireDbMiddleware(request, response, next) {
    try {
      const results = await Promise.all(keys.map((key) => databases.checkEngine(key)));
      const downIndex = results.findIndex((result) => result.status !== 'ok');
      if (downIndex === -1) {
        next();
        return;
      }
      const key = keys[downIndex];
      response.status(503).json({
        error: `${engineLabels[key]} no está disponible. Intenta de nuevo en unos minutos.`,
        database: key,
      });
    } catch (error) {
      next(error);
    }
  };
}

module.exports = { requireDb, engineLabels };
