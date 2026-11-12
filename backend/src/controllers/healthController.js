const databases = require('../config/databases');

// GET /api/health: estado de cada motor. Responde 200 aunque alguno esté caído
// (la API sigue viva); el campo status dice "ok" o "degraded".
async function health(request, response, next) {
  try {
    const engines = await databases.checkAll({ fresh: true });
    const allOk = Object.values(engines).every((engine) => engine.status === 'ok');
    response.json({ status: allOk ? 'ok' : 'degraded', checkedAt: new Date().toISOString(), databases: engines });
  } catch (error) {
    next(error);
  }
}

// GET /api/auth/health: se conserva por compatibilidad; solo mira SQL Server.
async function authHealth(request, response, next) {
  try {
    const sqlserver = await databases.checkEngine('sqlserver', { fresh: true });
    response.status(sqlserver.status === 'ok' ? 200 : 503).json({ status: sqlserver.status, database: 'sqlserver' });
  } catch (error) {
    next(error);
  }
}

module.exports = { health, authHealth };
