const express = require('express');
const { createComplaint, getMyComplaints } = require('../controllers/serviceRequestController');
const { protect, authorizeRoles } = require('../middleware/authMiddleware');
const { ROLES } = require('../constants/roles');

const router = express.Router();

router.post('/', protect, authorizeRoles(ROLES.TENANT, ROLES.OWNER), createComplaint);
router.get('/my', protect, authorizeRoles(ROLES.TENANT, ROLES.OWNER), getMyComplaints);

module.exports = router;
