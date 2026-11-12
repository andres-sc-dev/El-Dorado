const { getAuthClient } = require('../config/firebase');
const { createToken } = require('../utils/token');
const { isAdultBirthDate } = require('../utils/validation');
const {
  HttpError, badRequest, unauthorized, forbidden, conflict, unavailable,
} = require('../utils/httpError');

// Registro e inicio de sesión con Google (Firebase Authentication).
// El navegador obtiene el idToken con signInWithPopup y lo envía aquí; firebase-admin lo verifica
// (firma, audiencia = FIREBASE_PROJECT_ID y vencimiento). Después la sesión es la misma de siempre:
// el JWT de El Dorado en la cookie HttpOnly. Firebase no se usa más allá de identificar a la persona.
// No se enlazan cuentas automáticamente: un correo de una cuenta LOCAL no entra con Google.

// Dependencias reemplazables en las pruebas (verifyIdToken falso, repositorios reales o falsos).
const deps = {
  verifyIdToken: (idToken) => getAuthClient().verifyIdToken(idToken, true),
  users: require('../repositories/sqlserver/userRepository'),
  accounts: require('../repositories/postgres/accountRepository'),
  audit: require('./auditService'),
};

const ACTIVE_STATUS = 1;
// Códigos de firebase-admin que significan "este token no sirve".
const TOKEN_ERRORS = new Set([
  'auth/argument-error', 'auth/invalid-id-token', 'auth/id-token-expired', 'auth/id-token-revoked',
  'auth/user-disabled', 'auth/user-not-found', 'auth/invalid-argument',
]);
const DOCUMENT_PATTERNS = {
  CC: { pattern: /^\d{6,10}$/, message: 'La cédula de ciudadanía debe tener entre 6 y 10 dígitos.' },
  CE: { pattern: /^\d{6,12}$/, message: 'La cédula de extranjería debe tener entre 6 y 12 dígitos.' },
  PEP: { pattern: /^\d{6,15}$/, message: 'El PEP debe tener entre 6 y 15 dígitos.' },
  PA: { pattern: /^[A-Z0-9]{5,20}$/, message: 'El pasaporte debe tener entre 5 y 20 letras o números.' },
};

function isDuplicateKey(error) {
  return error.number === 2601 || error.number === 2627;
}

// Verifica el idToken de Firebase. Cualquier falla (firma, vencido, revocado, otro proyecto) es 401.
async function verifyGoogleToken(idToken) {
  if (typeof idToken !== 'string' || idToken.length < 20 || idToken.length > 5000) {
    throw unauthorized('El token de Google no es válido.', { errorCode: 'GOOGLE_TOKEN_INVALID' });
  }
  let decoded;
  try {
    decoded = await deps.verifyIdToken(idToken);
  } catch (error) {
    // Solo los errores del token son 401. Sin credenciales o sin conexión con Firebase,
    // el problema es del servidor: 503.
    if (!TOKEN_ERRORS.has(error.code)) {
      console.error(`Firebase Auth no disponible: ${error.code || error.message}`);
      throw unavailable('El inicio de sesión con Google no está disponible. Inténtalo de nuevo en unos minutos.', { database: 'firebase' });
    }
    const expired = error.code === 'auth/id-token-expired';
    throw unauthorized(expired ? 'La sesión de Google venció. Inténtalo de nuevo.' : 'El token de Google no es válido.', {
      errorCode: expired ? 'GOOGLE_TOKEN_EXPIRED' : 'GOOGLE_TOKEN_INVALID',
    });
  }
  if (decoded.firebase?.sign_in_provider !== 'google.com') {
    throw unauthorized('El token no proviene de una cuenta de Google.', { errorCode: 'GOOGLE_TOKEN_INVALID' });
  }
  if (!decoded.email || decoded.email_verified !== true) {
    throw unauthorized('Tu correo de Google no está verificado.', { errorCode: 'GOOGLE_EMAIL_NOT_VERIFIED' });
  }
  return {
    uid: decoded.uid,
    email: decoded.email.trim().toLowerCase(),
    name: (decoded.name || '').trim(),
  };
}

function toPublicUser(user, balance) {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    fullName: user.full_name ?? user.fullName ?? null,
    isActive: user.status === undefined ? true : user.status === ACTIVE_STATUS,
    role: user.role_code ?? user.roleCode,
    authProvider: user.auth_provider ?? user.authProvider,
    balance,
    bonusBalance: 0,
  };
}

async function safeBalance(username) {
  try {
    return await deps.accounts.getBalance(username);
  } catch {
    return null;
  }
}

async function startSession(user, ip) {
  if (user.status !== undefined && user.status !== ACTIVE_STATUS) {
    deps.audit.log('LOGIN_FAIL', user.username, { reason: 'INACTIVE', provider: 'GOOGLE' }, ip);
    throw forbidden('La cuenta está inactiva o bloqueada');
  }
  await deps.users.insertLoginHistory(user.id, ip, true).catch(() => {});
  const roleCode = user.role_code ?? user.roleCode;
  deps.audit.log('GOOGLE_LOGIN', user.username, { role: roleCode }, ip);
  const token = createToken({ userId: user.id, username: user.username, role: roleCode });
  return { token, user: toPublicUser(user, await safeBalance(user.username)) };
}

// Cuenta existente para este token: por google_uid, o por correo si la cuenta es GOOGLE.
// Si el correo es de una cuenta LOCAL, 409: no se enlaza automáticamente.
async function findExistingAccount(identity) {
  const byUid = await deps.users.findByGoogleUid(identity.uid);
  if (byUid) return byUid;
  const byEmail = await deps.users.findByEmail(identity.email);
  if (!byEmail) return null;
  if (byEmail.auth_provider === 'GOOGLE') return byEmail;
  throw conflict('Ya existe una cuenta con ese correo; entra con tu contraseña.', { errorCode: 'LOCAL_ACCOUNT_EXISTS' });
}

// POST /api/auth/google
async function googleLogin(body, ip) {
  const identity = await verifyGoogleToken(body?.idToken);
  const existing = await findExistingAccount(identity);
  if (existing) return { status: 'LOGGED_IN', ...(await startSession(existing, ip)) };
  // Usuario nuevo: no se crea nada hasta que complete el perfil.
  return { status: 'PROFILE_INCOMPLETE', email: identity.email, name: identity.name || null };
}

// Lista de campos inválidos (400 con details.fields).
function validateProfile(body, documentTypes) {
  const fields = [];
  const documentType = typeof body?.document_type === 'string' ? body.document_type.trim().toUpperCase() : '';
  const rawNumber = typeof body?.document_number === 'string' ? body.document_number : String(body?.document_number ?? '');
  const documentNumber = rawNumber.replace(/[.\s-]/g, '').toUpperCase();
  const birthDate = typeof body?.birth_date === 'string' ? body.birth_date.trim() : '';

  if (!documentTypes.includes(documentType) || !DOCUMENT_PATTERNS[documentType]) {
    fields.push({ field: 'document_type', message: `El tipo de documento debe ser uno de: ${documentTypes.join(', ')}.` });
  } else if (!DOCUMENT_PATTERNS[documentType].pattern.test(documentNumber)) {
    fields.push({ field: 'document_number', message: DOCUMENT_PATTERNS[documentType].message });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) {
    fields.push({ field: 'birth_date', message: 'La fecha de nacimiento debe tener el formato AAAA-MM-DD.' });
  } else if (!isAdultBirthDate(birthDate)) {
    fields.push({ field: 'birth_date', message: 'Debes tener al menos 18 años para registrarte.' });
  }
  if (body?.accepted_terms !== true) {
    fields.push({ field: 'accepted_terms', message: 'Debes aceptar los términos y condiciones.' });
  }
  if (fields.length) {
    throw badRequest(`Revisa estos campos: ${fields.map((item) => item.field).join(', ')}.`, {
      errorCode: 'VALIDATION_ERROR', details: { fields },
    });
  }
  return { documentType, documentNumber, birthDate };
}

// Usuario único a partir del correo: "maria.perez@gmail.com" -> "maria.perez" (o "maria.perez4821").
async function generateUsername(email) {
  let base = email.split('@')[0].toLowerCase().replace(/[^a-z0-9_.-]/g, '').replace(/^[._-]+|[._-]+$/g, '');
  if (base.length < 3) base = `${base}usr`.slice(0, 3).padEnd(3, 'x');
  base = base.slice(0, 40);
  if (!(await deps.users.usernameExists(base))) return base;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const candidate = `${base}${Math.floor(1000 + Math.random() * 9000)}`;
    if (!(await deps.users.usernameExists(candidate))) return candidate;
  }
  throw conflict('No se pudo generar un nombre de usuario. Inténtalo de nuevo.', { errorCode: 'USERNAME_UNAVAILABLE' });
}

// POST /api/auth/google/complete
// Mismo registro en dos motores que el local: users + customer en SQL Server y, después,
// la cuenta en PostgreSQL con saldo 0. Si PostgreSQL falla, se borra el usuario creado (compensación).
async function completeGoogleProfile(body, ip) {
  const identity = await verifyGoogleToken(body?.idToken);
  if (await findExistingAccount(identity)) {
    throw conflict('Esta cuenta de Google ya está registrada. Inicia sesión con Google.', { errorCode: 'GOOGLE_ACCOUNT_EXISTS' });
  }
  const profile = validateProfile(body, await deps.users.listDocumentTypeCodes());
  if (await deps.users.documentExists(profile.documentType, profile.documentNumber)) {
    throw conflict('Ya existe una cuenta con ese documento.', { errorCode: 'DOCUMENT_TAKEN' });
  }

  let created;
  for (let attempt = 0; !created; attempt += 1) {
    const username = await generateUsername(identity.email);
    try {
      created = await deps.users.createGoogleUserWithCustomer({
        username,
        email: identity.email,
        googleUid: identity.uid,
        fullName: (identity.name || username).slice(0, 150),
        documentTypeCode: profile.documentType,
        documentNumber: profile.documentNumber,
        birthDate: profile.birthDate,
      });
    } catch (error) {
      if (!isDuplicateKey(error)) throw error;
      const message = error.message || '';
      if (/uq_customer_document/i.test(message)) throw conflict('Ya existe una cuenta con ese documento.', { errorCode: 'DOCUMENT_TAKEN' });
      if (/uq_users_email|uq_users_google_uid/i.test(message) || attempt >= 2) {
        throw conflict('Esta cuenta de Google ya está registrada.', { errorCode: 'GOOGLE_ACCOUNT_EXISTS' });
      }
      // Otro registro tomó el mismo usuario al mismo tiempo: se genera otro.
    }
  }

  try {
    await deps.accounts.ensureAccount(created.username);
  } catch (error) {
    await deps.users.deleteUser(created.id).catch(() => {
      console.error('Registro con Google: no se pudo compensar el usuario creado en SQL Server');
    });
    if (error instanceof HttpError) throw error;
    throw unavailable('No pudimos crear tu cuenta de saldo. Inténtalo de nuevo en unos minutos.', { database: 'postgres' });
  }

  deps.audit.log('USER_CREATED', created.username, { role: 'USR', provider: 'GOOGLE' }, ip);
  const session = await startSession({ ...created, status: ACTIVE_STATUS }, ip);
  return { ...session, user: { ...session.user, balance: 0 } };
}

module.exports = {
  googleLogin, completeGoogleProfile, verifyGoogleToken, generateUsername, validateProfile, deps,
};
