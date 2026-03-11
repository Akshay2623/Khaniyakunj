const { body, param, query } = require('express-validator');

const timePattern = /^([01]\d|2[0-3]):([0-5]\d)$/;

const amenityIdParamValidator = [param('id').isMongoId().withMessage('Invalid amenity id.')];
const bookingIdParamValidator = [param('bookingId').isMongoId().withMessage('Invalid booking id.')];

const createAmenityValidator = [
  body('name').isString().trim().notEmpty().withMessage('name is required.'),
  body('description').optional().isString().trim().isLength({ max: 500 }),
  body('location').optional().isString().trim().isLength({ max: 120 }),
  body('capacity').optional().isInt({ min: 1 }).withMessage('capacity must be at least 1.'),
  body('pricePerHour').optional().isFloat({ min: 0 }).withMessage('pricePerHour must be >= 0.'),
  body('openingTime').matches(timePattern).withMessage('openingTime must be HH:mm.'),
  body('closingTime').matches(timePattern).withMessage('closingTime must be HH:mm.'),
  body('bookingRequired').optional().isBoolean(),
  body('approvalRequired').optional().isBoolean(),
  body('isActive').optional().isBoolean(),
  body('societyId').optional().isMongoId().withMessage('societyId must be a valid ObjectId.'),
];

const updateAmenityValidator = [
  body('name').optional().isString().trim().notEmpty().withMessage('name cannot be empty.'),
  body('description').optional().isString().trim().isLength({ max: 500 }),
  body('location').optional().isString().trim().isLength({ max: 120 }),
  body('capacity').optional().isInt({ min: 1 }).withMessage('capacity must be at least 1.'),
  body('pricePerHour').optional().isFloat({ min: 0 }).withMessage('pricePerHour must be >= 0.'),
  body('openingTime').optional().matches(timePattern).withMessage('openingTime must be HH:mm.'),
  body('closingTime').optional().matches(timePattern).withMessage('closingTime must be HH:mm.'),
  body('bookingRequired').optional().isBoolean(),
  body('approvalRequired').optional().isBoolean(),
  body('isActive').optional().isBoolean(),
];

const createBookingValidator = [
  body('amenityId').isMongoId().withMessage('amenityId is required.'),
  body('unitId').optional().isMongoId().withMessage('unitId must be a valid ObjectId.'),
  body('bookingDate').isISO8601().withMessage('bookingDate must be valid date.'),
  body('startTime').matches(timePattern).withMessage('startTime must be HH:mm.'),
  body('endTime').matches(timePattern).withMessage('endTime must be HH:mm.'),
  body('totalGuests').optional().isInt({ min: 1 }).withMessage('totalGuests must be >= 1.'),
  body('specialRequest').optional().isString().trim().isLength({ max: 500 }),
  body('societyId').optional().isMongoId().withMessage('societyId must be a valid ObjectId.'),
];

const availabilityValidator = [
  query('amenityId').isMongoId().withMessage('amenityId is required.'),
  query('bookingDate').isISO8601().withMessage('bookingDate must be valid date.'),
  query('societyId').optional().isMongoId().withMessage('societyId must be a valid ObjectId.'),
];

const calendarValidator = [
  query('from').optional().isISO8601().withMessage('from must be valid date.'),
  query('to').optional().isISO8601().withMessage('to must be valid date.'),
  query('societyId').optional().isMongoId().withMessage('societyId must be a valid ObjectId.'),
];

const listAmenityValidator = [query('societyId').optional().isMongoId().withMessage('societyId must be a valid ObjectId.')];
const listBookingsValidator = [
  query('societyId').optional().isMongoId().withMessage('societyId must be a valid ObjectId.'),
  query('bookingDate').optional().isISO8601().withMessage('bookingDate must be valid date.'),
  query('amenityId').optional().isMongoId().withMessage('amenityId must be a valid ObjectId.'),
  query('status').optional().isIn(['Pending', 'Approved', 'Rejected', 'Completed']).withMessage('Invalid status.'),
];

module.exports = {
  amenityIdParamValidator,
  bookingIdParamValidator,
  createAmenityValidator,
  updateAmenityValidator,
  createBookingValidator,
  availabilityValidator,
  calendarValidator,
  listAmenityValidator,
  listBookingsValidator,
};

