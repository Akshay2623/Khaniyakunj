const express = require('express');
const { getDashboardStats } = require('../controllers/dashboardController');
const { protect, authorizeRoles } = require('../middleware/authMiddleware');
const { ROLES } = require('../constants/roles');

const router = express.Router();

router.get(
  '/stats',
  protect,
  authorizeRoles(ROLES.ADMIN, ROLES.COMMITTEE, ROLES.TENANT, ROLES.GUARD),
  getDashboardStats
);

module.exports = router;
