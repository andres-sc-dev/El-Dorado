const { getConnection, sql } = require('../config/db');
const { createBalanceMovement, getUserBalance } = require('../services/domainService');
const { comparePassword, hashPassword } = require('../utils/hash');
const { createToken } = require('../utils/token');
const { authenticate } = require('../middlewares/authenticate');

function getClientIp(request) {
  return request.ip ? request.ip.replace('::ffff:', '') : null;
}

function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.COOKIE_SECURE === 'true',
    sameSite: process.env.COOKIE_SAMESITE || 'lax',
    maxAge: 2 * 60 * 60 * 1000,
    path: '/',
  };
}

function requireText(value, fieldName) {
  if (typeof value !== 'string' || value.trim() === '') {
    const error = new Error(`${fieldName} es obligatorio`);
    error.statusCode = 400;
    throw error;
  }

  return value.trim();
}

function isAdultBirthDate(birthDate) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) {
    return false;
  }

  const [year, month, day] = birthDate.split('-').map(Number);
  const birthDateUtc = new Date(Date.UTC(year, month - 1, day));

  // Rechazamos fechas inexistentes como 31 de febrero, que JavaScript
  // convertiría automáticamente en una fecha distinta.
  if (
    birthDateUtc.getUTCFullYear() !== year
    || birthDateUtc.getUTCMonth() !== month - 1
    || birthDateUtc.getUTCDate() !== day
  ) {
    return false;
  }

  const today = new Date();
  let age = today.getUTCFullYear() - year;
  const birthdayHasNotArrived =
    today.getUTCMonth() < month - 1
    || (today.getUTCMonth() === month - 1 && today.getUTCDate() < day);

  if (birthdayHasNotArrived) {
    age -= 1;
  }

  return age >= 18 && birthDateUtc <= today;
}

async function login(request, response, next) {
  const body = request.body || {};
  const identifier = body.username || body.email;
  const password = body.password;

  try {
    const cleanIdentifier = requireText(identifier, 'El usuario o correo');
    requireText(password, 'La contraseña');

    const pool = await getConnection();
    // Los parámetros evitan concatenar datos del usuario dentro del SQL y
    // protegen contra inyección SQL.
    const result = await pool.request()
      .input('identifier', sql.NVarChar(150), cleanIdentifier)
      .query(`
        SELECT u.id, u.username, u.email, u.password_hash, u.status,
               c.full_name
        FROM users AS u
        LEFT JOIN customer AS c ON c.user_id = u.id
        WHERE u.username = @identifier OR u.email = @identifier
      `);

    const user = result.recordset[0];
    if (!user) {
      response.status(401).json({ error: 'Credenciales inválidas' });
      return;
    }

    const passwordMatches = await comparePassword(password, user.password_hash);
    if (!passwordMatches) {
      await pool.request()
        .input('userId', sql.Int, user.id)
        .input('ipAddress', sql.VarChar(45), getClientIp(request))
        .query(`
          INSERT INTO login_history (user_id, ip_address, successful)
          VALUES (@userId, @ipAddress, 0)
        `);

      response.status(401).json({ error: 'Credenciales inválidas' });
      return;
    }

    if (user.status !== 1) {
      response.status(403).json({ error: 'La cuenta está inactiva o bloqueada' });
      return;
    }

    await pool.request()
      .input('userId', sql.Int, user.id)
      .input('ipAddress', sql.VarChar(45), getClientIp(request))
      .query(`
        INSERT INTO login_history (user_id, ip_address, successful)
        VALUES (@userId, @ipAddress, 1)
      `);

    response.cookie('el_dorado_token', createToken(user.id), sessionCookieOptions());
    response.status(200).json({
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        fullName: user.full_name,
        isActive: true,
        role: 'user',
        balance: await getUserBalance(user.id),
        bonusBalance: 0,
      },
    });
  } catch (error) {
    if (error.statusCode) {
      response.status(error.statusCode).json({ error: error.message });
      return;
    }

    next(error);
  }
}

async function currentUser(request, response, next) {
  try {
    const pool = await getConnection();
    const result = await pool.request()
      .input('userId', sql.Int, request.user.userId)
      .query(`
        SELECT u.id, u.username, u.email, u.status, c.full_name
        FROM users AS u
        LEFT JOIN customer AS c ON c.user_id = u.id
        WHERE u.id = @userId
      `);
    const user = result.recordset[0];
    if (!user) {
      response.status(401).json({ error: 'Usuario no encontrado' });
      return;
    }
    response.json({
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        fullName: user.full_name,
        isActive: user.status === 1,
        role: 'user',
        balance: await getUserBalance(user.id),
        bonusBalance: 0,
      },
    });
  } catch (error) {
    next(error);
  }

}

async function balanceMovement(request, response, next) {
  const amount = Number(request.body?.amount);
  const type = request.path.endsWith('/deposit') ? 1 : 2;

  if (!Number.isFinite(amount) || amount <= 0) {
    response.status(400).json({ error: 'El monto debe ser mayor que cero' });
    return;
  }

  try {
    const balance = await createBalanceMovement(request.user.userId, type, amount);
    response.status(201).json({ balance });
  } catch (error) {
    next(error);
  }
}

function logout(request, response) {
  response.clearCookie('el_dorado_token', { ...sessionCookieOptions(), maxAge: undefined });
  response.status(204).send();
}

async function register(request, response, next) {
  const { fullName, documentNumber, birthDate, username, email, password } = request.body || {};

  try {
    const cleanFullName = requireText(fullName, 'El nombre completo');
    const cleanDocumentNumber = requireText(documentNumber, 'El documento');
    const cleanBirthDate = requireText(birthDate, 'La fecha de nacimiento');
    const cleanUsername = requireText(username, 'El usuario');
    const cleanEmail = requireText(email, 'El correo');
    requireText(password, 'La contraseña');

    if (!isAdultBirthDate(cleanBirthDate)) {
      response.status(400).json({ error: 'Debes tener al menos 18 años para registrarte' });
      return;
    }

    const passwordHash = await hashPassword(password);
    const pool = await getConnection();
    const transaction = new sql.Transaction(pool);

    // customer depende de users mediante una foreign key: primero creamos
    // users, recuperamos su ID y luego usamos ese ID en customer.
    await transaction.begin();
    try {
      const userResult = await new sql.Request(transaction)
        .input('username', sql.NVarChar(50), cleanUsername)
        .input('email', sql.NVarChar(150), cleanEmail)
        .input('passwordHash', sql.NVarChar(255), passwordHash)
        .query(`
          INSERT INTO users (username, email, password_hash)
          OUTPUT INSERTED.id
          VALUES (@username, @email, @passwordHash)
        `);

      const userId = userResult.recordset[0].id;
      await new sql.Request(transaction)
        .input('userId', sql.Int, userId)
        .input('fullName', sql.NVarChar(150), cleanFullName)
        .input('documentNumber', sql.NVarChar(30), cleanDocumentNumber)
        .input('birthDate', sql.Date, cleanBirthDate)
        .query(`
          INSERT INTO customer (user_id, full_name, document_number, birth_date)
          VALUES (@userId, @fullName, @documentNumber, @birthDate)
        `);

      await new sql.Request(transaction)
        .input('customerUserId', sql.Int, userId)
        .input('accountNumber', sql.NVarChar(30), `TDB-${userId}`)
        .query(`
          INSERT INTO account (customer_id, account_number, status)
          SELECT id, @accountNumber, 1
          FROM customer
          WHERE user_id = @customerUserId
        `);

      await transaction.commit();
      response.status(201).json({
        user: {
          id: userId,
          username: cleanUsername,
          email: cleanEmail,
          fullName: cleanFullName,
          isActive: true,
          role: 'user',
        },
      });
    } catch (error) {
      await transaction.rollback();
      if (error.number === 2601 || error.number === 2627) {
        response.status(409).json({ error: 'El usuario, correo o documento ya existe' });
        return;
      }
      throw error;
    }
  } catch (error) {
    if (error.statusCode) {
      response.status(error.statusCode).json({ error: error.message });
      return;
    }

    next(error);
  }
}

async function health(request, response, next) {
  try {
    const pool = await getConnection();
    const result = await pool.request().query(
      'SELECT @@SERVERNAME AS serverName, DB_NAME() AS databaseName, 1 AS connected',
    );
    response.status(200).json({
      status: 'ok',
      database: 'connected',
      serverName: result.recordset[0].serverName,
      databaseName: result.recordset[0].databaseName,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = { login, register, health, currentUser, logout, authenticate, balanceMovement };
