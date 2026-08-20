const stampService = require('../services/stamp.service');

async function getBalance(req, res, next) {
  try {
    const balances = await stampService.getBalances(req.user.userId);
    res.status(200).json(balances);
  } catch (err) {
    next(err);
  }
}

async function getHistory(req, res, next) {
  try {
    const history = await stampService.getHistory(req.user.userId);
    res.status(200).json(history);
  } catch (err) {
    next(err);
  }
}

module.exports = { getBalance, getHistory };
