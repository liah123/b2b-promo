const express = require('express');
const authGuard = require('../middleware/authGuard');
const controller = require('../controllers/redemption.controller');

const router = express.Router();

router.post('/', authGuard, controller.redeem);
router.get('/me', authGuard, controller.listMine);

module.exports = router;
