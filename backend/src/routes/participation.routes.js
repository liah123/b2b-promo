const express = require('express');
const authGuard = require('../middleware/authGuard');
const roleGuard = require('../middleware/roleGuard');
const controller = require('../controllers/participation.controller');

const router = express.Router();

router.post('/', authGuard, controller.join);
router.get('/me', authGuard, controller.listMine);
router.get('/', authGuard, roleGuard, controller.listByMission);
router.post('/:participationId/complete', authGuard, controller.complete);
router.post('/:participationId/confirm', authGuard, roleGuard, controller.confirm);

module.exports = router;
