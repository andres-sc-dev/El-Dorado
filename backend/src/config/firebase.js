const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');

// Firebase: Firestore (pagos de Wompi) y Authentication (inicio de sesión con Google).
// Una sola app de firebase-admin para los dos. Se inicializa al primer uso, así el servidor arranca
// aunque falten las credenciales: solo las rutas de pagos responden 503.
// Credenciales: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL y FIREBASE_PRIVATE_KEY.
// Si FIRESTORE_EMULATOR_HOST está definido, firebase-admin usa el emulador local.
const APP_NAME = 'el-dorado';
let db;

// La llave privada puede venir con saltos de línea reales o con "\n" escritos
// (así queda al pegarla en una sola línea del .env o de Docker). Se aceptan los dos.
function normalizePrivateKey(value) {
  return (value || '').replace(/^"|"$/g, '').replace(/\\n/g, '\n');
}

function tagEngine(error) {
  if (error && typeof error === 'object' && !error.engine) error.engine = 'firestore';
  throw error;
}

function getApp() {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = normalizePrivateKey(process.env.FIREBASE_PRIVATE_KEY);
  const useEmulator = Boolean(process.env.FIRESTORE_EMULATOR_HOST || process.env.FIREBASE_AUTH_EMULATOR_HOST);
  if (!projectId || (!useEmulator && (!clientEmail || !privateKey))) {
    tagEngine(Object.assign(new Error('Faltan las credenciales de Firebase'), { code: 'FIREBASE_NOT_CONFIGURED' }));
  }
  return getApps().find((app) => app.name === APP_NAME) || initializeApp(
    useEmulator ? { projectId } : { credential: cert({ projectId, clientEmail, privateKey }), projectId },
    APP_NAME,
  );
}

function getDb() {
  if (!db) db = getFirestore(getApp());
  return db;
}

// Firebase Authentication de la misma app (verifyIdToken para el inicio de sesión con Google).
function getAuthClient() {
  return getAuth(getApp());
}

// Ejecuta fn(db) y marca cualquier error como de Firestore (el manejador responde 503).
async function withFirestore(fn) {
  try {
    return await fn(getDb());
  } catch (error) {
    return tagEngine(error);
  }
}

// Comprobación mínima para GET /api/health: leer como máximo un documento de payments.
async function ping() {
  await getDb().collection('payments').limit(1).get();
}

// La app de firebase-admin se reutiliza; no hay conexión que cerrar.
async function close() {}

module.exports = { getApp, getDb, getAuthClient, withFirestore, normalizePrivateKey, ping, close };
