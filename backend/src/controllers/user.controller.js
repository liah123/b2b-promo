const userService = require('../services/user.service');

async function getMe(req, res, next) {
  try {
    const user = await userService.getMe(req.user.userId);
    res.status(200).json(user);
  } catch (err) { next(err); }
}

async function updateName(req, res, next) {
  try {
    const user = await userService.updateName(req.user.userId, req.body.name);
    res.status(200).json(user);
  } catch (err) { next(err); }
}

async function changePassword(req, res, next) {
  try {
    const { currentPassword, newPassword } = req.body;
    await userService.changePassword(req.user.userId, { currentPassword, newPassword });
    res.status(204).end();
  } catch (err) { next(err); }
}

module.exports = { getMe, updateName, changePassword };
