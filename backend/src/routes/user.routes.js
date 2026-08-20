const express = require('express');
const authGuard = require('../middleware/authGuard');
const controller = require('../controllers/user.controller');

const router = express.Router();

router.get('/me', authGuard, controller.getMe);
router.patch('/me', authGuard, controller.updateName);
router.patch('/me/password', authGuard, controller.changePassword);

module.exports = router;
