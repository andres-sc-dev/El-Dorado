// requireRole('ADM'): solo deja pasar a los roles indicados. Va después de authenticate.
// El rol sale del JWT, que se firma con el código de la tabla role de SQL Server.
function requireRole(...roles) {
  return function requireRoleMiddleware(request, response, next) {
    if (!request.user) {
      response.status(401).json({ error: 'Autenticación requerida' });
      return;
    }
    if (!roles.includes(request.user.role)) {
      response.status(403).json({ error: 'No tienes permiso para esta acción', code: 'FORBIDDEN_ROLE' });
      return;
    }
    next();
  };
}

module.exports = { requireRole };
