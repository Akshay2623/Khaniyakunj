const express = require('express');
const {
  preApproveVisitor,
  createVisitorRequest,
  getTenantVisitorRequests,
  approveVisitorRequest,
  rejectVisitorRequest,
  markVisitorEmergency,
  markEntry,
  markExit,
  getTodayVisitors,
  getVisitorLogs,
  getVisitorAnalytics,
} = require('../controllers/visitorController');
const { protect, authorizeRoles } = require('../middleware/authMiddleware');
const { ROLES } = require('../constants/roles');

const router = express.Router();

// Guard creates visitor request for tenant approval.
router.post(
  '/request',
  protect,
  authorizeRoles(ROLES.GUARD),
  createVisitorRequest
);

// Resident self pre-approval (legacy quick flow).
router.post('/', protect, authorizeRoles(ROLES.TENANT, ROLES.OWNER, ROLES.RESIDENT), preApproveVisitor);

// Tenant / owner approval queue.
router.get('/my-requests', protect, authorizeRoles(ROLES.TENANT, ROLES.OWNER, ROLES.RESIDENT), getTenantVisitorRequests);
router.put('/:id/approve', protect, authorizeRoles(ROLES.TENANT, ROLES.OWNER, ROLES.RESIDENT), approveVisitorRequest);
router.put('/:id/reject', protect, authorizeRoles(ROLES.TENANT, ROLES.OWNER, ROLES.RESIDENT), rejectVisitorRequest);
router.put('/:id/emergency', protect, authorizeRoles(ROLES.TENANT, ROLES.OWNER, ROLES.RESIDENT, ROLES.ADMIN, ROLES.COMMITTEE, ROLES.SUPER_ADMIN), markVisitorEmergency);

// Security
router.put('/:id/entry', protect, authorizeRoles(ROLES.GUARD), markEntry);
router.put('/:id/exit', protect, authorizeRoles(ROLES.GUARD), markExit);
router.get('/today', protect, authorizeRoles(ROLES.GUARD), getTodayVisitors);

// Admin / committee
router.get(
  '/logs',
  protect,
  authorizeRoles(ROLES.ADMIN, ROLES.COMMITTEE, ROLES.SUPER_ADMIN),
  getVisitorLogs
);
router.get(
  '/analytics',
  protect,
  authorizeRoles(ROLES.ADMIN, ROLES.COMMITTEE, ROLES.SUPER_ADMIN),
  getVisitorAnalytics
);

module.exports = router;
