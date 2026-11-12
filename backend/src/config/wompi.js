const { unavailable } = require('../utils/httpError');

// Configuración de Wompi. Proyecto académico: SOLO se aceptan llaves de Sandbox.
// Según docs.wompi.co ("Ambientes y llaves"), las de Sandbox empiezan por
// pub_test_, prv_test_, test_events_ y test_integrity_, y la API es https://sandbox.wompi.co/v1.
// Con llaves de producción (pub_prod_...) se cobraría dinero real: los pagos se bloquean con 503.

const SANDBOX_PREFIXES = {
  publicKey: 'pub_test_',
  privateKey: 'prv_test_',
  eventsSecret: 'test_events_',
  integritySecret: 'test_integrity_',
};

function readLimits() {
  const min = Number(process.env.WOMPI_MIN_COP || 10000);
  const max = Number(process.env.WOMPI_MAX_COP || 3000000);
  if (!Number.isInteger(min) || !Number.isInteger(max) || min <= 0 || max < min) {
    throw new Error('WOMPI_MIN_COP y WOMPI_MAX_COP deben ser enteros con 0 < mínimo <= máximo');
  }
  return { min, max, currency: 'COP' };
}

function readConfig() {
  return {
    publicKey: (process.env.WOMPI_PUBLIC_KEY || '').trim(),
    privateKey: (process.env.WOMPI_PRIVATE_KEY || '').trim(),
    eventsSecret: (process.env.WOMPI_EVENTS_SECRET || '').trim(),
    integritySecret: (process.env.WOMPI_INTEGRITY_SECRET || '').trim(),
    apiUrl: (process.env.WOMPI_API_URL || 'https://sandbox.wompi.co/v1').trim().replace(/\/$/, ''),
    ...readLimits(),
  };
}

// Lista de problemas de configuración (vacía si todo es de Sandbox). Nunca incluye los valores.
function sandboxProblems(config = readConfig(), keys = Object.keys(SANDBOX_PREFIXES)) {
  const problems = [];
  for (const key of keys) {
    if (!config[key]) problems.push(`falta ${key}`);
    else if (!config[key].startsWith(SANDBOX_PREFIXES[key])) problems.push(`${key} no es de Sandbox`);
  }
  if (!/^https:\/\/sandbox\.wompi\.co\//.test(`${config.apiUrl}/`)) problems.push('WOMPI_API_URL no es la de Sandbox');
  return problems;
}

// Lanza 503 si las llaves que necesita esta operación no son de Sandbox.
function requireSandbox(keys) {
  const config = readConfig();
  const problems = sandboxProblems(config, keys);
  if (problems.length) {
    throw unavailable('Los pagos con Wompi no están configurados con llaves de Sandbox.', {
      errorCode: 'PAYMENTS_NOT_CONFIGURED', database: 'wompi', details: { problems },
    });
  }
  return config;
}

module.exports = { readConfig, readLimits, sandboxProblems, requireSandbox, SANDBOX_PREFIXES };
