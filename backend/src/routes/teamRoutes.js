const express = require('express');
const teams = require('../controllers/teamController');

const router = express.Router();

// Escudos: no dependen de ninguna base de datos (Drive, archivo local o SVG genérico).
router.get('/:teamCode/crest', teams.getCrest);

module.exports = router;
