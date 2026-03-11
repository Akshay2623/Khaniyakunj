const express = require('express');
const {
  generateMonthlyBillsBulk,
  getAllBills,
  getResidentBills,
  markBillAsPaid,
  getMonthlyRevenueReport,
} = require('../controllers/maintenanceController');
const { protect, authorizeRoles } = require('../middleware/authMiddleware');
const { ROLES } = require('../constants/roles');

const router = express.Router();

router.post(
  '/generate-bulk',
  protect,
  authorizeRoles(ROLES.ADMIN, ROLES.COMMITTEE),
  generateMonthlyBillsBulk
);
router.post(
  '/generate',
  protect,
  authorizeRoles(ROLES.ADMIN, ROLES.COMMITTEE),
  generateMonthlyBillsBulk
);
router.get(
  '/',
  protect,
  authorizeRoles(ROLES.ADMIN, ROLES.COMMITTEE),
  getAllBills
);
router.get(
  '/bills',
  protect,
  authorizeRoles(ROLES.ADMIN, ROLES.COMMITTEE),
  getAllBills
);
router.get('/my', protect, authorizeRoles(ROLES.TENANT, ROLES.OWNER, ROLES.RESIDENT), getResidentBills);
router.put(
  '/:id/pay',
  protect,
  authorizeRoles(ROLES.ADMIN, ROLES.COMMITTEE, ROLES.TENANT, ROLES.OWNER, ROLES.RESIDENT),
  markBillAsPaid
);
router.put(
  '/:id/mark-paid',
  protect,
  authorizeRoles(ROLES.ADMIN, ROLES.COMMITTEE, ROLES.TENANT, ROLES.OWNER, ROLES.RESIDENT),
  markBillAsPaid
);
router.get(
  '/reports/monthly-revenue',
  protect,
  authorizeRoles(ROLES.ADMIN, ROLES.COMMITTEE),
  getMonthlyRevenueReport
);
router.get(
  '/revenue',
  protect,
  authorizeRoles(ROLES.ADMIN, ROLES.COMMITTEE),
  getMonthlyRevenueReport
);

module.exports = router;
