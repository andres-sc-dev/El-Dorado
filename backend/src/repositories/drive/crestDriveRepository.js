const jwt = require('jsonwebtoken');
const { normalizePrivateKey } = require('../../config/firebase');

// Escudos en Google Drive, leídos con la cuenta de servicio de Firebase (FIREBASE_CLIENT_EMAIL y
// FIREBASE_PRIVATE_KEY) y el scope drive.readonly. La carpeta GDRIVE_CRESTS_FOLDER_ID debe estar
// compartida con ese correo. No hay dependencias nuevas: el token OAuth se firma con jsonwebtoken.
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const DRIVE_URL = 'https://www.googleapis.com/drive/v3/files';
const SCOPE = 'https://www.googleapis.com/auth/drive.readonly';
const TIMEOUT_MS = 4000;

let cachedToken = null;

function getConfig() {
  const folderId = (process.env.GDRIVE_CRESTS_FOLDER_ID || '').trim();
  const clientEmail = (process.env.FIREBASE_CLIENT_EMAIL || '').trim();
  const privateKey = normalizePrivateKey(process.env.FIREBASE_PRIVATE_KEY);
  if (!folderId || !clientEmail || !privateKey) return null;
  // El id de una carpeta de Drive solo tiene letras, números, - y _.
  if (!/^[A-Za-z0-9_-]{10,100}$/.test(folderId)) return null;
  return { folderId, clientEmail, privateKey };
}

function isConfigured() {
  return getConfig() !== null;
}

async function getAccessToken({ clientEmail, privateKey }) {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60000) return cachedToken.value;
  const now = Math.floor(Date.now() / 1000);
  const assertion = jwt.sign(
    { iss: clientEmail, scope: SCOPE, aud: TOKEN_URL, iat: now, exp: now + 3600 },
    privateKey,
    { algorithm: 'RS256' },
  );
  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`Google OAuth respondió ${response.status}`);
  const body = await response.json();
  cachedToken = { value: body.access_token, expiresAt: Date.now() + body.expires_in * 1000 };
  return cachedToken.value;
}

// Busca <teamCode>.png en la carpeta y lo descarga. null si no existe. teamCode ya viene validado
// (^[A-Z]{3}$) y el id de carpeta también: se pueden poner en la consulta de Drive sin inyección.
async function findCrest(teamCode) {
  const config = getConfig();
  if (!config) return null;
  const token = await getAccessToken(config);
  const headers = { Authorization: `Bearer ${token}` };
  const q = `name = '${teamCode}.png' and '${config.folderId}' in parents and trashed = false`;
  const params = new URLSearchParams({ q, fields: 'files(id,mimeType)', pageSize: '1' });
  const list = await fetch(`${DRIVE_URL}?${params}`, { headers, signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!list.ok) throw new Error(`Google Drive respondió ${list.status}`);
  const file = (await list.json()).files?.[0];
  if (!file) return null;
  const media = await fetch(`${DRIVE_URL}/${encodeURIComponent(file.id)}?alt=media`, {
    headers, signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!media.ok) throw new Error(`Google Drive respondió ${media.status} al descargar`);
  return { body: Buffer.from(await media.arrayBuffer()), contentType: file.mimeType || 'image/png' };
}

module.exports = { isConfigured, findCrest };
