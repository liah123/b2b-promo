const express = require('express');

const router = express.Router();

router.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

router.use('/auth', require('./auth.routes'));
router.use('/missions', require('./mission.routes'));
router.use('/participations', require('./participation.routes'));
router.use('/stamps', require('./stamp.routes'));
router.use('/rewards', require('./reward.routes'));
router.use('/redemptions', require('./redemption.routes'));
router.use('/users', require('./user.routes'));

module.exports = router;
