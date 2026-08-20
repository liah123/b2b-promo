const authService = require('../services/auth.service');

async function signup(req, res, next) {
  try {
    const user = await authService.signup(req.body);
    res.status(201).json(user);
  } catch (err) {
    next(err);
  }
}

async function login(req, res, next) {
  try {
    const { accessToken, refreshToken, user } = await authService.login(req.body);
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/auth',
    });
    res.status(200).json({ accessToken, user });
  } catch (err) {
    next(err);
  }
}

async function refresh(req, res, next) {
  try {
    const { accessToken } = await authService.refreshAccessToken(req.cookies.refreshToken);
    res.status(200).json({ accessToken });
  } catch (err) {
    next(err);
  }
}

async function logout(req, res, next) {
  try {
    await authService.logout(req.cookies.refreshToken);
    res.clearCookie('refreshToken', { path: '/auth' });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

module.exports = { signup, login, refresh, logout };
