const express = require('express');
const { protect, authorizeRoles } = require('../middleware/authMiddleware');
const { ROLES } = require('../constants/roles');
const {
  createLostItem,
  listLostItems,
  claimLostItem,
  closeLostItem,
} = require('../controllers/lostItemController');

const router = express.Router();

router.post('/', protect, authorizeRoles(ROLES.GUARD), createLostItem);
router.get(
  '/',
  protect,
  authorizeRoles(ROLES.ADMIN, ROLES.SUPER_ADMIN, ROLES.COMMITTEE, ROLES.TENANT, ROLES.RESIDENT, ROLES.OWNER, ROLES.GUARD),
  listLostItems
);
router.put('/:id/claim', protect, authorizeRoles(ROLES.ADMIN, ROLES.SUPER_ADMIN, ROLES.COMMITTEE, ROLES.TENANT, ROLES.RESIDENT, ROLES.OWNER), claimLostItem);
router.put('/:id/close', protect, authorizeRoles(ROLES.GUARD), closeLostItem);

module.exports = router;
