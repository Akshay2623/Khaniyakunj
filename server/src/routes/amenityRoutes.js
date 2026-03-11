const express = require('express');
const { protect, authorizeRoles } = require('../middleware/authMiddleware');
const { ROLES } = require('../constants/roles');
const validateRequest = require('../middleware/validateRequest');
const {
  amenityIdParamValidator,
  bookingIdParamValidator,
  createAmenityValidator,
  updateAmenityValidator,
  createBookingValidator,
  availabilityValidator,
  calendarValidator,
  listAmenityValidator,
  listBookingsValidator,
} = require('../validators/amenityValidators');
const amenityController = require('../controllers/amenityController');

const router = express.Router();

router.post(
  '/',
  protect,
  authorizeRoles(ROLES.ADMIN, ROLES.SUPER_ADMIN),
  createAmenityValidator,
  validateRequest,
  amenityController.createAmenity
);
router.get(
  '/',
  protect,
  authorizeRoles(ROLES.ADMIN, ROLES.SUPER_ADMIN, ROLES.COMMITTEE, ROLES.TENANT, ROLES.OWNER, ROLES.RESIDENT, ROLES.GUARD),
  listAmenityValidator,
  validateRequest,
  amenityController.getAmenities
);
router.put(
  '/:id',
  protect,
  authorizeRoles(ROLES.ADMIN, ROLES.SUPER_ADMIN),
  amenityIdParamValidator,
  updateAmenityValidator,
  validateRequest,
  amenityController.updateAmenity
);
router.delete(
  '/:id',
  protect,
  authorizeRoles(ROLES.ADMIN, ROLES.SUPER_ADMIN),
  amenityIdParamValidator,
  validateRequest,
  amenityController.deleteAmenity
);

router.post(
  '/book',
  protect,
  authorizeRoles(ROLES.ADMIN, ROLES.SUPER_ADMIN, ROLES.COMMITTEE, ROLES.TENANT, ROLES.OWNER, ROLES.RESIDENT),
  createBookingValidator,
  validateRequest,
  amenityController.bookAmenity
);

router.get(
  '/my-bookings',
  protect,
  authorizeRoles(ROLES.ADMIN, ROLES.SUPER_ADMIN, ROLES.COMMITTEE, ROLES.TENANT, ROLES.OWNER, ROLES.RESIDENT),
  listBookingsValidator,
  validateRequest,
  amenityController.getMyBookings
);
router.get(
  '/all-bookings',
  protect,
  authorizeRoles(ROLES.ADMIN, ROLES.SUPER_ADMIN),
  listBookingsValidator,
  validateRequest,
  amenityController.getAllBookings
);
router.get(
  '/bookings',
  protect,
  authorizeRoles(ROLES.COMMITTEE),
  listBookingsValidator,
  validateRequest,
  amenityController.getCommitteeBookings
);
router.get(
  '/today-bookings',
  protect,
  authorizeRoles(ROLES.GUARD),
  listBookingsValidator,
  validateRequest,
  amenityController.getTodayBookingsForGuard
);

router.put(
  '/approve/:bookingId',
  protect,
  authorizeRoles(ROLES.ADMIN, ROLES.SUPER_ADMIN, ROLES.COMMITTEE),
  bookingIdParamValidator,
  validateRequest,
  amenityController.approveBooking
);
router.put(
  '/reject/:bookingId',
  protect,
  authorizeRoles(ROLES.ADMIN, ROLES.SUPER_ADMIN, ROLES.COMMITTEE),
  bookingIdParamValidator,
  validateRequest,
  amenityController.rejectBooking
);

router.get(
  '/availability',
  protect,
  authorizeRoles(ROLES.ADMIN, ROLES.SUPER_ADMIN, ROLES.COMMITTEE, ROLES.TENANT, ROLES.OWNER, ROLES.RESIDENT, ROLES.GUARD),
  availabilityValidator,
  validateRequest,
  amenityController.getAvailability
);
router.get(
  '/calendar',
  protect,
  authorizeRoles(ROLES.ADMIN, ROLES.SUPER_ADMIN, ROLES.COMMITTEE, ROLES.TENANT, ROLES.OWNER, ROLES.RESIDENT, ROLES.GUARD),
  calendarValidator,
  validateRequest,
  amenityController.getCalendar
);
router.get(
  '/analytics',
  protect,
  authorizeRoles(ROLES.ADMIN, ROLES.SUPER_ADMIN),
  listBookingsValidator,
  validateRequest,
  amenityController.getAnalytics
);

module.exports = router;
