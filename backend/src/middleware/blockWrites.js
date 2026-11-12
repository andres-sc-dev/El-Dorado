// Parche de seguridad de la Fase 1: las rutas genéricas no aceptan escrituras.
// Antes cualquiera, sin sesión, podía crear saldo, partidos o cuotas.
// Responden 403 hasta que existan los roles (Fase 2) y la escritura pase a rutas de ADM.
const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function blockWrites(request, response, next) {
  if (!WRITE_METHODS.has(request.method)) {
    next();
    return;
  }
  response.status(403).json({ error: 'Escritura deshabilitada: requiere rol de administrador (Fase 2)' });
}

module.exports = { blockWrites };
