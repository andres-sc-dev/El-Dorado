// Error con código HTTP. El manejador de errores lo traduce a una respuesta JSON.
class HttpError extends Error {
  constructor(statusCode, message, extra = {}) {
    super(message);
    this.statusCode = statusCode;
    Object.assign(this, extra);
  }
}

const badRequest = (message) => new HttpError(400, message);
const unauthorized = (message = 'Autenticación requerida') => new HttpError(401, message);
const forbidden = (message = 'No tienes permiso para esta acción') => new HttpError(403, message);
const notFound = (message = 'Recurso no encontrado') => new HttpError(404, message);
const conflict = (message) => new HttpError(409, message);
const unavailable = (message, extra) => new HttpError(503, message, extra);

module.exports = { HttpError, badRequest, unauthorized, forbidden, notFound, conflict, unavailable };
