// Semilla de usuarios. Idempotente: se puede correr muchas veces.
//   npm run seed:demo
// Nada está escrito en el código: todo sale del entorno (.env).
// 1) PostgreSQL: copia BET_MIN_COP y BET_MAX_COP a la tabla bet_limit.
// 2) Usuario de demostración (rol USR): DEMO_USERNAME y DEMO_PASSWORD.
//    SQL Server crea o actualiza el usuario (bcrypt) y su cliente; PostgreSQL crea la cuenta
//    y le da el saldo de prueba una sola vez con fn_recargar (referencia SEED:<usuario>).
// 3) Administrador (rol ADM): ADMIN_USERNAME, ADMIN_EMAIL, ADMIN_PASSWORD y ADMIN_DOCUMENT.
//    El registro público siempre crea USR; la única forma de tener un ADM es esta semilla.
require('dotenv').config();

const { hashPassword } = require('../src/utils/hash');
const userRepository = require('../src/repositories/sqlserver/userRepository');
const accountRepository = require('../src/repositories/postgres/accountRepository');
const databases = require('../src/config/databases');
const { getBetLimits } = require('../src/config/betLimits');

const env = (name) => (process.env[name] || '').trim();

function readDemoConfig() {
  const username = env('DEMO_USERNAME');
  const password = process.env.DEMO_PASSWORD || '';
  if (!username || !password) throw new Error('Faltan DEMO_USERNAME o DEMO_PASSWORD en el .env');
  if (password.length < 8) throw new Error('DEMO_PASSWORD debe tener al menos 8 caracteres');

  const balance = Number(process.env.DEMO_BALANCE || 500000);
  if (!Number.isFinite(balance) || balance <= 0) throw new Error('DEMO_BALANCE debe ser un número mayor que cero');

  return {
    username,
    password,
    email: env('DEMO_EMAIL') || `${username}@demo.eldorado.local`,
    fullName: env('DEMO_FULL_NAME') || 'Usuario de Demostración',
    // Documento ficticio por defecto. Nunca se imprime en la consola.
    documentNumber: (env('DEMO_DOCUMENT') || '1000000001').replace(/\D/g, ''),
    birthDate: '1995-01-15',
    balance,
  };
}

// null si no hay administrador configurado (la semilla avisa y sigue).
function readAdminConfig() {
  const names = ['ADMIN_USERNAME', 'ADMIN_EMAIL', 'ADMIN_PASSWORD', 'ADMIN_DOCUMENT'];
  const missing = names.filter((name) => !env(name));
  if (missing.length === names.length) return null;
  if (missing.length) throw new Error(`Faltan ${missing.join(', ')} en el .env`);
  if (process.env.ADMIN_PASSWORD.length < 12) throw new Error('ADMIN_PASSWORD debe tener al menos 12 caracteres');
  const documentNumber = env('ADMIN_DOCUMENT').replace(/\./g, '');
  if (!/^[0-9]{6,10}$/.test(documentNumber)) throw new Error('ADMIN_DOCUMENT debe ser una cédula de 6 a 10 dígitos');
  return {
    username: env('ADMIN_USERNAME'),
    email: env('ADMIN_EMAIL'),
    password: process.env.ADMIN_PASSWORD,
    fullName: env('ADMIN_FULL_NAME') || 'Administrador El Dorado',
    documentNumber,
    birthDate: '1990-01-01',
  };
}

async function seedDemo() {
  const config = readDemoConfig();
  const userId = await userRepository.upsertUserWithCustomer({
    username: config.username,
    email: config.email,
    passwordHash: await hashPassword(config.password),
    fullName: config.fullName,
    documentNumber: config.documentNumber,
    birthDate: config.birthDate,
    roleCode: 'USR',
  });
  console.log(`seed:demo · SQL Server: usuario "${config.username}" (USR) listo (id ${userId})`);

  const account = await accountRepository.ensureAccount(config.username);
  const result = await accountRepository.deposit(config.username, config.balance, `SEED:${config.username}`);
  console.log(`seed:demo · PostgreSQL: cuenta ${account.account_number}, saldo ${Number(result.balance).toLocaleString('es-CO')} COP`
    + (result.credited ? ' (saldo inicial acreditado)' : ' (el saldo inicial ya existía)'));
}

async function seedAdmin() {
  const config = readAdminConfig();
  if (!config) {
    console.log('seed:demo · Administrador omitido: define ADMIN_USERNAME, ADMIN_EMAIL, ADMIN_PASSWORD y ADMIN_DOCUMENT');
    return;
  }
  const userId = await userRepository.upsertUserWithCustomer({
    username: config.username,
    email: config.email,
    passwordHash: await hashPassword(config.password),
    fullName: config.fullName,
    documentNumber: config.documentNumber,
    birthDate: config.birthDate,
    roleCode: 'ADM',
  });
  console.log(`seed:demo · SQL Server: administrador "${config.username}" (ADM) listo (id ${userId})`);
}

async function main() {
  const limits = getBetLimits();
  await accountRepository.syncBetLimits(limits);
  console.log(`seed:demo · PostgreSQL: límites de apuesta ${limits.min.toLocaleString('es-CO')} - ${limits.max.toLocaleString('es-CO')} COP`);
  await seedDemo();
  await seedAdmin();
}

main()
  .then(() => databases.closeAll())
  .catch(async (error) => {
    console.error(`seed:demo falló: ${error.message}`);
    await databases.closeAll();
    process.exitCode = 1;
  });
