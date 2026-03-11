const express = require('express');
const {
  getResidents,
  createResident,
  getResidentById,
  updateResident,
  deleteResident,
  getMyResidentProfile,
  getResidentDashboard,
  getResidentFinancialAnalytics,
  getResidentActivity,
  updateResidentProfile,
  updateResidentDnd,
} = require('../controllers/residentController');
const { getResidentServiceHistory } = require('../controllers/serviceRequestController');
const { getResidentVisitors } = require('../controllers/visitorController');
const { protect, authorizeRoles } = require('../middleware/authMiddleware');
const { ROLES } = require('../constants/roles');

const router = express.Router();

router.get('/my-profile', protect, authorizeRoles(ROLES.TENANT, ROLES.RESIDENT, ROLES.OWNER), getMyResidentProfile);
router.get('/dashboard', protect, authorizeRoles(ROLES.TENANT, ROLES.RESIDENT, ROLES.OWNER), getResidentDashboard);
router.get('/service-history', protect, authorizeRoles(ROLES.TENANT, ROLES.RESIDENT, ROLES.OWNER), getResidentServiceHistory);
router.get('/visitors', protect, authorizeRoles(ROLES.TENANT, ROLES.RESIDENT, ROLES.OWNER), getResidentVisitors);
router.get('/activity', protect, authorizeRoles(ROLES.TENANT, ROLES.RESIDENT, ROLES.OWNER), getResidentActivity);
router.put('/profile', protect, authorizeRoles(ROLES.TENANT, ROLES.RESIDENT, ROLES.OWNER), updateResidentProfile);
router.put('/dnd', protect, authorizeRoles(ROLES.TENANT, ROLES.RESIDENT, ROLES.OWNER), updateResidentDnd);
router.get(
  '/financial-analytics',
  protect,
  authorizeRoles(ROLES.TENANT, ROLES.RESIDENT, ROLES.OWNER),
  getResidentFinancialAnalytics
);
router.get('/', protect, authorizeRoles(ROLES.ADMIN, ROLES.SUPER_ADMIN, ROLES.COMMITTEE), getResidents);
router.get('/:id', protect, authorizeRoles(ROLES.ADMIN, ROLES.SUPER_ADMIN, ROLES.COMMITTEE, ROLES.TENANT, ROLES.RESIDENT, ROLES.OWNER), getResidentById);
router.post('/', protect, authorizeRoles(ROLES.ADMIN, ROLES.SUPER_ADMIN), createResident);
router.post('/create', protect, authorizeRoles(ROLES.ADMIN, ROLES.SUPER_ADMIN), createResident);
router.put('/:id', protect, authorizeRoles(ROLES.ADMIN, ROLES.SUPER_ADMIN), updateResident);
router.delete('/:id', protect, authorizeRoles(ROLES.ADMIN, ROLES.SUPER_ADMIN), deleteResident);

module.exports = router;
