const express = require('express');
const { resources } = require('../repositories/publicResourceRepository');
const { createResourceController } = require('../controllers/resourceController');
const account = require('../controllers/accountController');
const { authenticate } = require('../middleware/authenticate');
const { requireDb } = require('../middleware/requireDb');
const { blockWrites } = require('../middleware/blockWrites');

const router = express.Router();

// ---------- Datos del dueño de la sesión ----------
// Antes estos GET eran públicos y devolvían los datos de todos los clientes.
// Ahora exigen sesión y devuelven solo los del usuario del JWT.
// Las rutas /:id se eliminaron (salvo apuestas, filtradas por dueño).
const ownerRoutes = [
  { paths: ['/customer', '/customers', '/me/customer'], db: 'sqlserver', handler: account.getCustomer },
  { paths: ['/login_history', '/login-history'], db: 'sqlserver', handler: account.listLoginHistory },
  { paths: ['/account', '/me/account'], db: 'pg', handler: account.getAccount },
  { paths: ['/balance_movement', '/balance-movements'], db: 'pg', handler: account.listMovements },
  { paths: ['/bet', '/bets'], db: 'pg', handler: account.listBets },
  { paths: ['/bet/:id', '/bets/:id'], db: 'pg', handler: account.getBet },
  { paths: ['/users/:id/balance'], db: 'pg', handler: account.getUserBalance },
];
for (const { paths, db, handler } of ownerRoutes) {
  router.get(paths, authenticate, requireDb(db), handler);
}

// Apostar: con sesión, pero deshabilitado hasta la Fase 2 (funciones PL/pgSQL).
router.post(['/bets', '/bet'], authenticate, account.placeBetUnavailable);

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
// Parche de seguridad: cualquier POST/PUT/PATCH/DELETE que no se haya atendido arriba
// responde 403, con o sin sesión. Se habilitan para ADM en la Fase 2.
router.use(blockWrites);

module.exports = router;
