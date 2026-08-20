const redemptionService = require('../services/redemption.service');

async function redeem(req, res, next) {
  try {
    const redemption = await redemptionService.redeem({
      rewardId: req.body.rewardId,
      userId: req.user.userId,
    });
    res.status(201).json(redemption);
  } catch (err) {
    next(err);
  }
}

async function listMine(req, res, next) {
  try {
    const redemptions = await redemptionService.listMyRedemptions(req.user.userId);
    res.status(200).json(redemptions);
  } catch (err) {
    next(err);
  }
}

module.exports = { redeem, listMine };
