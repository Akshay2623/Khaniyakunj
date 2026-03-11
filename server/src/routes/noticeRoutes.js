const express = require('express');
const {
  createNotice,
  updateNotice,
  deleteNotice,
  getResidentNotices,
  markNoticeAsRead,
} = require('../controllers/noticeController');
const { protect, authorizeRoles } = require('../middleware/authMiddleware');
const { ROLES } = require('../constants/roles');

const router = express.Router();

// Admin APIs
router.post('/', protect, authorizeRoles(ROLES.ADMIN, ROLES.SUPER_ADMIN), createNotice);
router.put('/:id', protect, authorizeRoles(ROLES.ADMIN, ROLES.SUPER_ADMIN), updateNotice);
router.delete('/:id', protect, authorizeRoles(ROLES.ADMIN, ROLES.SUPER_ADMIN), deleteNotice);

// All logged-in roles can view/read notices.
router.get(
  '/',
  protect,
  authorizeRoles(ROLES.ADMIN, ROLES.COMMITTEE, ROLES.TENANT, ROLES.OWNER, ROLES.RESIDENT, ROLES.GUARD, ROLES.SUPER_ADMIN),
  getResidentNotices
);
router.put(
  '/:id/read',
  protect,
  authorizeRoles(ROLES.ADMIN, ROLES.COMMITTEE, ROLES.TENANT, ROLES.OWNER, ROLES.RESIDENT, ROLES.GUARD, ROLES.SUPER_ADMIN),
  markNoticeAsRead
);

module.exports = router;
