const express = require('express');
const {
  getMyFamilyMembers,
  addMyFamilyMember,
  updateMyFamilyMember,
  deleteMyFamilyMember,
  getFamilyFlatsOverview,
  getFamilyMembersByFlat,
  getFamilySummaryForCurrentUser,
} = require('../controllers/familyMemberController');
const { protect, authorizeRoles } = require('../middleware/authMiddleware');
const { ROLES } = require('../constants/roles');

const router = express.Router();

router.get('/summary', protect, authorizeRoles(ROLES.ADMIN, ROLES.SUPER_ADMIN, ROLES.COMMITTEE, ROLES.TENANT, ROLES.RESIDENT, ROLES.OWNER), getFamilySummaryForCurrentUser);
router.get('/me', protect, authorizeRoles(ROLES.RESIDENT, ROLES.TENANT, ROLES.OWNER), getMyFamilyMembers);
router.post('/me', protect, authorizeRoles(ROLES.RESIDENT, ROLES.TENANT, ROLES.OWNER), addMyFamilyMember);
router.put('/me/:id', protect, authorizeRoles(ROLES.RESIDENT, ROLES.TENANT, ROLES.OWNER), updateMyFamilyMember);
router.delete('/me/:id', protect, authorizeRoles(ROLES.RESIDENT, ROLES.TENANT, ROLES.OWNER), deleteMyFamilyMember);

router.get('/flats', protect, authorizeRoles(ROLES.ADMIN, ROLES.SUPER_ADMIN, ROLES.COMMITTEE), getFamilyFlatsOverview);
router.get('/flats/:flatId', protect, authorizeRoles(ROLES.ADMIN, ROLES.SUPER_ADMIN, ROLES.COMMITTEE), getFamilyMembersByFlat);

module.exports = router;
