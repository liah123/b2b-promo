function roleGuard(req, res, next) {
  if (!req.user || req.user.role !== 'ADMIN') {
    return res.status(403).json({ message: '접근 권한이 없습니다' });
  }
  next();
}

module.exports = roleGuard;
