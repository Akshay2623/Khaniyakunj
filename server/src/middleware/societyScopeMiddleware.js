const mongoose = require('mongoose');
const { ROLES, normalizeRole } = require('../constants/roles');

function injectSocietyScope(req, res, next) {
  const role = normalizeRole(req.user?.role);
  const isSuperAdmin = role === ROLES.SUPER_ADMIN;

  req.scope = {
    role,
    isSuperAdmin,
    societyId: req.user?.societyId || null,
  };

  return next();
}

function ensureSocietyAccess(req, res, next) {
  if (!req.scope) {
    return res.status(500).json({ success: false, message: 'Scope not initialized.', data: null });
  }

  if (req.scope.isSuperAdmin) return next();
  if (!req.scope.societyId) return next();

  const targetSocietyId = req.params.id || req.params.societyId || req.body.societyId || req.query.societyId;

  if (!targetSocietyId) {
    return res.status(400).json({ success: false, message: 'societyId context is required.', data: null });
  }

  if (!mongoose.isValidObjectId(targetSocietyId)) {
    return res.status(400).json({ success: false, message: 'Invalid societyId.', data: null });
  }

  if (!req.scope.societyId || String(req.scope.societyId) !== String(targetSocietyId)) {
    return res.status(403).json({
      success: false,
      message: 'Forbidden: you can only manage your assigned society.',
      data: null,
    });
  }

  return next();
}

module.exports = {
  injectSocietyScope,
  ensureSocietyAccess,
};
