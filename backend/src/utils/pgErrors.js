// Traduce los errores de PostgreSQL a respuestas HTTP.
// Las funciones PL/pgSQL lanzan SQLSTATE P0001 con un código estable en el mensaje
// (ver database/postgres/03_bets.sql) y el texto para la persona en el detalle.

const BUSINESS_STATUS = {
  INVALID_AMOUNT: 400,
  INVALID_REFERENCE: 400,
  INVALID_STAKE: 400,
  STAKE_OUT_OF_RANGE: 400,
  INVALID_ODDS: 400,
  INVALID_MATCH: 400,
  INVALID_SELECTION: 400,
  INVALID_RESULT: 400,
  IDEMPOTENCY_KEY_REQUIRED: 400,
  ACCOUNT_INACTIVE: 403,
  ACCOUNT_NOT_FOUND: 404,
  BET_NOT_FOUND: 404,
  INSUFFICIENT_FUNDS: 409,
  IDEMPOTENCY_KEY_REUSED: 409,
  REFERENCE_CONFLICT: 409,
  BET_NOT_OPEN: 409,
};

function translatePgError(error) {
  if (!error || error.engine !== 'postgres') return null;

  if (error.code === 'P0001' && BUSINESS_STATUS[error.message]) {
    return { status: BUSINESS_STATUS[error.message], code: error.message, message: error.detail || error.message };
  }
  // Violación de UNIQUE: por ejemplo, la misma Idempotency-Key usada por dos usuarios a la vez.
  if (error.code === '23505') {
    return { status: 409, code: 'DUPLICATE', message: 'La operación ya fue registrada.' };
  }
  // Violación de CHECK: el último filtro de la base (saldo negativo, monto fuera de límites).
  if (error.code === '23514') {
    return { status: 400, code: 'CHECK_VIOLATION', message: 'Los datos no cumplen las reglas de la base de datos.' };
  }
  return null;
}

module.exports = { translatePgError, BUSINESS_STATUS };
