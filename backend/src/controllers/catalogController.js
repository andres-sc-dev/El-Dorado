const { getConnection } = require('../config/db');
const { catalogDefinitions } = require('../domain/domainDefinitions');

async function listCatalogs(request, response, next) {
  try {
    const pool = await getConnection();
    const result = {};

    for (const [key, definition] of Object.entries(catalogDefinitions)) {
      const queryResult = await pool.request().query(
        `SELECT [${definition.idColumn}] AS [id], [name] FROM [${definition.table}] ORDER BY [${definition.idColumn}]`,
      );
      result[key] = queryResult.recordset;
    }

    response.json(result);
  } catch (error) {
    next(error);
  }
}

async function listCatalog(request, response, next) {
  const definition = catalogDefinitions[request.params.name];
  if (!definition) {
    response.status(404).json({ error: 'Catálogo no encontrado' });
    return;
  }

  try {
    const pool = await getConnection();
    const result = await pool.request().query(
      `SELECT [${definition.idColumn}] AS [id], [name] FROM [${definition.table}] ORDER BY [${definition.idColumn}]`,
    );
    response.json(result.recordset);
  } catch (error) {
    next(error);
  }
}

module.exports = { listCatalogs, listCatalog };
