const express = require('express');
const { listCatalogs, listCatalog } = require('../controllers/catalogController');
const catalogService = require('../services/catalogService');
const { requireDb } = require('../middleware/requireDb');

const router = express.Router();

// Cada catálogo vive en un motor: si ese motor está caído, solo ese catálogo responde 503.
function requireCatalogDb(request, response, next) {
  try {
    const { engine } = catalogService.getDefinition(request.params.name);
    requireDb(engine)(request, response, next);
  } catch (error) {
    next(error);
  }
}

router.get('/', listCatalogs);
router.get('/:name', requireCatalogDb, listCatalog);

module.exports = router;
