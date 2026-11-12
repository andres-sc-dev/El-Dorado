// Política de contraseñas de El Dorado.
// La MISMA lista de reglas está en frontend/src/utils/passwordPolicy.js (la barra de fortaleza).
// test/passwordPolicy.test.js comprueba que las dos versiones den el mismo resultado.
// El backend la aplica SIEMPRE en el registro: la interfaz solo ayuda a cumplirla.

const MIN_LENGTH = 10;

function containsIdentity(password, value) {
  const text = String(value || '').trim().toLowerCase();
  return text.length >= 3 && password.toLowerCase().includes(text);
}

const RULES = [
  { id: 'MIN_LENGTH', label: `Al menos ${MIN_LENGTH} caracteres`, test: (password) => password.length >= MIN_LENGTH },
  { id: 'UPPERCASE', label: 'Una letra mayúscula', test: (password) => /[A-ZÁÉÍÓÚÑ]/.test(password) },
  { id: 'LOWERCASE', label: 'Una letra minúscula', test: (password) => /[a-záéíóúñ]/.test(password) },
  { id: 'NUMBER', label: 'Un número', test: (password) => /[0-9]/.test(password) },
  { id: 'SYMBOL', label: 'Un símbolo (por ejemplo ! # $ % & * -)', test: (password) => /[^A-Za-z0-9ÁÉÍÓÚÑáéíóúñ\s]/.test(password) },
  { id: 'NO_SPACES', label: 'Sin espacios', test: (password) => password.length > 0 && !/\s/.test(password) },
  {
    id: 'NO_USERNAME',
    label: 'No contiene tu usuario',
    test: (password, { username } = {}) => password.length > 0 && !containsIdentity(password, username),
  },
  {
    id: 'NO_EMAIL',
    label: 'No contiene tu correo',
    test: (password, { email } = {}) => {
      if (!password) return false;
      const localPart = String(email || '').split('@')[0];
      return !containsIdentity(password, email) && !containsIdentity(password, localPart);
    },
  },
];

// Nivel de 0 a 4 para la barra: 4 solo si se cumplen todas las reglas.
function strengthLevel(passedCount, total) {
  if (passedCount === total) return 4;
  if (passedCount >= total - 2) return 3;
  if (passedCount >= Math.ceil(total / 2)) return 2;
  return passedCount > 0 ? 1 : 0;
}

function evaluatePassword(password, context = {}) {
  const value = typeof password === 'string' ? password : '';
  const rules = RULES.map((rule) => ({ id: rule.id, label: rule.label, ok: rule.test(value, context) }));
  const failed = rules.filter((rule) => !rule.ok);
  return {
    valid: failed.length === 0,
    rules,
    failed: failed.map(({ id, label }) => ({ id, label })),
    level: strengthLevel(rules.length - failed.length, rules.length),
  };
}

module.exports = { evaluatePassword, RULES, MIN_LENGTH };
