const jwt = require('jsonwebtoken');

// El JWT contiene únicamente el identificador necesario para reconocer al
// usuario. Nunca ponemos la contraseña ni el password_hash dentro del token.
function createToken(userId) {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '2h' });
}

module.exports = { createToken };
