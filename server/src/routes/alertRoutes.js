const express = require('express');
const { protect, authorizeRoles } = require('../middleware/authMiddleware');
const { ROLES } = require('../constants/roles');
const { createAlert, getActiveAlerts, getAlertHistory, deleteAlert } = require('../controllers/alertController');

const router = express.Router();

router.post(
  '/alerts',
  protect,
  authorizeRoles(ROLES.ADMIN, ROLES.SUPER_ADMIN),
  createAlert
);

router.get(
  '/alerts/active',
  protect,
  authorizeRoles(ROLES.ADMIN, ROLES.SUPER_ADMIN, ROLES.COMMITTEE, ROLES.GUARD, ROLES.TENANT, ROLES.OWNER, ROLES.RESIDENT),
  getActiveAlerts
);

router.get(
  '/alerts/history',
  protect,
  authorizeRoles(ROLES.ADMIN, ROLES.SUPER_ADMIN),
  getAlertHistory
);

router.delete(
  '/alerts/:id',
  protect,
  authorizeRoles(ROLES.ADMIN, ROLES.SUPER_ADMIN),
  deleteAlert
);

module.exports = router;
