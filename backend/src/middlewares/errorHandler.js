// Express envía aquí los errores que un controlador pasa a next(error).
// Al cliente le damos un mensaje seguro y dejamos los detalles internos en
// la consola del servidor para poder diagnosticarlos sin filtrarlos.
function errorHandler(error, request, response, next) {
  console.error(`Unhandled request error: ${error.message || 'unknown error'}`);

  if (response.headersSent) {
    next(error);
    return;
  }

  if (error.statusCode) {
    response.status(error.statusCode).json({ error: error.message });
    return;
  }

  if (['ESOCKET', 'ECONNRESET', 'ETIMEOUT', 'ENOTOPEN'].includes(error.code)) {
    response.status(503).json({ error: 'La base de datos no está disponible. Intenta nuevamente.' });
    return;
  }

  response.status(500).json({ error: 'Error interno del servidor' });
}

module.exports = errorHandler;
