const { sql, withPool } = require('../../config/sqlserver');

// Acceso a la identidad en SQL Server: users, customer, login_history, role.
// Todas las consultas son parametrizadas.

const USER_COLUMNS = `
  u.id, u.username, u.email, u.password_hash, u.status, r.code AS role_code, c.full_name
`;

async function findByIdentifier(identifier) {
  return withPool(async (pool) => {
    const result = await pool.request()
      .input('identifier', sql.NVarChar(150), identifier)
      .query(`
        SELECT ${USER_COLUMNS}
        FROM dbo.users AS u
        INNER JOIN dbo.role AS r ON r.id_role = u.role_id
        LEFT JOIN dbo.customer AS c ON c.user_id = u.id
        WHERE u.username = @identifier OR u.email = @identifier
      `);
    return result.recordset[0] || null;
  });
}

async function findById(userId) {
  return withPool(async (pool) => {
    const result = await pool.request()
      .input('userId', sql.Int, userId)
      .query(`
        SELECT ${USER_COLUMNS}
        FROM dbo.users AS u
        INNER JOIN dbo.role AS r ON r.id_role = u.role_id
        LEFT JOIN dbo.customer AS c ON c.user_id = u.id
        WHERE u.id = @userId
      `);
    return result.recordset[0] || null;
  });
}

async function insertLoginHistory(userId, ipAddress, successful) {
  return withPool((pool) => pool.request()
    .input('userId', sql.Int, userId)
    .input('ipAddress', sql.VarChar(45), ipAddress)
    .input('successful', sql.Bit, successful ? 1 : 0)
    .query(`
      INSERT INTO dbo.login_history (user_id, ip_address, successful)
      VALUES (@userId, @ipAddress, @successful)
    `));
}

// Crea users y customer en una sola transacción de SQL Server. El rol siempre es USR.
async function createUserWithCustomer({
  username, email, passwordHash, fullName, documentTypeCode = 'CC', documentNumber, birthDate,
}) {
  return withPool(async (pool) => {
    const transaction = new sql.Transaction(pool);
    await transaction.begin();
    try {
      const userResult = await new sql.Request(transaction)
        .input('username', sql.NVarChar(50), username)
        .input('email', sql.NVarChar(150), email)
        .input('passwordHash', sql.Char(60), passwordHash)
        .query(`
          INSERT INTO dbo.users (username, email, password_hash, role_id)
          OUTPUT INSERTED.id
          SELECT @username, @email, @passwordHash, id_role FROM dbo.role WHERE code = 'USR'
        `);
      const userId = userResult.recordset[0].id;

      await new sql.Request(transaction)
        .input('userId', sql.Int, userId)
        .input('fullName', sql.NVarChar(150), fullName)
        .input('documentTypeCode', sql.VarChar(5), documentTypeCode)
        .input('documentNumber', sql.VarChar(20), documentNumber)
        .input('birthDate', sql.Date, birthDate)
        .query(`
          INSERT INTO dbo.customer (user_id, full_name, document_type_id, document_number, birth_date)
          SELECT @userId, @fullName, id_document_type, @documentNumber, @birthDate
          FROM dbo.document_type WHERE code = @documentTypeCode
        `);

      await transaction.commit();
      return { id: userId, username, email, fullName, roleCode: 'USR' };
    } catch (error) {
      await transaction.rollback().catch(() => {});
      throw error;
    }
  });
}

// Compensación: si la cuenta en PostgreSQL no se pudo crear, se borra el usuario recién creado.
async function deleteUser(userId) {
  return withPool((pool) => pool.request()
    .input('userId', sql.Int, userId)
    .query('DELETE FROM dbo.users WHERE id = @userId'));
}

// Crea o actualiza un usuario con su cliente (lo usa la semilla de demo).
async function upsertUserWithCustomer({
  username, email, passwordHash, fullName, documentNumber, birthDate, roleCode = 'USR',
}) {
  return withPool(async (pool) => {
    const result = await pool.request()
      .input('username', sql.NVarChar(50), username)
      .input('email', sql.NVarChar(150), email)
      .input('passwordHash', sql.Char(60), passwordHash)
      .input('roleCode', sql.Char(3), roleCode)
      .input('fullName', sql.NVarChar(150), fullName)
      .input('documentNumber', sql.VarChar(20), documentNumber)
      .input('birthDate', sql.Date, birthDate)
      .query(`
        SET XACT_ABORT ON;
        BEGIN TRANSACTION;
          DECLARE @roleId TINYINT = (SELECT id_role FROM dbo.role WHERE code = @roleCode);
          DECLARE @userId INT = (SELECT id FROM dbo.users WITH (UPDLOCK, HOLDLOCK) WHERE username = @username);
          IF @userId IS NULL
          BEGIN
            INSERT INTO dbo.users (username, email, password_hash, status, role_id)
            VALUES (@username, @email, @passwordHash, 1, @roleId);
            SET @userId = SCOPE_IDENTITY();
          END
          ELSE
            UPDATE dbo.users SET email = @email, password_hash = @passwordHash, status = 1, role_id = @roleId
            WHERE id = @userId;

          IF NOT EXISTS (SELECT 1 FROM dbo.customer WHERE user_id = @userId)
            INSERT INTO dbo.customer (user_id, full_name, document_type_id, document_number, birth_date)
            VALUES (@userId, @fullName, 1, @documentNumber, @birthDate);
        COMMIT;
        SELECT @userId AS id;
      `);
    return result.recordset[0].id;
  });
}

async function findCustomerByUserId(userId) {
  return withPool(async (pool) => {
    const result = await pool.request()
      .input('userId', sql.Int, userId)
      .query(`
        SELECT c.full_name, dt.code AS document_type, c.document_number, c.birth_date, c.phone, c.address
        FROM dbo.customer AS c
        INNER JOIN dbo.document_type AS dt ON dt.id_document_type = c.document_type_id
        WHERE c.user_id = @userId
      `);
    return result.recordset[0] || null;
  });
}

async function listLoginHistory(userId, limit = 20) {
  return withPool(async (pool) => {
    const result = await pool.request()
      .input('userId', sql.Int, userId)
      .input('limit', sql.Int, limit)
      .query(`
        SELECT TOP (@limit) login_time, ip_address, successful
        FROM dbo.login_history
        WHERE user_id = @userId
        ORDER BY login_time DESC, id DESC
      `);
    return result.recordset;
  });
}

module.exports = {
  findByIdentifier,
  findById,
  insertLoginHistory,
  createUserWithCustomer,
  deleteUser,
  upsertUserWithCustomer,
  findCustomerByUserId,
  listLoginHistory,
};
