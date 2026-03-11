const express = require('express');
const {
  listUsers,
  createUser,
  updateUser,
  deleteUser,
  deactivateUser,
  moveOutUser,
  changeUserRole,
  getUserActivities,
  resendInvite,
} = require('../controllers/userManagementController');
const { protect, authorizeRoles } = require('../middleware/authMiddleware');
const { ROLES } = require('../constants/roles');
const validateRequest = require('../middleware/validateRequest');
const {
  createUserValidator,
  updateUserValidator,
  userIdParamValidator,
  roleChangeValidator,
  listUsersValidator,
} = require('../validators/userManagementValidators');

const router = express.Router();

router.get(
  '/',
  protect,
  authorizeRoles(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  listUsersValidator,
  validateRequest,
  listUsers
);

router.post(
  '/',
  protect,
  authorizeRoles(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  createUserValidator,
  validateRequest,
  createUser
);

router.put(
  '/:id',
  protect,
  authorizeRoles(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  userIdParamValidator,
  updateUserValidator,
  validateRequest,
  updateUser
);

router.delete(
  '/:id',
  protect,
  authorizeRoles(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  userIdParamValidator,
  validateRequest,
  deleteUser
);

router.put(
  '/:id/deactivate',
  protect,
  authorizeRoles(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  userIdParamValidator,
  validateRequest,
  deactivateUser
);

router.put(
  '/:id/move-out',
  protect,
  authorizeRoles(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  userIdParamValidator,
  validateRequest,
  moveOutUser
);

router.put(
  '/:id/role',
  protect,
  authorizeRoles(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  userIdParamValidator,
  roleChangeValidator,
  validateRequest,
  changeUserRole
);

router.get(
  '/:id/activities',
  protect,
  authorizeRoles(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  userIdParamValidator,
  validateRequest,
  getUserActivities
);

router.post(
  '/:id/resend-invite',
  protect,
  authorizeRoles(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  userIdParamValidator,
  validateRequest,
  resendInvite
);

module.exports = router;
