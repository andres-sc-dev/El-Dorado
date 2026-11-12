const userRepository = require('../repositories/sqlserver/userRepository');
const accountRepository = require('../repositories/postgres/accountRepository');
const { comparePassword, hashPassword } = require('../utils/hash');
const { createToken } = require('../utils/token');
const { badRequest, unauthorized, forbidden, conflict } = require('../utils/httpError');
const { requireText, isAdultBirthDate } = require('../utils/validation');
const { evaluatePassword } = require('../utils/passwordPolicy');
const auditService = require('./auditService');

const ACTIVE_STATUS = 1;

// El saldo vive en PostgreSQL. Si PostgreSQL está caído, el inicio de sesión
// (que solo depende de SQL Server) funciona igual y el saldo llega como null.
async function safeBalance(username) {
  try {
    return await accountRepository.getBalance(username);
  } catch {
    return null;
  }
}

function toPublicUser(user, balance) {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    fullName: user.full_name ?? user.fullName ?? null,
    isActive: user.status === undefined ? true : user.status === ACTIVE_STATUS,
    role: user.role_code ?? user.roleCode,
    balance,
    bonusBalance: 0,
  };
}

async function login({ identifier, password, ipAddress }) {
  const cleanIdentifier = requireText(identifier, 'El usuario o correo');
  requireText(password, 'La contraseña');

  const user = await userRepository.findByIdentifier(cleanIdentifier);
  // Auditoría sin bloquear: nunca se guarda la contraseña ni lo que se escribió como usuario.
  if (!user) {
    auditService.log('LOGIN_FAIL', null, { reason: 'UNKNOWN_USER' }, ipAddress);
    throw unauthorized('Credenciales inválidas');
  }

  const passwordMatches = await comparePassword(password, user.password_hash);
  await userRepository.insertLoginHistory(user.id, ipAddress, passwordMatches);
  if (!passwordMatches) {
    auditService.log('LOGIN_FAIL', user.username, { reason: 'WRONG_PASSWORD' }, ipAddress);
    throw unauthorized('Credenciales inválidas');
  }
  if (user.status !== ACTIVE_STATUS) {
    auditService.log('LOGIN_FAIL', user.username, { reason: 'INACTIVE' }, ipAddress);
    throw forbidden('La cuenta está inactiva o bloqueada');
  }

  const token = createToken({ userId: user.id, username: user.username, role: user.role_code });
  auditService.log('LOGIN_OK', user.username, { role: user.role_code }, ipAddress);
  return { token, user: toPublicUser(user, await safeBalance(user.username)) };
}

async function currentUser(userId) {
  const user = await userRepository.findById(userId);
  if (!user) throw unauthorized('Usuario no encontrado');
  return toPublicUser(user, await safeBalance(user.username));
}

function isDuplicateKey(error) {
  return error.number === 2601 || error.number === 2627;
}

// Registro en dos motores sin transacción distribuida:
// 1) users + customer en SQL Server (una transacción),
// 2) account en PostgreSQL.
// Si el paso 2 falla, se compensa borrando el usuario del paso 1.
async function register(body) {
  const fullName = requireText(body.fullName, 'El nombre completo');
  const documentNumber = requireText(body.documentNumber, 'El documento').replace(/\./g, '');
  const birthDate = requireText(body.birthDate, 'La fecha de nacimiento');
  const username = requireText(body.username, 'El usuario');
  const email = requireText(body.email, 'El correo');
  requireText(body.password, 'La contraseña');
  const password = body.password;

  if (!/^[0-9]{6,10}$/.test(documentNumber)) throw badRequest('La cédula debe tener entre 6 y 10 dígitos');
  if (!/^[A-Za-z0-9_.-]{3,50}$/.test(username)) throw badRequest('El usuario debe tener entre 3 y 50 letras, números, punto, guion o guion bajo');
  if (!isAdultBirthDate(birthDate)) throw badRequest('Debes tener al menos 18 años para registrarte');
  const passwordCheck = evaluatePassword(password, { username, email });
  if (!passwordCheck.valid) {
    throw badRequest(`La contraseña no cumple: ${passwordCheck.failed.map((rule) => rule.label.toLowerCase()).join(', ')}.`, {
      errorCode: 'WEAK_PASSWORD', details: { failed_rules: passwordCheck.failed },
    });
  }

  let created;
  try {
    created = await userRepository.createUserWithCustomer({
      username, email, passwordHash: await hashPassword(password), fullName, documentNumber, birthDate,
    });
  } catch (error) {
    if (isDuplicateKey(error)) throw conflict('El usuario, correo o documento ya existe');
    throw error;
  }

  try {
    await accountRepository.ensureAccount(username);
  } catch (error) {
    await userRepository.deleteUser(created.id).catch(() => {
      console.error('Registro: no se pudo compensar el usuario creado en SQL Server');
    });
    throw error;
  }

  auditService.log('USER_CREATED', username, { role: 'USR' }, body.ipAddress ?? null);
  return toPublicUser(created, 0);
}

module.exports = { login, currentUser, register };
