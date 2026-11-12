const jwt = require('jsonwebtoken');

// El JWT lleva solo lo que la API necesita para autorizar: id, usuario y rol.
// username es la clave natural con la que PostgreSQL y MongoDB identifican al usuario.
// Nunca guardamos la contraseña, el hash ni el documento dentro del token.
function createToken({ userId, username, role }) {
  return jwt.sign({ userId, username, role }, process.env.JWT_SECRET, { expiresIn: '2h' });
}

function verifyToken(token) {
  return jwt.verify(token, process.env.JWT_SECRET);
}

module.exports = { createToken, verifyToken };
