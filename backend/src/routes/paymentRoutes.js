const express = require('express');
const payments = require('../controllers/paymentController');
const { authenticate } = require('../middleware/authenticate');
const { requireRole } = require('../middleware/requireRole');
const { requireDb } = require('../middleware/requireDb');

// Recargas con Wompi Sandbox. El webhook (sin JWT, cuerpo crudo) se monta aparte en server.js.
const router = express.Router();

router.get('/config', authenticate, payments.getConfig);
router.post('/prepare', authenticate, requireRole('USR'), payments.prepare);
// Pueden acreditar saldo, así que necesitan PostgreSQL. /transactions/:id va antes que /:reference.
router.get('/transactions/:transactionId', authenticate, requireDb('pg'), payments.verifyTransaction);
router.get('/:reference', authenticate, requireDb('pg'), payments.getStatus);

module.exports = router;
