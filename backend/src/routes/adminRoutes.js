const express = require('express');
const admin = require('../controllers/adminController');
const { authenticate } = require('../middleware/authenticate');
const { requireRole } = require('../middleware/requireRole');
const { requireDb } = require('../middleware/requireDb');

// Rutas de administración: sesión (401) y rol ADM (403) antes de tocar cualquier base.
const router = express.Router();
router.use(authenticate, requireRole('ADM'));

router.get('/matches', requireDb('mysql', 'pg'), admin.listMatches);
router.post('/matches/:matchCode/finish', requireDb('mysql', 'pg', 'mongo'), admin.finishMatch);

module.exports = router;
