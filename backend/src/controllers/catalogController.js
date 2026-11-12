const catalogService = require('../services/catalogService');

async function listCatalogs(request, response, next) {
  try {
    response.json(await catalogService.getAllCatalogs());
  } catch (error) {
    next(error);
  }
}

async function listCatalog(request, response, next) {
  try {
    response.json(await catalogService.getCatalog(request.params.name));
  } catch (error) {
    next(error);
  }
}

module.exports = { listCatalogs, listCatalog };
