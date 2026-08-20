const jwt = require('jsonwebtoken');

function authGuard(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ message: '인증 토큰이 필요합니다' });
  }
  const token = header.slice('Bearer '.length);
  try {
    const payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    req.user = { userId: payload.userId, role: payload.role };
    next();
  } catch (err) {
    res.status(401).json({ message: '유효하지 않거나 만료된 토큰입니다' });
  }
}

module.exports = authGuard;
