const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { normalizeRole } = require('../constants/roles');
const { ensureUserSocietyMapping } = require('../services/singleSocietyService');

function isUserActive(user) {
  if (!user) return false;
  if (user.isDeleted) return false;
  const status = String(user.status || '').trim().toLowerCase();
  if (!status) return Boolean(user.isActive);
  if (status === 'active') return true;
  return Boolean(user.isActive) && status !== 'suspended' && status !== 'inactive';
}

async function protect(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Unauthorized.' });
    }

    const token = authHeader.slice(7);
    const payload = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(payload.userId).select('-password');
    if (!user || !isUserActive(user)) {
      return res.status(401).json({ message: 'Unauthorized.' });
    }

    const supportedSingleSocietyRoles = ['super_admin', 'admin', 'committee', 'tenant', 'resident', 'owner', 'guard'];
    const normalizedRole = normalizeRole(user.role);
    const shouldAutoMapSociety = supportedSingleSocietyRoles.includes(normalizedRole);

    if (shouldAutoMapSociety) {
      await ensureUserSocietyMapping(user);
    }

    user.role = normalizedRole;
    req.user = user;
    return next();
  } catch (error) {
    if (error && (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError')) {
      return res.status(401).json({ message: 'Invalid or expired token.' });
    }
    return next(error);
  }
}

function authorizeRoles(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized.' });
    }

    if (!roles.includes(normalizeRole(req.user.role))) {
      return res.status(403).json({ message: 'Forbidden: insufficient role permissions.' });
    }

    next();
  };
}

module.exports = {
  protect,
  authorizeRoles,
};
