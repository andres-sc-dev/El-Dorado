const { badRequest } = require('./httpError');

function requireText(value, fieldName) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw badRequest(`${fieldName} es obligatorio`);
  }
  return value.trim();
}

function parsePositiveInt(value, fieldName = 'El id') {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1) throw badRequest(`${fieldName} debe ser un entero positivo`);
  return number;
}

// true si la fecha (YYYY-MM-DD) existe y la persona tiene 18 años o más.
function isAdultBirthDate(birthDate) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) return false;

  const [year, month, day] = birthDate.split('-').map(Number);
  const birthDateUtc = new Date(Date.UTC(year, month - 1, day));
  // Rechaza fechas inexistentes como 31 de febrero, que JavaScript movería a marzo.
  if (
    birthDateUtc.getUTCFullYear() !== year
    || birthDateUtc.getUTCMonth() !== month - 1
    || birthDateUtc.getUTCDate() !== day
  ) {
    return false;
  }

  const today = new Date();
  let age = today.getUTCFullYear() - year;
  const birthdayHasNotArrived = today.getUTCMonth() < month - 1
    || (today.getUTCMonth() === month - 1 && today.getUTCDate() < day);
  if (birthdayHasNotArrived) age -= 1;

  return age >= 18 && birthDateUtc <= today;
}

module.exports = { requireText, parsePositiveInt, isAdultBirthDate };
