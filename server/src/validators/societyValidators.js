const { body, param, query } = require('express-validator');

const societyIdParamValidator = [
  param('id').isMongoId().withMessage('Invalid society id.'),
];

const listSocietiesValidator = [
  query('page').optional().isInt({ min: 1 }).withMessage('page must be >= 1.'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('limit must be between 1 and 100.'),
  query('sortBy').optional().isIn(['createdAt', 'updatedAt', 'name', 'status']).withMessage('Invalid sortBy.'),
  query('sortOrder').optional().isIn(['asc', 'desc']).withMessage('sortOrder must be asc or desc.'),
  query('status').optional().isIn(['Active', 'Suspended', 'Archived']).withMessage('Invalid status filter.'),
  query('subscriptionPlan')
    .optional()
    .isIn(['Basic', 'Pro', 'Enterprise'])
    .withMessage('Invalid subscriptionPlan filter.'),
  query('search').optional().isString().trim().isLength({ max: 120 }),
];

const societyPayloadValidator = [
  body('name').optional().isString().trim().notEmpty().withMessage('name cannot be empty.'),
  body('legalName').optional().isString().trim().isLength({ max: 200 }),
  body('registrationNumber').optional().isString().trim().isLength({ max: 80 }),
  body('taxIdentificationNumber').optional().isString().trim().isLength({ max: 80 }),
  body('address')
    .optional()
    .custom((value) => typeof value === 'string' || (value && typeof value === 'object'))
    .withMessage('address must be a string or object.'),
  body('address.line1').optional().isString().trim().isLength({ max: 250 }),
  body('address.line2').optional().isString().trim().isLength({ max: 250 }),
  body('address.city').optional().isString().trim().isLength({ max: 120 }),
  body('address.state').optional().isString().trim().isLength({ max: 120 }),
  body('address.postalCode').optional().isString().trim().isLength({ max: 20 }),
  body('address.country').optional().isString().trim().isLength({ max: 120 }),
  body('timezone').optional().isString().trim().isLength({ max: 80 }),
  body('currency').optional().isString().trim().isLength({ min: 3, max: 3 }),
  body('contactEmail').optional().isEmail().withMessage('contactEmail must be valid.').normalizeEmail(),
  body('contactPhone').optional().isString().trim().isLength({ max: 30 }),
  body('website').optional().isURL().withMessage('website must be a valid URL.'),
  body('logoUrl').optional().isURL().withMessage('logoUrl must be a valid URL.'),
  body('totalUnits').optional().isInt({ min: 0 }),
  body('totalBuildings').optional().isInt({ min: 0 }),
  body('status').optional().isIn(['Active', 'Suspended', 'Archived']),
  body('subscriptionPlan').optional().isIn(['Basic', 'Pro', 'Enterprise']),
  // Backward compatibility fields:
  body('addressText').optional().isString(),
  body('totalFlats').optional().isInt({ min: 0 }),
  body('gstNumber').optional().isString(),
  body('logo').optional().isString(),
];

const createSocietyValidator = [
  body('name').trim().notEmpty().withMessage('name is required.'),
  ...societyPayloadValidator,
];

const updateSocietyValidator = [...societyPayloadValidator];

const settingsValidator = [
  body('maintenanceBillingDay').optional().isInt({ min: 1, max: 28 }),
  body('lateFeePercentage').optional().isFloat({ min: 0, max: 100 }),
  body('gracePeriodDays').optional().isInt({ min: 0 }),
  body('allowPartialPayments').optional().isBoolean(),
  body('enableVisitorManagement').optional().isBoolean(),
  body('enableAmenityBooking').optional().isBoolean(),
  body('enableOnlinePayments').optional().isBoolean(),
  body('enableVotingModule').optional().isBoolean(),
  body('languagePreference').optional().isString().trim().isLength({ max: 30 }),
  body('dateFormat').optional().isString().trim().isLength({ max: 30 }),
  body('timeFormat').optional().isIn(['12h', '24h']),
];

module.exports = {
  societyIdParamValidator,
  listSocietiesValidator,
  createSocietyValidator,
  updateSocietyValidator,
  settingsValidator,
};
