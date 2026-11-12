import { signInWithPopup, signOut } from 'firebase/auth';
import { createGoogleProvider, getFirebaseAuth, isFirebaseConfigured } from '../config/firebase';
import apiClient from './apiClient';

// Mensajes amables para los errores de Firebase más comunes en el popup.
const POPUP_MESSAGES = {
  'auth/popup-closed-by-user': 'Cerraste la ventana de Google antes de terminar. Inténtalo de nuevo cuando quieras.',
  'auth/cancelled-popup-request': 'Ya había una ventana de Google abierta. Termina en esa o inténtalo de nuevo.',
  'auth/popup-blocked': 'Tu navegador bloqueó la ventana de Google. Permite las ventanas emergentes para este sitio e inténtalo de nuevo.',
  'auth/unauthorized-domain': 'Este dominio no está autorizado en Firebase Authentication. Avísale al administrador.',
  'auth/network-request-failed': 'No hay conexión con Google. Revisa tu internet e inténtalo de nuevo.',
  'auth/operation-not-allowed': 'El inicio de sesión con Google no está habilitado en Firebase.',
  'auth/internal-error': 'Google no respondió. Inténtalo de nuevo en unos minutos.',
};

export function googleErrorMessage(error) {
  return POPUP_MESSAGES[error?.code] || error?.message || 'No se pudo continuar con Google.';
}

// Abre el popup de Google y devuelve el idToken de Firebase.
export async function signInWithGooglePopup() {
  const auth = getFirebaseAuth();
  if (!isFirebaseConfigured || !auth) {
    throw new Error('El inicio de sesión con Google no está configurado (faltan las variables VITE_FIREBASE_*).');
  }
  const credential = await signInWithPopup(auth, createGoogleProvider());
  return credential.user.getIdToken();
}

// idToken fresco de la sesión de Google que sigue abierta (la usa /complete-profile).
export async function currentGoogleIdToken() {
  const auth = getFirebaseAuth();
  if (!auth) return null;
  await auth.authStateReady();
  return auth.currentUser ? auth.currentUser.getIdToken() : null;
}

export async function currentGoogleProfile() {
  const auth = getFirebaseAuth();
  if (!auth) return null;
  await auth.authStateReady();
  const user = auth.currentUser;
  return user ? { email: user.email, name: user.displayName } : null;
}

// La sesión de El Dorado es la cookie del backend: la de Firebase se cierra apenas termina el flujo.
export async function signOutGoogle() {
  const auth = getFirebaseAuth();
  if (auth?.currentUser) await signOut(auth).catch(() => {});
}

// 200 { status: 'LOGGED_IN', user } o 202 { status: 'PROFILE_INCOMPLETE', email, name }.
export async function loginWithGoogleToken(idToken) {
  return apiClient.post('/api/auth/google', { idToken });
}

export async function completeGoogleProfile(payload) {
  return apiClient.post('/api/auth/google/complete', payload);
}
