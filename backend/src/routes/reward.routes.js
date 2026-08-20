const express = require('express');
const authGuard = require('../middleware/authGuard');
const roleGuard = require('../middleware/roleGuard');
const controller = require('../controllers/reward.controller');

const router = express.Router();

router.get('/', authGuard, controller.list);
router.post('/', authGuard, roleGuard, controller.create);
router.patch('/:rewardId', authGuard, roleGuard, controller.update);
router.patch('/:rewardId/status', authGuard, roleGuard, controller.updateStatus);

module.exports = router;
