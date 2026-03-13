const express = require('express');
const { getDashboardStats } = require('../controllers/dashboardController');
const { protect, authorizeRoles } = require('../middleware/authMiddleware');
const { ROLES } = require('../constants/roles');

const router = express.Router();

router.get(
  '/stats',
  protect,
  authorizeRoles(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.COMMITTEE, ROLES.TENANT, ROLES.OWNER, ROLES.RESIDENT, ROLES.GUARD),
  getDashboardStats
);

module.exports = router;
