const express = require('express');
const { resources } = require('../repositories/publicResourceRepository');
const { createResourceController } = require('../controllers/resourceController');
const account = require('../controllers/accountController');
const bets = require('../controllers/betController');
const { authenticate } = require('../middleware/authenticate');
const { requireRole } = require('../middleware/requireRole');
const { requireDb } = require('../middleware/requireDb');
const { blockWrites } = require('../middleware/blockWrites');

const router = express.Router();

// ---------- Partidos (vista combinada MySQL + PostgreSQL + MongoDB) ----------
// Solo MySQL es obligatorio: sin PostgreSQL o MongoDB se muestran códigos en vez de nombres.
router.get('/matches', requireDb('mysql'), bets.listMatches);

// ---------- Apostar ----------
// Solo el rol USR. La apuesta toca los cuatro motores (ver services/bet.service.js).
router.post(
  ['/bets', '/bet'],
  authenticate,
  requireRole('USR'),
  requireDb('sqlserver', 'mysql', 'mongo', 'pg'),
  bets.placeBet,
);

// ---------- Datos del dueño de la sesión ----------
// Exigen sesión y devuelven solo lo del usuario del JWT. Las rutas por id de cliente
// o cuenta no existen: nadie puede pedir datos de otro usuario.
const ownerRoutes = [
  { paths: ['/customer', '/customers', '/me/customer'], db: ['sqlserver'], handler: account.getCustomer },
  { paths: ['/login_history', '/login-history'], db: ['sqlserver'], handler: account.listLoginHistory },
  { paths: ['/account', '/me/account'], db: ['pg'], handler: account.getAccount },
  { paths: ['/wallet/me'], db: ['pg'], handler: account.getWallet },
  { paths: ['/balance_movement', '/balance-movements'], db: ['pg'], handler: account.listMovements },
  // /bets/me va antes que /bets/:ticketCode.
  { paths: ['/bets/me', '/bet', '/bets'], db: ['pg', 'mysql'], handler: account.listBets },
  { paths: ['/bet/:ticketCode', '/bets/:ticketCode'], db: ['pg', 'mysql'], handler: account.getBet },
  { paths: ['/users/:id/balance'], db: ['pg'], handler: account.getUserBalance },
];
for (const { paths, db, handler } of ownerRoutes) {
  router.get(paths, authenticate, requireDb(...db), handler);
}

// ---------- Lecturas públicas por motor ----------
for (const [name, resource] of Object.entries(resources)) {
  const controller = createResourceController(name);
  const paths = [`/${name}`, ...resource.aliases.map((alias) => `/${alias}`)];
  router.get(paths, requireDb(resource.engine), controller.list);
  if (resource.byId) {
    router.get(paths.map((path) => `${path}/:id`), requireDb(resource.engine), controller.getById);
  }
}

// ---------- Escrituras genéricas ----------
// Cualquier POST/PUT/PATCH/DELETE que no se haya atendido arriba responde 403, con o sin
// sesión. Las únicas escrituras del administrador están en /api/admin (adminRoutes.js).
router.use(blockWrites);

module.exports = router;
