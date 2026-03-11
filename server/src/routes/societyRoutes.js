const express = require('express');
const {
  createSociety,
  getSocieties,
  getSocietyById,
  updateSociety,
  deleteSociety,
  getSocietySettings,
  updateSocietySettings,
  getSocietyOverview,
} = require('../controllers/societyController');
const { protect, authorizeRoles } = require('../middleware/authMiddleware');
const { ROLES } = require('../constants/roles');
const validateRequest = require('../middleware/validateRequest');
const {
  societyIdParamValidator,
  listSocietiesValidator,
  createSocietyValidator,
  updateSocietyValidator,
  settingsValidator,
} = require('../validators/societyValidators');
const { injectSocietyScope, ensureSocietyAccess } = require('../middleware/societyScopeMiddleware');

const router = express.Router();

router.use(protect, injectSocietyScope);

router.get(
  '/',
  authorizeRoles(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.COMMITTEE, ROLES.TENANT, ROLES.OWNER, ROLES.RESIDENT, ROLES.GUARD),
  listSocietiesValidator,
  validateRequest,
  getSocieties
);

router.post(
  '/',
  authorizeRoles(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  createSocietyValidator,
  validateRequest,
  createSociety
);

router.get(
  '/:id/settings',
  authorizeRoles(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.COMMITTEE),
  societyIdParamValidator,
  validateRequest,
  ensureSocietyAccess,
  getSocietySettings
);

router.put(
  '/:id/settings',
  authorizeRoles(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  societyIdParamValidator,
  settingsValidator,
  validateRequest,
  ensureSocietyAccess,
  updateSocietySettings
);

router.get(
  '/:id/overview',
  authorizeRoles(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.COMMITTEE),
  societyIdParamValidator,
  validateRequest,
  ensureSocietyAccess,
  getSocietyOverview
);

router.get(
  '/:id',
  authorizeRoles(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.COMMITTEE, ROLES.TENANT, ROLES.OWNER, ROLES.RESIDENT, ROLES.GUARD),
  societyIdParamValidator,
  validateRequest,
  ensureSocietyAccess,
  getSocietyById
);

router.put(
  '/:id',
  authorizeRoles(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  societyIdParamValidator,
  updateSocietyValidator,
  validateRequest,
  ensureSocietyAccess,
  updateSociety
);

router.delete(
  '/:id',
  authorizeRoles(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  societyIdParamValidator,
  validateRequest,
  ensureSocietyAccess,
  deleteSociety
);

module.exports = router;
