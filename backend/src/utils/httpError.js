// Error con código HTTP. El manejador de errores lo traduce a una respuesta JSON:
//   { error: mensaje, code?: errorCode, ...details }
class HttpError extends Error {
  constructor(statusCode, message, extra = {}) {
    super(message);
    this.statusCode = statusCode;
    Object.assign(this, extra);
  }
}

// extra puede llevar errorCode (texto estable) y details (campos adicionales de la respuesta).
const badRequest = (message, extra) => new HttpError(400, message, extra);
const unauthorized = (message = 'Autenticación requerida', extra) => new HttpError(401, message, extra);
const forbidden = (message = 'No tienes permiso para esta acción', extra) => new HttpError(403, message, extra);
const notFound = (message = 'Recurso no encontrado', extra) => new HttpError(404, message, extra);
const conflict = (message, extra) => new HttpError(409, message, extra);
const unavailable = (message, extra) => new HttpError(503, message, extra);

module.exports = { HttpError, badRequest, unauthorized, forbidden, notFound, conflict, unavailable };
