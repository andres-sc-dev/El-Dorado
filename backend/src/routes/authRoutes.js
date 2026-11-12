const express = require('express');
const {
  login, register, currentUser, logout, depositDisabled, withdrawDisabled,
} = require('../controllers/authController');
const { authHealth } = require('../controllers/healthController');
const { authenticate } = require('../middleware/authenticate');
const { requireDb } = require('../middleware/requireDb');

const router = express.Router();

router.post('/login', requireDb('sqlserver'), login);
// El registro escribe en SQL Server (usuario) y en PostgreSQL (cuenta).
router.post('/register', requireDb('sqlserver', 'pg'), register);
router.get('/health', authHealth);
router.get('/me', authenticate, requireDb('sqlserver'), currentUser);
router.post('/logout', logout);
// Parche de seguridad: deshabilitados (403 con sesión, 401 sin ella).
router.post('/balance/deposit', authenticate, depositDisabled);
router.post('/balance/withdraw', authenticate, withdrawDisabled);

module.exports = router;
