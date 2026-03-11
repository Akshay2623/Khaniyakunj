const express = require('express');
const { protect, authorizeRoles } = require('../middleware/authMiddleware');
const { ROLES } = require('../constants/roles');
const { askSocietyAssistant } = require('../controllers/aiAssistantController');

const router = express.Router();

router.post('/query', protect, authorizeRoles(ROLES.ADMIN, ROLES.SUPER_ADMIN), askSocietyAssistant);

module.exports = router;
