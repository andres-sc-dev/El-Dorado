// Ayudas para las pruebas de integración contra los contenedores reales.
// Todos los datos de prueba usan prefijos propios y se borran al final:
//   usuarios zt_xxxxxxxx (SQL Server y PostgreSQL) y partidos ZTnnnnnn (MySQL).
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const sqlserver = require('../../src/config/sqlserver');
const mysql = require('../../src/config/mysql');
const postgres = require('../../src/config/postgres');
const databases = require('../../src/config/databases');
const userRepository = require('../../src/repositories/sqlserver/userRepository');
const accountRepository = require('../../src/repositories/postgres/accountRepository');
const { hashPassword } = require('../../src/utils/hash');
const { createToken } = require('../../src/utils/token');

const TEST_PASSWORD = 'Prueba-Integracion-2026!';
let passwordHash;

function cookieFor(token) {
  return `el_dorado_token=${token}`;
}

// Crea un usuario con cuenta y saldo. Devuelve su cookie de sesión.
async function createUser({ balance = 0, role = 'USR', status = 1 } = {}) {
  passwordHash = passwordHash || await hashPassword(TEST_PASSWORD);
  const username = `zt_${crypto.randomBytes(4).toString('hex')}`;
  const userId = await userRepository.upsertUserWithCustomer({
    username,
    email: `${username}@pruebas.eldorado.local`,
    passwordHash,
    fullName: 'Usuario de Prueba',
    documentNumber: String(crypto.randomInt(1e9, 9.99e9)),
    birthDate: '1990-05-05',
    roleCode: role,
  });
  await accountRepository.ensureAccount(username);
  if (balance > 0) await accountRepository.deposit(username, balance, `TEST:${username}`);
  if (status !== 1) await setUserStatus(userId, status);
  const token = createToken({ userId, username, role });
  return { userId, username, password: TEST_PASSWORD, cookie: cookieFor(token) };
}

async function setUserStatus(userId, status) {
  await sqlserver.withPool((pool) => pool.request()
    .input('userId', sqlserver.sql.Int, userId)
    .input('status', sqlserver.sql.TinyInt, status)
    .query('UPDATE dbo.users SET status = @status WHERE id = @userId'));
}

async function getBalance(username) {
  return accountRepository.getBalance(username);
}

async function countBets(username) {
  const rows = await postgres.query(
    'SELECT count(*)::int AS total FROM bet b JOIN account a ON a.id = b.account_id WHERE a.username = $1',
    [username],
  );
  return rows[0].total;
}

const DEFAULT_ODDS = [
  ['1X2', 'HOME', 0, '2.00'],
  ['1X2', 'DRAW', 0, '3.00'],
  ['1X2', 'AWAY', 0, '3.50'],
  ['TOTAL_GOALS', 'OVER', 2.5, '2.10'],
  ['TOTAL_GOALS', 'UNDER', 2.5, '1.70'],
  ['TOTAL_GOALS', 'OVER', 3.0, '2.40'],
  ['BTTS', 'YES', 0, '1.90'],
  ['BTTS', 'NO', 0, '1.85'],
  ['HANDICAP', 'HOME', -1.0, '3.40'],
  ['HANDICAP', 'AWAY', -1.0, '1.30'],
  ['EXACT_SCORE', '2-1', 0, '8.00'],
  ['EXACT_SCORE', 'OTHER', 0, '4.50'],
];

// Crea un partido de prueba en MySQL. minutesFromNow < 0 = ya empezó.
// status: 0 programado, 1 en juego, 2 finalizado (con marcador).
async function createMatch({ minutesFromNow = 60 * 24, status = 0 } = {}) {
  const matchCode = `ZT${String(crypto.randomInt(0, 999999)).padStart(6, '0')}`;
  const goals = status === 2 ? [1, 0] : [null, null];
  await mysql.query(`
    INSERT INTO \`match\` (match_code, league_id, matchday_id, stadium_id, home_team_code, away_team_code,
                           match_date, status, home_goals, away_goals)
    SELECT ?, l.id, md.id, st.id, 'MIL', 'NAC', UTC_TIMESTAMP() + INTERVAL ? MINUTE, ?, ?, ?
    FROM league l
    JOIN matchday md ON md.league_id = l.id
    JOIN stadium st ON st.name = 'Estadio El Campín'
    WHERE l.code = 'BP'
    ORDER BY md.number
    LIMIT 1
  `, [matchCode, minutesFromNow, status, ...goals]);
  const [match] = await mysql.query('SELECT id FROM `match` WHERE match_code = ?', [matchCode]);
  for (const [market, outcome, line, odd] of DEFAULT_ODDS) {
    await mysql.query(
      'INSERT INTO odds (match_id, market_code, outcome_code, line, odd_value) VALUES (?, ?, ?, ?, ?)',
      [match.id, market, outcome, String(line), odd],
    );
  }
  return matchCode;
}

async function setOdd(matchCode, market, outcome, line, oddValue) {
  await mysql.query(`
    UPDATE odds o JOIN \`match\` m ON m.id = o.match_id
    SET o.odd_value = ?
    WHERE m.match_code = ? AND o.market_code = ? AND o.outcome_code = ? AND o.line = ?
  `, [oddValue, matchCode, market, outcome, String(line)]);
}

// Borra todo lo creado por las pruebas.
async function cleanup() {
  await postgres.query(`
    DELETE FROM balance_movement WHERE account_id IN (SELECT id FROM account WHERE username LIKE 'zt\\_%')
  `);
  await postgres.query(`
    DELETE FROM bet WHERE account_id IN (SELECT id FROM account WHERE username LIKE 'zt\\_%')
  `);
  await postgres.query("DELETE FROM account WHERE username LIKE 'zt\\_%'");
  await sqlserver.withPool((pool) => pool.request().query("DELETE FROM dbo.users WHERE username LIKE 'zt[_]%'"));
  await mysql.query("DELETE o FROM odds o JOIN `match` m ON m.id = o.match_id WHERE m.match_code LIKE 'ZT%'");
  await mysql.query("DELETE FROM `match` WHERE match_code LIKE 'ZT%'");
}

// Tabla caso -> esperado -> obtenido para docs/PRUEBAS.md.
const report = [];
function record(caso, esperado, obtenido) {
  report.push({ caso, esperado, obtenido: String(obtenido) });
}

function writeReport() {
  const file = process.env.PRUEBAS_REPORT || path.join(__dirname, 'report.md');
  const lines = [
    '| # | Caso | Esperado | Obtenido | ¿Pasa? |',
    '|---|---|---|---|---|',
    ...report.map((row, index) => `| ${index + 1} | ${row.caso} | ${row.esperado} | ${row.obtenido} | ${row.esperado === row.obtenido ? 'Sí' : 'NO'} |`),
  ];
  fs.writeFileSync(file, `${lines.join('\n')}\n`, 'utf8');
}

async function closeAll() {
  await databases.closeAll();
}

module.exports = {
  createUser, setUserStatus, getBalance, countBets, createMatch, setOdd, cleanup, record, writeReport, closeAll,
  cookieFor, TEST_PASSWORD,
};
