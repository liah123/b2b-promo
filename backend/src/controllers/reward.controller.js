const rewardService = require('../services/reward.service');

async function create(req, res, next) {
  try {
    const reward = await rewardService.createReward(req.body);
    res.status(201).json(reward);
  } catch (err) { next(err); }
}

async function update(req, res, next) {
  try {
    const reward = await rewardService.updateReward(req.params.rewardId, req.body);
    res.status(200).json(reward);
  } catch (err) { next(err); }
}

async function updateStatus(req, res, next) {
  try {
    const reward = await rewardService.updateRewardStatus(req.params.rewardId, req.body.status);
    res.status(200).json(reward);
  } catch (err) { next(err); }
}

async function list(req, res, next) {
  try {
    const rewards = req.user.role === 'ADMIN'
      ? await rewardService.listAllRewards()
      : await rewardService.listRewardsForUser(req.user.userId);
    res.status(200).json(rewards);
  } catch (err) { next(err); }
}

module.exports = { create, list, update, updateStatus };
