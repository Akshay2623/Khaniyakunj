const express = require('express');
const { listBuildings } = require('../controllers/buildingController');
const { protect, authorizeRoles } = require('../middleware/authMiddleware');
const { ROLES } = require('../constants/roles');

const router = express.Router();

router.get(
  '/',
  protect,
  authorizeRoles(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.COMMITTEE),
  listBuildings
);

module.exports = router;
