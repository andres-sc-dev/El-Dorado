import { initializeApp } from 'firebase/app';
import { GoogleAuthProvider, getAuth } from 'firebase/auth';

// Firebase Authentication en el navegador, solo para "Continuar con Google".
// Estos valores son la configuración web PÚBLICA del proyecto (no son secretos):
// Firebase los protege con la lista de dominios autorizados y el backend verifica cada idToken.
const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const isFirebaseConfigured = Boolean(config.apiKey && config.authDomain && config.projectId && config.appId);

let auth = null;
export function getFirebaseAuth() {
  if (!isFirebaseConfigured) return null;
  if (!auth) auth = getAuth(initializeApp(config));
  return auth;
}

// Siempre deja elegir la cuenta de Google (útil si hay varias en el navegador).
export function createGoogleProvider() {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  return provider;
}
