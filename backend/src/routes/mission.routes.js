const express = require('express');
const authGuard = require('../middleware/authGuard');
const roleGuard = require('../middleware/roleGuard');
const controller = require('../controllers/mission.controller');

const router = express.Router();

router.get('/', authGuard, controller.list);
router.get('/:missionId', authGuard, controller.getById);
router.post('/', authGuard, roleGuard, controller.create);
router.patch('/:missionId', authGuard, roleGuard, controller.update);
router.patch('/:missionId/status', authGuard, roleGuard, controller.updateStatus);

module.exports = router;
