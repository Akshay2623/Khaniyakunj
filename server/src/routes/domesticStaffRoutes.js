const express = require('express');
const { protect, authorizeRoles } = require('../middleware/authMiddleware');
const { ROLES } = require('../constants/roles');
const {
  addStaff,
  editStaff,
  removeStaff,
  listMyStaff,
  listAllStaff,
  updateStaffStatus,
  requestStaffOtp,
  verifyStaffOtp,
  markStaffEntry,
  markStaffExit,
  listActiveEntries,
  listEntryLogs,
  listResidentStaffLogs,
} = require('../controllers/domesticStaffController');

const router = express.Router();

// Resident staff management
router.post('/staff', protect, authorizeRoles(ROLES.TENANT, ROLES.OWNER, ROLES.RESIDENT), addStaff);
router.put('/staff/:id', protect, authorizeRoles(ROLES.TENANT, ROLES.OWNER, ROLES.RESIDENT, ROLES.ADMIN, ROLES.SUPER_ADMIN), editStaff);
router.delete('/staff/:id', protect, authorizeRoles(ROLES.TENANT, ROLES.OWNER, ROLES.RESIDENT, ROLES.ADMIN, ROLES.SUPER_ADMIN), removeStaff);
router.get('/staff/my', protect, authorizeRoles(ROLES.TENANT, ROLES.OWNER, ROLES.RESIDENT), listMyStaff);
router.get('/staff/:staffId/logs', protect, authorizeRoles(ROLES.TENANT, ROLES.OWNER, ROLES.RESIDENT), listResidentStaffLogs);

// Guard OTP + entry flow
router.post('/otp/request', protect, authorizeRoles(ROLES.GUARD), requestStaffOtp);
router.post('/otp/verify', protect, authorizeRoles(ROLES.GUARD), verifyStaffOtp);
router.post('/entry', protect, authorizeRoles(ROLES.GUARD), markStaffEntry);
router.put('/entry/:logId/exit', protect, authorizeRoles(ROLES.GUARD), markStaffExit);
router.get('/entry/active', protect, authorizeRoles(ROLES.GUARD), listActiveEntries);

// Admin oversight
router.get('/staff', protect, authorizeRoles(ROLES.ADMIN, ROLES.SUPER_ADMIN), listAllStaff);
router.put('/staff/:id/status', protect, authorizeRoles(ROLES.ADMIN, ROLES.SUPER_ADMIN), updateStaffStatus);
router.get('/logs', protect, authorizeRoles(ROLES.ADMIN, ROLES.SUPER_ADMIN), listEntryLogs);

module.exports = router;
