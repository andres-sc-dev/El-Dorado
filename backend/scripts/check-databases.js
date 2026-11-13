// Verificación de los 5 motores de El Dorado: conexión, conteos, escritura y lectura que se
// limpian solas, restricciones y referencias cruzadas por claves naturales.
// Nunca imprime contraseñas, llaves ni cédulas.
//
//   docker compose exec backend npm run check:db            (recomendado: usa las variables del contenedor)
//   docker compose exec backend npm run check:db -- --json  (además guarda el resultado en JSON por stdout)
//
// Reglas de los conteos: si el valor real es igual al esperado -> OK. Si es MAYOR por uso normal
// (registros, apuestas, recargas, pruebas anteriores) -> OK con aviso. Solo falla si es menor o si
// una comprobación de estructura (funciones, CHECK, UNIQUE, validador) no se cumple.
// Código de salida: 0 si no hay FAIL, 1 si hay alguno.
const crypto = require('crypto');
const sqlserver = require('../src/config/sqlserver');
const mysql = require('../src/config/mysql');
const postgres = require('../src/config/postgres');
const mongo = require('../src/config/mongo');
const firebase = require('../src/config/firebase');

const results = [];
const TAG = `DBCHECK-${crypto.randomUUID()}`;

function add(engine, check, status, actual = '', expected = '', note = '') {
  results.push({ engine, check, status, actual: String(actual), expected: String(expected), note });
}

// Conteo contra el esperado: igual -> OK, mayor -> OK con aviso, menor -> FAIL.
function count(engine, check, actual, expected, { exact = false } = {}) {
  const n = Number(actual);
  if (n === expected) return add(engine, check, 'OK', n, expected);
  if (n > expected && !exact) return add(engine, check, 'OK', n, `>= ${expected}`, `+${n - expected} por uso normal o pruebas`);
  return add(engine, check, 'FAIL', n, exact ? expected : `>= ${expected}`);
}

function info(engine, check, actual, note = '') {
  add(engine, check, 'OK', actual, '(informativo)', note);
}

// Ejecuta una sección; si el motor no responde, se registra como FAIL y se sigue con los demás.
async function section(engine, fn) {
  const started = Date.now();
  try {
    await fn();
    add(engine, 'conexión y comprobaciones', 'OK', `${Date.now() - started} ms`);
  } catch (error) {
    add(engine, 'conexión', 'FAIL', error.code || error.name || 'ERROR', 'ok', String(error.message || '').slice(0, 120));
  }
}

// Ejecuta fn y espera que la base la rechace con uno de los códigos dados.
async function expectRejected(engine, check, fn, codes) {
  try {
    await fn();
    add(engine, check, 'FAIL', 'aceptado', 'rechazado');
  } catch (error) {
    const code = String(error.code ?? error.number ?? '');
    if (codes.includes(code)) add(engine, check, 'OK', `rechazado (${code})`, 'rechazado');
    else add(engine, check, 'FAIL', `error inesperado ${code}`, `rechazado (${codes.join('/')})`);
  }
}

const shared = {};

// ---------------------------------------------------------------- SQL Server (identidad)
async function checkSqlServer() {
  await section('SQL Server', async () => {
    const pool = await sqlserver.getPool();
    const q = async (text, inputs = {}) => {
      const request = pool.request();
      for (const [name, value] of Object.entries(inputs)) request.input(name, value);
      return (await request.query(text)).recordset;
    };
    const [counts] = await q(`SELECT
      (SELECT COUNT(*) FROM dbo.users) AS users, (SELECT COUNT(*) FROM dbo.customer) AS customer,
      (SELECT COUNT(*) FROM dbo.role) AS role, (SELECT COUNT(*) FROM dbo.document_type) AS document_type,
      (SELECT COUNT(*) FROM dbo.user_status) AS user_status, (SELECT COUNT(*) FROM dbo.auth_provider) AS auth_provider,
      (SELECT COUNT(*) FROM dbo.login_history) AS login_history`);
    shared.counts = { ...shared.counts, sqlserver: counts };
    count('SQL Server', 'users', counts.users, 6);
    count('SQL Server', 'customer', counts.customer, 6);
    count('SQL Server', 'role', counts.role, 2, { exact: true });
    count('SQL Server', 'document_type', counts.document_type, 4, { exact: true });
    count('SQL Server', 'user_status', counts.user_status, 3, { exact: true });
    count('SQL Server', 'auth_provider', counts.auth_provider, 2, { exact: true });
    info('SQL Server', 'login_history', counts.login_history);

    const roles = (await q('SELECT code FROM dbo.role')).map((r) => r.code.trim()).sort().join(',');
    add('SQL Server', 'roles USR y ADM', roles === 'ADM,USR' ? 'OK' : 'FAIL', roles, 'ADM,USR');

    for (const [label, username, role] of [['demo', process.env.DEMO_USERNAME, 'USR'], ['admin', process.env.ADMIN_USERNAME, 'ADM']]) {
      const rows = await q(`SELECT u.username, r.code AS role FROM dbo.users u JOIN dbo.role r ON r.id_role = u.role_id
        WHERE u.username = @username`, { username: username || '' });
      const ok = rows.length === 1 && rows[0].role.trim() === role;
      add('SQL Server', `existe el usuario ${label} con rol ${role}`, ok ? 'OK' : 'FAIL', ok ? 'sí' : 'no', 'sí');
    }

    // Escritura y lectura dentro de una transacción con ROLLBACK (no queda nada).
    const transaction = new sqlserver.sql.Transaction(pool);
    await transaction.begin();
    try {
      const request = new sqlserver.sql.Request(transaction);
      request.input('username', process.env.DEMO_USERNAME || '');
      request.input('ip', TAG.slice(0, 45));
      await request.query(`INSERT INTO dbo.login_history (user_id, ip_address, successful)
        SELECT id, @ip, 0 FROM dbo.users WHERE username = @username`);
      const read = await request.query('SELECT COUNT(*) AS n FROM dbo.login_history WHERE ip_address = @ip');
      add('SQL Server', 'escritura y lectura (login_history, ROLLBACK)', read.recordset[0].n === 1 ? 'OK' : 'FAIL', `${read.recordset[0].n} fila leída`, '1');
    } finally {
      await transaction.rollback();
    }
    const left = await q('SELECT COUNT(*) AS n FROM dbo.login_history WHERE ip_address = @ip', { ip: TAG.slice(0, 45) });
    add('SQL Server', 'limpieza tras ROLLBACK', left[0].n === 0 ? 'OK' : 'FAIL', `${left[0].n} filas`, '0');

    shared.sqlUsers = new Set((await q('SELECT username FROM dbo.users')).map((r) => r.username));
  });
}

// ---------------------------------------------------------------- MySQL (competición y cuotas)
async function checkMysql() {
  await section('MySQL', async () => {
    const q = (text, params) => mysql.query(text, params);
    const [c] = await q(`SELECT
      (SELECT COUNT(*) FROM league) AS league, (SELECT COUNT(*) FROM matchday) AS matchday,
      (SELECT COUNT(*) FROM \`match\`) AS total_match, (SELECT COUNT(*) FROM odds) AS odds,
      (SELECT COUNT(*) FROM match_status) AS match_status, (SELECT COUNT(*) FROM stadium) AS stadium,
      (SELECT COUNT(*) FROM \`match\` m JOIN league l ON l.id = m.league_id WHERE l.code = 'BP' AND l.season_year = 2024 AND m.status = 2) AS real_finished,
      (SELECT COUNT(*) FROM \`match\` m JOIN league l ON l.id = m.league_id WHERE l.code = 'DM') AS dm_total,
      (SELECT COUNT(*) FROM \`match\` m JOIN league l ON l.id = m.league_id WHERE l.code = 'DM' AND m.status = 0) AS dm_scheduled`);
    shared.counts = { ...shared.counts, mysql: c };
    count('MySQL', 'league', c.league, 4);
    count('MySQL', 'matchday', c.matchday, 58);
    count('MySQL', 'match (total)', c.total_match, 469);
    count('MySQL', 'match reales 2024 finalizados', c.real_finished, 432, { exact: true });
    count('MySQL', 'match DM (demo) en total', c.dm_total, 30, { exact: true });
    const finishedDm = Number(c.dm_total) - Number(c.dm_scheduled);
    add('MySQL', 'match DM programados', Number(c.dm_scheduled) > 0 ? 'OK' : 'FAIL', c.dm_scheduled, '30 al cargar',
      finishedDm > 0 ? `${finishedDm} ya finalizados por el administrador o por pruebas` : '');
    count('MySQL', 'odds', c.odds, 234);
    count('MySQL', 'match_status', c.match_status, 4, { exact: true });
    count('MySQL', 'stadium', c.stadium, 26);

    // Escritura y lectura en una transacción con ROLLBACK.
    const connection = await mysql.getPool().getConnection();
    try {
      await connection.beginTransaction();
      await connection.execute('INSERT INTO country (code, name) VALUES (?, ?)', ['ZZ', TAG.slice(0, 40)]);
      const [rows] = await connection.execute('SELECT COUNT(*) AS n FROM country WHERE name = ?', [TAG.slice(0, 40)]);
      add('MySQL', 'escritura y lectura (country, ROLLBACK)', rows[0].n === 1 ? 'OK' : 'FAIL', `${rows[0].n} fila leída`, '1');
      await connection.rollback();
      const [after] = await connection.execute('SELECT COUNT(*) AS n FROM country WHERE name = ?', [TAG.slice(0, 40)]);
      add('MySQL', 'limpieza tras ROLLBACK', after[0].n === 0 ? 'OK' : 'FAIL', `${after[0].n} filas`, '0');
    } finally {
      connection.release();
    }

    shared.scheduled = await q(`SELECT m.match_code, m.home_team_code, m.away_team_code, m.match_date
      FROM \`match\` m WHERE m.status = 0 AND EXISTS (SELECT 1 FROM odds o WHERE o.match_id = m.id AND o.is_active)
      ORDER BY m.match_date`);
    shared.allTeamCodes = await q('SELECT DISTINCT home_team_code AS code FROM `match` UNION SELECT DISTINCT away_team_code FROM `match`');
    shared.oddsMarkets = await q(`SELECT DISTINCT o.market_code, o.outcome_code FROM odds o JOIN \`match\` m ON m.id = o.match_id
      WHERE m.status = 0 AND o.is_active`);
    shared.allMatchCodes = new Set((await q('SELECT match_code FROM `match`')).map((r) => r.match_code));
  });
}

// ---------------------------------------------------------------- PostgreSQL (dinero y equipos)
async function checkPostgres() {
  await section('PostgreSQL', async () => {
    const [c] = await postgres.query(`SELECT
      (SELECT count(*) FROM account)::int AS account, (SELECT count(*) FROM balance_movement)::int AS balance_movement,
      (SELECT count(*) FROM bet)::int AS bet, (SELECT count(*) FROM bet_leg)::int AS bet_leg,
      (SELECT count(*) FROM team)::int AS team, (SELECT count(*) FROM player)::int AS player,
      (SELECT count(*) FROM team_stats)::int AS team_stats, (SELECT count(*) FROM player_stats)::int AS player_stats`);
    shared.counts = { ...shared.counts, postgres: c };
    info('PostgreSQL', 'account', c.account, 'una por usuario USR (el admin no tiene cuenta)');
    info('PostgreSQL', 'balance_movement', c.balance_movement);
    info('PostgreSQL', 'bet', c.bet);
    add('PostgreSQL', 'bet_leg = bet (solo apuestas simples)', c.bet_leg === c.bet ? 'OK' : 'FAIL', c.bet_leg, c.bet);
    count('PostgreSQL', 'team', c.team, 20, { exact: true });
    count('PostgreSQL', 'player', c.player, 830, { exact: true });
    count('PostgreSQL', 'team_stats', c.team_stats, 20, { exact: true });
    count('PostgreSQL', 'player_stats', c.player_stats, 308, { exact: true });

    const wanted = ['fn_recargar', 'fn_crear_apuesta', 'fn_liquidar_apuesta', 'fn_liquidar_partido', 'fn_anular_apuesta'];
    const found = (await postgres.query(`SELECT p.proname FROM pg_proc p JOIN pg_language l ON l.oid = p.prolang
      WHERE l.lanname = 'plpgsql' AND p.proname = ANY($1)`, [wanted])).map((r) => r.proname);
    for (const name of wanted) add('PostgreSQL', `función PL/pgSQL ${name}`, found.includes(name) ? 'OK' : 'FAIL', found.includes(name) ? 'existe' : 'no existe', 'existe');

    const constraints = (await postgres.query(`SELECT conname, contype FROM pg_constraint WHERE conrelid = 'balance_movement'::regclass`))
      .map((r) => `${r.conname}:${r.contype}`);
    for (const name of ['ck_movement_amount:c', 'balance_movement_resulting_balance_check:c', 'balance_movement_reference_check:c', 'uq_movement_reference:u']) {
      add('PostgreSQL', `restricción ${name.split(':')[0]}`, constraints.includes(name) ? 'OK' : 'FAIL', constraints.includes(name) ? 'existe' : 'no existe', 'existe');
    }

    // Todo dentro de una transacción con ROLLBACK; cada intento inválido va en su SAVEPOINT.
    const client = await postgres.getPool().connect();
    try {
      await client.query('BEGIN');
      const [{ id: accountId } = {}] = (await client.query('SELECT id FROM account ORDER BY id LIMIT 1')).rows;
      const [{ reference: existing } = {}] = (await client.query('SELECT reference FROM balance_movement ORDER BY id LIMIT 1')).rows;
      const insert = (amount, balance, reference) => client.query(
        'INSERT INTO balance_movement (account_id, movement_type, amount, resulting_balance, reference) VALUES ($1, 1, $2, $3, $4)',
        [accountId, amount, balance, reference],
      );
      const attempt = async (check, fn, codes) => {
        await client.query('SAVEPOINT sp');
        await expectRejected('PostgreSQL', check, fn, codes);
        await client.query('ROLLBACK TO SAVEPOINT sp');
      };
      await attempt('CHECK rechaza monto negativo', () => insert(-1, 0, `${TAG}-a`), ['23514']);
      await attempt('CHECK rechaza saldo resultante negativo', () => insert(1, -1, `${TAG}-b`), ['23514']);
      await attempt('CHECK rechaza reference de 2 caracteres', () => insert(1, 1, 'ab'), ['23514']);
      if (existing) await attempt('UNIQUE rechaza reference repetida', () => insert(1, 1, existing), ['23505']);
      else add('PostgreSQL', 'UNIQUE rechaza reference repetida', 'FAIL', 'sin movimientos para probar', 'rechazado');

      await insert(1, 1, TAG);
      const read = await client.query('SELECT count(*)::int AS n FROM balance_movement WHERE reference = $1', [TAG]);
      add('PostgreSQL', 'escritura y lectura (balance_movement, ROLLBACK)', read.rows[0].n === 1 ? 'OK' : 'FAIL', `${read.rows[0].n} fila leída`, '1');
      await client.query('ROLLBACK');
      const after = await client.query('SELECT count(*)::int AS n FROM balance_movement WHERE reference = $1', [TAG]);
      add('PostgreSQL', 'limpieza tras ROLLBACK', after.rows[0].n === 0 ? 'OK' : 'FAIL', `${after.rows[0].n} filas`, '0');
    } finally {
      client.release();
    }

    shared.pgTeams = new Set((await postgres.query('SELECT team_code FROM team')).map((r) => r.team_code));
    shared.pgAccounts = await postgres.query('SELECT username, balance FROM account');
    shared.pgLegs = await postgres.query('SELECT DISTINCT match_code, market_code, outcome_code FROM bet_leg');
    shared.pgReferences = new Set((await postgres.query(`SELECT reference FROM balance_movement WHERE reference LIKE 'ELD-%'`)).map((r) => r.reference));
  });
}

// ---------------------------------------------------------------- MongoDB (mercados, reglas y auditoría)
async function checkMongo() {
  await section('MongoDB', async () => {
    const db = await mongo.getDb();
    const c = {
      odds_market: await db.collection('odds_market').countDocuments(),
      odds_outcome: await db.collection('odds_outcome').countDocuments(),
      game_rule: await db.collection('game_rule').countDocuments(),
      audit_log: await db.collection('audit_log').countDocuments(),
    };
    shared.counts = { ...shared.counts, mongo: c };
    count('MongoDB', 'odds_market', c.odds_market, 5, { exact: true });
    count('MongoDB', 'odds_outcome', c.odds_outcome, 19, { exact: true });
    count('MongoDB', 'game_rule', c.game_rule, 5, { exact: true });
    info('MongoDB', 'audit_log', c.audit_log);

    await expectRejected('MongoDB', 'validador $jsonSchema rechaza un mercado incompleto',
      () => db.collection('odds_market').insertOne({ sport: 'FUT', market_code: TAG }), ['121']);
    await expectRejected('MongoDB', 'validador de audit_log rechaza un evento desconocido',
      () => db.collection('audit_log').insertOne({ event: 'NO_EXISTE', at: new Date() }), ['121']);
    const sample = await db.collection('odds_market').findOne({}, { projection: { _id: 0 } });
    await expectRejected('MongoDB', 'índice único (sport, market_code) rechaza un duplicado',
      () => db.collection('odds_market').insertOne({ ...sample }), ['11000']);

    const audit = db.collection('audit_log');
    // El validador solo admite eventos de la lista: se usa LOGOUT sin usuario y la marca va en meta.
    await audit.insertOne({ event: 'LOGOUT', username: null, at: new Date(), meta: { db_check: TAG } });
    const read = await audit.countDocuments({ 'meta.db_check': TAG });
    add('MongoDB', 'escritura y lectura (audit_log)', read === 1 ? 'OK' : 'FAIL', `${read} documento leído`, '1');
    await audit.deleteMany({ 'meta.db_check': TAG });
    const left = await audit.countDocuments({ 'meta.db_check': TAG });
    add('MongoDB', 'limpieza (deleteMany)', left === 0 ? 'OK' : 'FAIL', `${left} documentos`, '0');

    shared.markets = new Set((await db.collection('odds_market').find({}, { projection: { market_code: 1 } }).toArray()).map((m) => m.market_code));
    shared.outcomes = new Set((await db.collection('odds_outcome').find({}, { projection: { market_code: 1, outcome_code: 1 } }).toArray())
      .map((o) => `${o.market_code}|${o.outcome_code}`));
  });
}

// ---------------------------------------------------------------- Firestore (pagos Wompi)
async function checkFirestore() {
  await section('Firestore', async () => {
    const db = firebase.getDb();
    const ref = db.collection('_db_check').doc(TAG);
    await ref.set({ tag: TAG, at: new Date() });
    const read = await ref.get();
    add('Firestore', 'escritura y lectura (_db_check)', read.exists && read.data().tag === TAG ? 'OK' : 'FAIL', read.exists ? 'leído' : 'no leído', 'leído');
    await ref.delete();
    const gone = await ref.get();
    add('Firestore', 'limpieza (delete)', gone.exists ? 'FAIL' : 'OK', gone.exists ? 'sigue' : 'borrado', 'borrado');

    const payments = (await db.collection('payments').count().get()).data().count;
    shared.counts = { ...shared.counts, firestore: { payments } };
    info('Firestore', 'payments', payments, 'una por recarga');
    const demo = process.env.DEMO_USERNAME || '';
    const docs = (await db.collection('payments').where('username', '==', demo).get()).docs.map((d) => d.data());
    docs.sort((a, b) => String(b.created_at?.toDate?.().toISOString() ?? '').localeCompare(String(a.created_at?.toDate?.().toISOString() ?? '')));
    shared.lastRecharge = docs[0] ?? null;
    shared.firestoreCredited = (await db.collection('payments').where('status', '==', 'CREDITED').get()).docs.map((d) => d.data());
  });
}

// ---------------------------------------------------------------- Prueba cruzada por claves naturales
function checkCross() {
  const E = 'Cruzada';
  const demo = process.env.DEMO_USERNAME || '';
  if (!shared.sqlUsers || !shared.pgAccounts || !shared.scheduled || !shared.markets) {
    add(E, 'prueba cruzada', 'FAIL', 'falta algún motor', 'los 5 motores');
    return;
  }
  add(E, 'demo: username en SQL Server', shared.sqlUsers.has(demo) ? 'OK' : 'FAIL', shared.sqlUsers.has(demo) ? 'existe' : 'no', 'existe');
  const account = shared.pgAccounts.find((a) => a.username === demo);
  add(E, 'demo: cuenta y saldo en PostgreSQL', account ? 'OK' : 'FAIL', account ? `saldo ${Number(account.balance).toLocaleString('es-CO')} COP` : 'sin cuenta', 'cuenta');

  const orphanAccounts = shared.pgAccounts.filter((a) => !shared.sqlUsers.has(a.username)).length;
  add(E, 'account.username -> SQL Server users', orphanAccounts ? 'FAIL' : 'OK', `${orphanAccounts} huérfanas`, '0');

  const next = shared.scheduled.slice(0, 5).map((m) => m.match_code).join(', ');
  add(E, 'partidos programados con cuotas (MySQL)', shared.scheduled.length ? 'OK' : 'FAIL', shared.scheduled.length, '> 0', `próximos: ${next}`);
  const teamCodes = new Set(shared.scheduled.flatMap((m) => [m.home_team_code, m.away_team_code]));
  const orphanTeams = [...teamCodes].filter((t) => !shared.pgTeams.has(t));
  add(E, 'team_code de partidos programados -> PostgreSQL team', orphanTeams.length ? 'FAIL' : 'OK', `${teamCodes.size} equipos, ${orphanTeams.length} huérfanos`, '0 huérfanos', orphanTeams.join(','));
  const allOrphanTeams = shared.allTeamCodes.map((r) => r.code).filter((t) => !shared.pgTeams.has(t));
  add(E, 'team_code de TODOS los partidos -> PostgreSQL team', allOrphanTeams.length ? 'FAIL' : 'OK', `${allOrphanTeams.length} huérfanos`, '0', allOrphanTeams.join(','));

  const usedMarkets = new Set(shared.oddsMarkets.map((o) => o.market_code));
  const orphanMarkets = [...usedMarkets].filter((m) => !shared.markets.has(m));
  add(E, 'market_code de las cuotas -> MongoDB odds_market', orphanMarkets.length ? 'FAIL' : 'OK', `${usedMarkets.size} mercados (${[...usedMarkets].join(', ')}), ${orphanMarkets.length} huérfanos`, '0 huérfanos');
  const orphanOutcomes = shared.oddsMarkets.filter((o) => !shared.outcomes.has(`${o.market_code}|${o.outcome_code}`));
  add(E, 'outcome_code de las cuotas -> MongoDB odds_outcome', orphanOutcomes.length ? 'FAIL' : 'OK', `${orphanOutcomes.length} huérfanos`, '0');

  const legOrphans = shared.pgLegs.filter((l) => !shared.allMatchCodes.has(l.match_code) || !shared.markets.has(l.market_code));
  add(E, 'bet_leg (match_code, market_code) -> MySQL y MongoDB', legOrphans.length ? 'FAIL' : 'OK', `${shared.pgLegs.length} combinaciones, ${legOrphans.length} huérfanas`, '0');

  if (shared.lastRecharge) {
    const r = shared.lastRecharge;
    const credited = r.status !== 'CREDITED' || shared.pgReferences.has(r.reference);
    add(E, 'demo: última recarga en Firestore', 'OK', `${r.status} ${Number(r.amount_cop).toLocaleString('es-CO')} COP`, '(informativo)');
    add(E, 'última recarga CREDITED -> movimiento en PostgreSQL', credited ? 'OK' : 'FAIL', credited ? 'reference encontrada' : 'reference sin movimiento', 'encontrada');
  } else {
    add(E, 'demo: última recarga en Firestore', 'OK', 'el demo aún no ha recargado', '(informativo)', 'su saldo inicial viene de la semilla');
  }
  if (shared.firestoreCredited) {
    const missing = shared.firestoreCredited.filter((p) => !shared.pgReferences.has(p.reference));
    const unknownUsers = shared.firestoreCredited.filter((p) => !shared.sqlUsers.has(p.username));
    add(E, 'payments CREDITED (Firestore) -> balance_movement (PostgreSQL)', missing.length ? 'FAIL' : 'OK', `${shared.firestoreCredited.length} recargas, ${missing.length} sin movimiento`, '0');
    add(E, 'payments.username (Firestore) -> SQL Server users', unknownUsers.length ? 'OK' : 'OK', `${unknownUsers.length} de usuarios ya borrados`,
      '(informativo)', unknownUsers.length ? 'usuarios de pruebas de integración que se limpian al terminar' : '');
  }
}

function print() {
  const width = (key) => Math.min(60, Math.max(...results.map((r) => r[key].length), key.length));
  const pad = (text, n) => String(text).slice(0, n).padEnd(n);
  const cols = ['engine', 'check', 'status', 'actual', 'expected'];
  const w = Object.fromEntries(cols.map((c) => [c, width(c)]));
  console.log(cols.map((c) => pad(c, w[c])).join(' | '));
  for (const r of results) {
    console.log(cols.map((c) => pad(r[c], w[c])).join(' | ') + (r.note ? `  (${r.note})` : ''));
  }
  const fails = results.filter((r) => r.status === 'FAIL').length;
  console.log(`\nTotal: ${results.length} comprobaciones, ${results.length - fails} OK, ${fails} FAIL.`);
  if (process.argv.includes('--json')) console.log(JSON.stringify({ counts: shared.counts, results }));
  return fails;
}

(async () => {
  await checkSqlServer();
  await checkMysql();
  await checkPostgres();
  await checkMongo();
  await checkFirestore();
  checkCross();
  const fails = print();
  await Promise.allSettled([sqlserver.close(), mysql.close(), postgres.close(), mongo.close()]);
  process.exit(fails ? 1 : 0);
})();
