const { getConnection, sql } = require('../config/db');
const { hashPassword } = require('../utils/hash');
const { domainDefinitions } = require('../domain/domainDefinitions');

async function listRecords(name) {
  const definition = domainDefinitions[name];
  const pool = await getConnection();
  const fields = ['id', ...Object.keys(definition.columns).filter((field) => !definition.columns[field].private)];
  const result = await pool.request().query(
    `SELECT ${fields.map((field) => `[${field}]`).join(', ')} FROM ${definition.table} ORDER BY id DESC`,
  );
  return result.recordset;
}

async function createRecord(name, payload) {
  const definition = domainDefinitions[name];
  const pool = await getConnection();
  const requestBuilder = pool.request();
  const insertFields = [];

  for (const [field, config] of Object.entries(definition.columns)) {
    if (config.private) continue;
    let value = payload[field];
    if (value === undefined || value === null || value === '') continue;
    if (typeof value === 'string') value = value.trim();
    requestBuilder.input(field, config.type, value);
    insertFields.push(field);
  }

  if (definition.passwordField) {
    requestBuilder.input(
      'password_hash',
      sql.NVarChar(255),
      await hashPassword(payload[definition.passwordField].trim()),
    );
    insertFields.push('password_hash');
  }

  const result = await requestBuilder.query(`
    INSERT INTO ${definition.table} (${insertFields.map((field) => `[${field}]`).join(', ')})
    OUTPUT INSERTED.*
    VALUES (${insertFields.map((field) => `@${field}`).join(', ')})
  `);
  return result.recordset[0];
}

async function getRecord(name, id) {
  const definition = domainDefinitions[name];
  const pool = await getConnection();
  const fields = ['id', ...Object.keys(definition.columns).filter((field) => !definition.columns[field].private)];
  const result = await pool.request()
    .input('id', sql.Int, id)
    .query(
      `SELECT ${fields.map((field) => `[${field}]`).join(', ')} FROM ${definition.table} WHERE [id] = @id`,
    );
  return result.recordset[0] || null;
}

async function getUserBalance(userId) {
  const pool = await getConnection();
  const result = await pool.request()
    .input('userId', sql.Int, userId)
    .query(`
      SELECT COALESCE(SUM(
        CASE WHEN bm.type IN (1, 4) THEN bm.amount ELSE -bm.amount END
      ), 0) AS balance
      FROM customer AS c
      INNER JOIN account AS a ON a.customer_id = c.id
      LEFT JOIN balance_movement AS bm ON bm.account_id = a.id
      WHERE c.user_id = @userId
    `);
  return Number(result.recordset[0]?.balance || 0);
}

async function createBalanceMovement(userId, type, amount) {
  const pool = await getConnection();
  const transaction = new sql.Transaction(pool);
  await transaction.begin();
  let committed = false;

  try {
    const accountResult = await new sql.Request(transaction)
      .input('userId', sql.Int, userId)
      .query(`
        SELECT TOP 1 a.id
        FROM account AS a
        INNER JOIN customer AS c ON c.id = a.customer_id
        WHERE c.user_id = @userId AND a.status = 1
        ORDER BY a.id
      `);
    const accountId = accountResult.recordset[0]?.id;
    if (!accountId) {
      const error = new Error('El usuario no tiene una cuenta activa');
      error.statusCode = 400;
      throw error;
    }

    const balanceResult = await new sql.Request(transaction)
      .input('accountId', sql.Int, accountId)
      .query(`
        SELECT COALESCE(SUM(
          CASE WHEN type IN (1, 4) THEN amount ELSE -amount END
        ), 0) AS balance
        FROM balance_movement
        WHERE account_id = @accountId
      `);
    const currentBalance = Number(balanceResult.recordset[0]?.balance || 0);
    if (type === 2 && amount > currentBalance) {
      const error = new Error('Fondos insuficientes para retirar');
      error.statusCode = 400;
      throw error;
    }

    const nextBalance = type === 1 ? currentBalance + amount : currentBalance - amount;
    await new sql.Request(transaction)
      .input('accountId', sql.Int, accountId)
      .input('type', sql.TinyInt, type)
      .input('amount', sql.Decimal(12, 2), amount)
      .input('resultingBalance', sql.Decimal(12, 2), nextBalance)
      .query(`
        INSERT INTO balance_movement (account_id, type, amount, resulting_balance)
        VALUES (@accountId, @type, @amount, @resultingBalance)
      `);

    await transaction.commit();
    committed = true;
    return nextBalance;
  } catch (error) {
    if (!committed) await transaction.rollback();
    throw error;
  }
}

async function listUserBets(userId) {
  const pool = await getConnection();
  const result = await pool.request()
    .input('userId', sql.Int, userId)
    .query(`
      SELECT b.id, b.customer_id, b.match_id, b.odd_id, b.amount,
             b.odd_value_at_bet, b.potential_payout, b.status, b.bet_date,
             bs.name AS status_name, o.market, o.outcome,
             m.match_date, ht.name AS home_team, at.name AS away_team,
             l.name AS league_name
      FROM bet AS b
      INNER JOIN customer AS c ON c.id = b.customer_id
      INNER JOIN [match] AS m ON m.id = b.match_id
      INNER JOIN team AS ht ON ht.id = m.home_team_id
      INNER JOIN team AS at ON at.id = m.away_team_id
      INNER JOIN league AS l ON l.id = m.league_id
      INNER JOIN odds AS o ON o.id = b.odd_id
      LEFT JOIN bet_status AS bs ON bs.id_status_bet = b.status
      WHERE c.user_id = @userId
      ORDER BY b.id DESC
    `);

  return result.recordset.map((bet) => ({
    ...bet,
    status: bet.status_name || bet.status,
    stake: Number(bet.amount),
    totalOdds: Number(bet.odd_value_at_bet),
    potentialPayout: Number(bet.potential_payout),
    createdAt: bet.bet_date,
    selections: [{
      matchId: bet.match_id,
      matchLabel: `${bet.home_team} vs ${bet.away_team}`,
      oddId: bet.odd_id,
      oddLabel: bet.outcome,
      oddValueAtBetTime: Number(bet.odd_value_at_bet),
      result: bet.status_name || bet.status,
    }],
  }));
}

async function createBetsForUser(userId, payload) {
  const selections = Array.isArray(payload?.selections) ? payload.selections : [payload];
  const amount = Number(payload?.stake ?? payload?.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    const error = new Error('El monto de la apuesta debe ser mayor que cero');
    error.statusCode = 400;
    throw error;
  }
  if (selections.length === 0 || selections.some((selection) => !selection?.matchId || !selection?.oddId)) {
    const error = new Error('La apuesta debe incluir un partido y una cuota válidos');
    error.statusCode = 400;
    throw error;
  }

  const pool = await getConnection();
  const transaction = new sql.Transaction(pool);
  await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
  let committed = false;

  try {
    const customerResult = await new sql.Request(transaction)
      .input('userId', sql.Int, userId)
      .query(`
        SELECT TOP 1 c.id AS customer_id, a.id AS account_id
        FROM customer AS c
        INNER JOIN account AS a ON a.customer_id = c.id AND a.status = 1
        WHERE c.user_id = @userId
        ORDER BY a.id
      `);
    const customer = customerResult.recordset[0];
    if (!customer) {
      const error = new Error('El usuario no tiene una cuenta activa');
      error.statusCode = 400;
      throw error;
    }

    const balanceResult = await new sql.Request(transaction)
      .input('accountId', sql.Int, customer.account_id)
      .query(`
        SELECT TOP 1 resulting_balance
        FROM balance_movement WITH (UPDLOCK, HOLDLOCK)
        WHERE account_id = @accountId
        ORDER BY id DESC
      `);
    const currentBalance = Number(balanceResult.recordset[0]?.resulting_balance || 0);
    if (amount > currentBalance) {
      const error = new Error('Fondos insuficientes para realizar la apuesta');
      error.statusCode = 400;
      throw error;
    }

    const amountPerSelection = Math.round((amount / selections.length) * 100) / 100;
    const createdBets = [];
    for (const [index, selection] of selections.entries()) {
      const oddResult = await new sql.Request(transaction)
        .input('matchId', sql.Int, Number(selection.matchId))
        .input('oddId', sql.Int, Number(selection.oddId))
        .query(`
          SELECT o.id, o.odd_value, m.status AS match_status
          FROM odds AS o
          INNER JOIN [match] AS m ON m.id = o.match_id
          WHERE o.id = @oddId AND o.match_id = @matchId
        `);
      const odd = oddResult.recordset[0];
      if (!odd || [2, 3].includes(Number(odd.match_status))) {
        const error = new Error('El partido o la cuota ya no están disponibles para apostar');
        error.statusCode = 400;
        throw error;
      }

      const oddValue = Number(odd.odd_value);
      const result = await new sql.Request(transaction)
        .input('customerId', sql.Int, customer.customer_id)
        .input('matchId', sql.Int, Number(selection.matchId))
        .input('oddId', sql.Int, Number(selection.oddId))
        .input(
          'amount',
          sql.Decimal(12, 2),
          index === selections.length - 1
            ? amount - (amountPerSelection * (selections.length - 1))
            : amountPerSelection,
        )
        .input('oddValue', sql.Decimal(6, 2), oddValue)
        .input(
          'potentialPayout',
          sql.Decimal(12, 2),
          (index === selections.length - 1
            ? amount - (amountPerSelection * (selections.length - 1))
            : amountPerSelection) * oddValue,
        )
        .input('status', sql.TinyInt, 0)
        .query(`
          INSERT INTO bet
            (customer_id, match_id, odd_id, amount, odd_value_at_bet, potential_payout, status)
          OUTPUT INSERTED.*
          VALUES (@customerId, @matchId, @oddId, @amount, @oddValue, @potentialPayout, @status)
        `);
      createdBets.push(result.recordset[0]);
    }

    const nextBalance = currentBalance - amount;
    await new sql.Request(transaction)
      .input('accountId', sql.Int, customer.account_id)
      .input('type', sql.TinyInt, 3)
      .input('amount', sql.Decimal(12, 2), amount)
      .input('resultingBalance', sql.Decimal(12, 2), nextBalance)
      .query(`
        INSERT INTO balance_movement (account_id, type, amount, resulting_balance)
        VALUES (@accountId, @type, @amount, @resultingBalance)
      `);

    await transaction.commit();
    committed = true;
    return { bets: createdBets, balance: nextBalance };
  } catch (error) {
    if (!committed) await transaction.rollback();
    throw error;
  }
}

module.exports = {
  listRecords,
  createRecord,
  getRecord,
  getUserBalance,
  createBalanceMovement,
  listUserBets,
  createBetsForUser,
};
