// Semilla del usuario de demostración. Idempotente: se puede correr muchas veces.
//   npm run seed:demo
// Lee DEMO_USERNAME y DEMO_PASSWORD (obligatorios) del entorno; nada está escrito en el código.
// 1) SQL Server: crea o actualiza el usuario (bcrypt) y su cliente.
// 2) PostgreSQL: crea la cuenta y le da el saldo de prueba una sola vez (referencia SEED:<usuario>).
require('dotenv').config();

const { hashPassword } = require('../src/utils/hash');
const userRepository = require('../src/repositories/sqlserver/userRepository');
const accountRepository = require('../src/repositories/postgres/accountRepository');
const databases = require('../src/config/databases');

function readConfig() {
  const username = (process.env.DEMO_USERNAME || '').trim();
  const password = process.env.DEMO_PASSWORD || '';
  if (!username || !password) {
    throw new Error('Faltan DEMO_USERNAME o DEMO_PASSWORD en el .env');
  }
  if (password.length < 8) throw new Error('DEMO_PASSWORD debe tener al menos 8 caracteres');

  const balance = Number(process.env.DEMO_BALANCE || 500000);
  if (!Number.isFinite(balance) || balance <= 0) throw new Error('DEMO_BALANCE debe ser un número mayor que cero');

  return {
    username,
    password,
    email: (process.env.DEMO_EMAIL || `${username}@demo.eldorado.local`).trim(),
    fullName: (process.env.DEMO_FULL_NAME || 'Usuario de Demostración').trim(),
    // Documento ficticio por defecto. Nunca se imprime en la consola.
    documentNumber: (process.env.DEMO_DOCUMENT || '1000000001').replace(/\D/g, ''),
    birthDate: '1995-01-15',
    balance,
  };
}

async function main() {
  const config = readConfig();

  const userId = await userRepository.upsertUserWithCustomer({
    username: config.username,
    email: config.email,
    passwordHash: await hashPassword(config.password),
    fullName: config.fullName,
    documentNumber: config.documentNumber,
    birthDate: config.birthDate,
  });
  console.log(`seed:demo · SQL Server: usuario "${config.username}" listo (id ${userId})`);

  const account = await accountRepository.ensureAccount(config.username);
  const credited = await accountRepository.seedDeposit(config.username, config.balance, `SEED:${config.username}`);
  const balance = await accountRepository.getBalance(config.username);
  console.log(`seed:demo · PostgreSQL: cuenta ${account.account_number}, saldo ${balance.toLocaleString('es-CO')} COP`
    + (credited ? ' (saldo inicial acreditado)' : ' (el saldo inicial ya existía)'));
}

main()
  .then(() => databases.closeAll())
  .catch(async (error) => {
    console.error(`seed:demo falló: ${error.message}`);
    await databases.closeAll();
    process.exitCode = 1;
  });
