const auditRepository = require('../repositories/mongo/auditRepository');

// Auditoría en MongoDB que nunca bloquea la operación principal:
// si Mongo está caído, la apuesta o la liquidación ya quedó hecha y solo se avisa en consola.
// meta nunca debe llevar contraseñas ni números de documento.
function log(event, username, meta = {}, ip = null) {
  const entry = { event, username: username || null, at: new Date(), ip, meta };
  return auditRepository.insert(entry).then(
    () => true,
    (error) => {
      console.error(`Auditoría no registrada (${event}): ${error.code || error.name || error.message}`);
      return false;
    },
  );
}

module.exports = { log };
