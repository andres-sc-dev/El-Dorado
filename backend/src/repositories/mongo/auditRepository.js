const { withDb } = require('../../config/mongo');

// Bitácora en MongoDB (colección audit_log, con validador $jsonSchema).
// Nunca recibe contraseñas ni números de documento.
async function insert(entry) {
  return withDb((db) => db.collection('audit_log').insertOne(entry));
}

module.exports = { insert };
