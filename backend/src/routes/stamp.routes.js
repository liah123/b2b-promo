const express = require('express');
const authGuard = require('../middleware/authGuard');
const controller = require('../controllers/stamp.controller');

const router = express.Router();

router.get('/balance', authGuard, controller.getBalance);
router.get('/history', authGuard, controller.getHistory);

module.exports = router;
