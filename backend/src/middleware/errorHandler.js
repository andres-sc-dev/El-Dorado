const databases = require('../config/databases');
const { translatePgError } = require('../utils/pgErrors');

// Códigos de red y de driver que significan "la base de datos no responde".
const CONNECTION_CODES = new Set([
  'ESOCKET', 'ECONNRESET', 'ETIMEOUT', 'ENOTOPEN', 'ECONNCLOSED', 'ELOGIN',   // mssql
  'ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT', 'EAI_AGAIN', 'EHOSTUNREACH',      // red
  'PROTOCOL_CONNECTION_LOST', 'ER_CON_COUNT_ERROR',                          // mysql2
  '57P01', '57P02', '57P03', '08000', '08003', '08006',                       // pg
]);
const MONGO_CONNECTION_ERRORS = new Set([
  'MongoServerSelectionError', 'MongoNetworkError', 'MongoNetworkTimeoutError', 'MongoNotConnectedError',
]);

function isConnectionError(error) {
  return CONNECTION_CODES.has(error.code)
    || MONGO_CONNECTION_ERRORS.has(error.name)
    || /Connection terminated|timeout exceeded when trying to connect/i.test(error.message || '');
}

// Express envía aquí los errores que un controlador pasa a next(error).
// Al cliente le damos un mensaje seguro; en la consola solo dejamos el mensaje técnico,
// nunca el cuerpo de la petición (podría contener contraseñas o documentos).
function errorHandler(error, request, response, next) {
  if (response.headersSent) {
    next(error);
    return;
  }

  if (error.statusCode) {
    const body = { error: error.message };
    // code: identificador estable para el frontend (ODDS_CHANGED, INSUFFICIENT_FUNDS...).
    if (error.errorCode) body.code = error.errorCode;
    if (error.database) body.database = error.database;
    if (error.details) Object.assign(body, error.details);
    if (error.statusCode >= 500) console.error(`Error ${error.statusCode}: ${error.message}`);
    response.status(error.statusCode).json(body);
    return;
  }

  // Errores de negocio de las funciones PL/pgSQL (fn_crear_apuesta, fn_recargar...).
  const pgError = translatePgError(error);
  if (pgError) {
    response.status(pgError.status).json({ error: pgError.message, code: pgError.code });
    return;
  }

  if (error.type === 'entity.parse.failed') {
    response.status(400).json({ error: 'El cuerpo de la petición no es JSON válido' });
    return;
  }

  if (isConnectionError(error)) {
    if (error.engine) databases.markDown(error.engine, error);
    console.error(`Base de datos no disponible (${error.engine || 'desconocida'}): ${error.code || error.name}`);
    response.status(503).json({
      error: 'Una base de datos no está disponible. Intenta de nuevo en unos minutos.',
      ...(error.engine ? { database: error.engine } : {}),
    });
    return;
  }

  console.error(`Error no controlado: ${error.message || 'desconocido'}`);
  response.status(500).json({ error: 'Error interno del servidor' });
}

function notFoundHandler(request, response) {
  response.status(404).json({ error: 'Ruta no encontrada' });
}

module.exports = errorHandler;
module.exports.errorHandler = errorHandler;
module.exports.notFoundHandler = notFoundHandler;
module.exports.isConnectionError = isConnectionError;
