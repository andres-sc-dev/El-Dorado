const express = require('express');
const {
  login, register, health, currentUser, logout, authenticate, balanceMovement,
} = require('../controllers/authController');

const router = express.Router();

router.post('/login', login);
router.post('/register', register);
router.get('/health', health);
router.get('/me', authenticate, currentUser);
router.post('/logout', logout);
router.post('/balance/deposit', authenticate, balanceMovement);
router.post('/balance/withdraw', authenticate, balanceMovement);

module.exports = router;
