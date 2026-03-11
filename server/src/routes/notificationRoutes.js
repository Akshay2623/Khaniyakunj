const express = require('express');
const { protect, authorizeRoles } = require('../middleware/authMiddleware');
const { ROLES } = require('../constants/roles');
const {
  listMyNotifications,
  markNotificationAsRead,
  markAllAsRead,
  clearAllNotifications,
  streamNotifications,
} = require('../controllers/notificationController');

const router = express.Router();

router.get(
  '/',
  protect,
  authorizeRoles(ROLES.ADMIN, ROLES.SUPER_ADMIN, ROLES.COMMITTEE, ROLES.TENANT, ROLES.OWNER, ROLES.RESIDENT, ROLES.GUARD),
  listMyNotifications
);
router.put(
  '/:id/read',
  protect,
  authorizeRoles(ROLES.ADMIN, ROLES.SUPER_ADMIN, ROLES.COMMITTEE, ROLES.TENANT, ROLES.OWNER, ROLES.RESIDENT, ROLES.GUARD),
  markNotificationAsRead
);
router.put(
  '/read-all',
  protect,
  authorizeRoles(ROLES.ADMIN, ROLES.SUPER_ADMIN, ROLES.COMMITTEE, ROLES.TENANT, ROLES.OWNER, ROLES.RESIDENT, ROLES.GUARD),
  markAllAsRead
);
router.delete(
  '/clear-all',
  protect,
  authorizeRoles(ROLES.ADMIN, ROLES.SUPER_ADMIN, ROLES.COMMITTEE, ROLES.TENANT, ROLES.OWNER, ROLES.RESIDENT, ROLES.GUARD),
  clearAllNotifications
);
router.get('/stream', streamNotifications);

module.exports = router;
