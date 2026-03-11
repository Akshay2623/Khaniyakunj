const express = require('express');
const { protect, authorizeRoles } = require('../middleware/authMiddleware');
const { ROLES } = require('../constants/roles');
const { createAnnouncement, getActiveAnnouncements } = require('../controllers/announcementController');

const router = express.Router();

router.post(
  '/admin/announcement',
  protect,
  authorizeRoles(ROLES.ADMIN, ROLES.SUPER_ADMIN),
  createAnnouncement
);

router.get(
  '/announcement/active',
  protect,
  authorizeRoles(ROLES.ADMIN, ROLES.SUPER_ADMIN, ROLES.COMMITTEE, ROLES.GUARD, ROLES.TENANT, ROLES.OWNER, ROLES.RESIDENT),
  getActiveAnnouncements
);

module.exports = router;
