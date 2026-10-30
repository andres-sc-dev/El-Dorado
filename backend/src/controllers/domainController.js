const {
  listRecords, createRecord, getRecord, getUserBalance, listUserBets, createBetsForUser,
} = require('../services/domainService');
const { domainDefinitions } = require('../domain/domainDefinitions');

function validationError(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

function cleanValue(value, field) {
  if (typeof value === 'string') {
    const cleaned = value.trim();
    if (!cleaned) {
      throw validationError(`${field} es obligatorio`);
    }
    return cleaned;
  }
  return value;
}

function validatePayload(definition, payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw validationError('El cuerpo de la petición debe ser un objeto JSON');
  }

  for (const [field, config] of Object.entries(definition.columns)) {
    if (config.required && (payload[field] === undefined || payload[field] === null || payload[field] === '')) {
      throw validationError(`${field} es obligatorio`);
    }
  }

  if (definition.passwordRequired && (payload[definition.passwordField] === undefined
    || payload[definition.passwordField] === null || payload[definition.passwordField] === '')) {
    throw validationError(`${definition.passwordField} es obligatorio`);
  }
  if (definition.passwordRequired && typeof payload[definition.passwordField] !== 'string') {
    throw validationError(`${definition.passwordField} debe ser texto`);
  }
}

function publicRecord(record) {
  if (!record) return record;
  const safe = { ...record };
  delete safe.password_hash;
  delete safe.passwordHash;
  return safe;
}

function handleDatabaseError(error) {
  if (error.number === 2601 || error.number === 2627) {
    return Object.assign(new Error('Ya existe un registro con uno de los valores únicos enviados'), { statusCode: 409 });
  }
  if (error.number === 547) {
    return Object.assign(new Error('Una clave foránea no es válida o el registro está siendo utilizado'), { statusCode: 400 });
  }
  return error;
}

async function userBalance(request, response, next) {
  const userId = Number(request.params.id);
  if (!Number.isInteger(userId) || userId < 1) {
    response.status(400).json({ error: 'El id debe ser un entero positivo' });
    return;
  }
  if (!request.user || request.user.userId !== userId) {
    response.status(403).json({ error: 'No puedes consultar el saldo de otro usuario' });
    return;
  }
  try {
    response.json({ userId, balance: await getUserBalance(userId) });
  } catch (error) {
    next(handleDatabaseError(error));
  }
}

async function userBets(request, response, next) {
  try {
    response.json(await listUserBets(request.user.userId));
  } catch (error) {
    next(handleDatabaseError(error));
  }
}

async function userBetById(request, response, next) {
  const betId = Number(request.params.id);
  if (!Number.isInteger(betId) || betId < 1) {
    response.status(400).json({ error: 'El id debe ser un entero positivo' });
    return;
  }
  try {
    const bet = (await listUserBets(request.user.userId))
      .find((record) => Number(record.id) === betId);
    if (!bet) {
      response.status(404).json({ error: 'Apuesta no encontrada' });
      return;
    }
    response.json(bet);
  } catch (error) {
    next(handleDatabaseError(error));
  }
}

async function placeBets(request, response, next) {
  try {
    const result = await createBetsForUser(request.user.userId, request.body);
    response.status(201).json(result);
  } catch (error) {
    next(handleDatabaseError(error));
  }
}

function createController(name) {
  const definition = domainDefinitions[name];

  async function list(request, response, next) {
    try {
      const records = await listRecords(name);
      response.json(records.map(publicRecord));
    } catch (error) {
      next(handleDatabaseError(error));
    }
  }

  async function create(request, response, next) {
    if (definition.readOnly) {
      response.status(405).json({ error: 'Este recurso es de solo lectura' });
      return;
    }

    try {
      validatePayload(definition, request.body);
      const payload = { ...request.body };
      for (const [field, config] of Object.entries(definition.columns)) {
        if (config.private) continue;
        if (payload[field] !== undefined && payload[field] !== null && payload[field] !== '') {
          payload[field] = cleanValue(payload[field], field);
        }
      }
      if (definition.passwordField) {
        payload[definition.passwordField] = cleanValue(
          payload[definition.passwordField],
          definition.passwordField,
        );
      }
      response.status(201).json(publicRecord(await createRecord(name, payload)));
    } catch (error) {
      next(handleDatabaseError(error));
    }
  }

  async function getById(request, response, next) {
    const id = Number(request.params.id);
    if (!Number.isInteger(id) || id < 1) {
      response.status(400).json({ error: 'El id debe ser un entero positivo' });
      return;
    }
    try {
      const record = await getRecord(name, id);
      if (!record) {
        response.status(404).json({ error: 'Registro no encontrado' });
        return;
      }
      response.json(publicRecord(record));
    } catch (error) {
      next(handleDatabaseError(error));
    }
  }

  return { list, create, getById };
}

module.exports = {
  createController, publicRecord, handleDatabaseError, userBalance, userBets, userBetById, placeBets,
};
