const crypto = require('node:crypto');
const driveRepository = require('../repositories/drive/crestDriveRepository');
const fileRepository = require('../repositories/files/crestFileRepository');
const { badRequest } = require('../utils/httpError');

// Escudo de un equipo. Orden: (a) Google Drive si está configurado, (b) backend/data/crests,
// (c) un SVG genérico. Nunca falla por una dependencia: si Drive o el disco fallan, pasa al
// siguiente. El resultado queda en caché de memoria (1 hora) para no repetir lecturas.
const TEAM_CODE = /^[A-Z]{3}$/;
const CACHE_TTL_MS = 60 * 60 * 1000;
const cache = new Map();

function genericCrest(teamCode) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="${teamCode}">`
    + '<path d="M32 3 8 11v18c0 15 10 26 24 32 14-6 24-17 24-32V11L32 3z" fill="#1f2937" stroke="#d4a017" stroke-width="3"/>'
    + `<text x="32" y="38" text-anchor="middle" font-family="Arial, sans-serif" font-size="15" font-weight="700" fill="#f5d061">${teamCode}</text>`
    + '</svg>';
  return { body: Buffer.from(svg), contentType: 'image/svg+xml' };
}

function withEtag(crest, source) {
  const hash = crypto.createHash('sha1').update(crest.body).digest('base64url');
  return { ...crest, source, etag: `"${hash}"`, storedAt: Date.now() };
}

async function resolveCrest(teamCode) {
  if (driveRepository.isConfigured()) {
    try {
      const fromDrive = await driveRepository.findCrest(teamCode);
      if (fromDrive) return withEtag(fromDrive, 'drive');
    } catch (error) {
      console.warn(`Escudos: Google Drive no respondió (${error.message}); uso el archivo local`);
    }
  }
  try {
    const fromFile = await fileRepository.findCrest(teamCode);
    if (fromFile) return withEtag(fromFile, 'file');
  } catch (error) {
    console.warn(`Escudos: no se pudo leer el archivo local (${error.code || error.message})`);
  }
  return withEtag(genericCrest(teamCode), 'generic');
}

async function getCrest(rawCode) {
  const teamCode = String(rawCode || '').toUpperCase();
  if (!TEAM_CODE.test(teamCode)) throw badRequest('team_code inválido: deben ser 3 letras', { errorCode: 'INVALID_TEAM_CODE' });
  const cached = cache.get(teamCode);
  if (cached && Date.now() - cached.storedAt < CACHE_TTL_MS) return cached;
  const crest = await resolveCrest(teamCode);
  cache.set(teamCode, crest);
  return crest;
}

function clearCache() {
  cache.clear();
}

module.exports = { getCrest, clearCache, genericCrest };
