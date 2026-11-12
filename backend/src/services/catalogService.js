const { catalogs } = require('../repositories/catalogRepository');
const databases = require('../config/databases');
const { notFound } = require('../utils/httpError');

function getDefinition(name) {
  const definition = catalogs[name];
  if (!definition) throw notFound('Catálogo no encontrado');
  return definition;
}

async function getCatalog(name) {
  return getDefinition(name).load();
}

// Devuelve todos los catálogos de los motores disponibles. Los de un motor caído
// se listan en "unavailable" en lugar de tumbar toda la respuesta.
async function getAllCatalogs() {
  const status = await databases.checkAll();
  const result = {};
  const unavailable = [];
  await Promise.all(Object.entries(catalogs).map(async ([name, definition]) => {
    if (status[definition.engine].status !== 'ok') {
      unavailable.push(name);
      return;
    }
    try {
      result[name] = await definition.load();
    } catch {
      unavailable.push(name);
    }
  }));
  if (unavailable.length) result.unavailable = unavailable.sort();
  return result;
}

module.exports = { getDefinition, getCatalog, getAllCatalogs };
