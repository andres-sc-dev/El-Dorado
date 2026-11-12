const fs = require('node:fs/promises');
const path = require('node:path');

// Escudos locales descargados una sola vez por scripts/seed/apifootball-download.js.
const CRESTS_DIR = path.resolve(__dirname, '..', '..', '..', 'data', 'crests');

// teamCode ya viene validado (^[A-Z]{3}$): no puede salir de la carpeta.
async function findCrest(teamCode) {
  try {
    const body = await fs.readFile(path.join(CRESTS_DIR, `${teamCode}.png`));
    return { body, contentType: 'image/png' };
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

module.exports = { findCrest, CRESTS_DIR };
