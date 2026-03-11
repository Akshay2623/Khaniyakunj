const express = require('express');
const { protect, authorizeRoles } = require('../middleware/authMiddleware');
const { ROLES } = require('../constants/roles');
const { createPoll, getPolls, votePoll, closePoll, deletePoll } = require('../controllers/pollController');

const router = express.Router();

router.get('/', protect, getPolls);
router.post('/', protect, authorizeRoles(ROLES.ADMIN, ROLES.SUPER_ADMIN), createPoll);
router.put('/:id/vote', protect, votePoll);
router.put('/:id/close', protect, authorizeRoles(ROLES.ADMIN, ROLES.SUPER_ADMIN), closePoll);
router.delete('/:id', protect, authorizeRoles(ROLES.ADMIN, ROLES.SUPER_ADMIN), deletePoll);

module.exports = router;
