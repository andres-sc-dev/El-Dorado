const express = require('express');
const { listCatalogs, listCatalog } = require('../controllers/catalogController');

const router = express.Router();

router.get('/', listCatalogs);
router.get('/:name', listCatalog);
router.post('/', (request, response) => {
  response.status(405).json({ error: 'Los catálogos son de solo lectura' });
});
router.post('/:name', (request, response) => {
  response.status(405).json({ error: 'Los catálogos son de solo lectura' });
});

module.exports = router;
