const express = require('express');
const {
  createComplaint,
  getMyComplaints,
  getAllComplaints,
  getAssignableUsers,
  assignServiceProvider,
  changePriority,
  getPendingComplaintsCount,
  getAssignedComplaints,
  updateAssignedStatus,
} = require('../controllers/serviceRequestController');
const { protect, authorizeRoles } = require('../middleware/authMiddleware');
const { ROLES } = require('../constants/roles');

const router = express.Router();

// Keep route-level auth broad and enforce role logic in controller for compatibility.
router.post('/', protect, createComplaint);
router.get('/my', protect, getMyComplaints);

// Role-aware listing (backend enforces creator/admin/guard visibility)
router.get(
  '/',
  protect,
  getAllComplaints
);
router.get(
  '/assignees',
  protect,
  authorizeRoles(ROLES.ADMIN, ROLES.SUPER_ADMIN, ROLES.COMMITTEE),
  getAssignableUsers
);
router.put(
  '/:id/assign',
  protect,
  authorizeRoles(ROLES.ADMIN, ROLES.SUPER_ADMIN, ROLES.COMMITTEE),
  assignServiceProvider
);
router.put(
  '/:id/priority',
  protect,
  authorizeRoles(ROLES.ADMIN, ROLES.SUPER_ADMIN),
  changePriority
);
router.get(
  '/stats/pending-count',
  protect,
  getPendingComplaintsCount
);

// Committee/guard assigned APIs
router.get('/assigned', protect, getAssignedComplaints);
router.put('/:id/status', protect, updateAssignedStatus);

module.exports = router;
