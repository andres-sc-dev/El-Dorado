const bcrypt = require('bcrypt');

// El hash es irreversible: guardamos una representación segura, no la
// contraseña original. El salt interno de bcrypt también dificulta ataques
// con tablas precalculadas.
async function hashPassword(password) {
  return bcrypt.hash(password, 12);
}

async function comparePassword(password, passwordHash) {
  return bcrypt.compare(password, passwordHash);
}

module.exports = { hashPassword, comparePassword };
