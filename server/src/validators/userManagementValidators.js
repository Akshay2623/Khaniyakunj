const { body, param, query } = require('express-validator');
const { ROLES } = require('../constants/roles');

const createUserValidator = [
  body('name').trim().notEmpty().withMessage('name is required.'),
  body('email').isEmail().withMessage('valid email is required.').normalizeEmail(),
  body('phone').optional().isString().trim().isLength({ max: 30 }),
  body('password')
    .optional()
    .isString()
    .isLength({ min: 6 })
    .withMessage('temporary password must be at least 6 characters.'),
  body('role')
    .isIn([ROLES.RESIDENT, ROLES.OWNER, ROLES.TENANT, ROLES.COMMITTEE, ROLES.GUARD, ROLES.ADMIN])
    .withMessage('invalid role.'),
  body('societyId').optional().isMongoId().withMessage('societyId must be valid ObjectId.'),
  body('buildingId').optional().isMongoId().withMessage('buildingId must be valid ObjectId.'),
  body('unitId').optional().isMongoId().withMessage('unitId must be valid ObjectId.'),
  body('status').optional().isIn(['Active', 'Inactive', 'Suspended']),
  body('onboardingStatus').optional().isIn(['Pending', 'Completed']),
  body('joinedAt').optional().isISO8601().withMessage('joinedAt must be valid date.'),
  body('movedOutAt').optional().isISO8601().withMessage('movedOutAt must be valid date.'),
  body('emergencyContact').optional().isString().trim().isLength({ max: 120 }),
  body('profileImageUrl').optional().isURL().withMessage('profileImageUrl must be valid URL.'),
  body('languagePreference').optional().isString().trim().isLength({ max: 30 }),
  body('timezone').optional().isString().trim().isLength({ max: 80 }),
  body('sendInvite').optional().isBoolean(),
];

const updateUserValidator = [
  body('name').optional().trim().notEmpty().withMessage('name cannot be empty.'),
  body('email').optional().isEmail().withMessage('valid email is required.').normalizeEmail(),
  body('phone').optional().isString().trim().isLength({ max: 30 }),
  body('societyId').optional().isMongoId().withMessage('societyId must be valid ObjectId.'),
  body('buildingId').optional().isMongoId().withMessage('buildingId must be valid ObjectId.'),
  body('unitId').optional().isMongoId().withMessage('unitId must be valid ObjectId.'),
  body('status').optional().isIn(['Active', 'Inactive', 'Suspended']),
];

const listUsersValidator = [
  query('page').optional().isInt({ min: 1 }).withMessage('page must be a positive integer.'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('limit must be between 1 and 100.'),
  query('search').optional().isString().trim().isLength({ max: 120 }),
  query('societyId').optional().isMongoId().withMessage('societyId must be a valid ObjectId.'),
  query('role')
    .optional()
    .isIn([ROLES.RESIDENT, ROLES.OWNER, ROLES.TENANT, ROLES.COMMITTEE, ROLES.GUARD, ROLES.ADMIN, ROLES.SUPER_ADMIN])
    .withMessage('invalid role filter.'),
  query('status').optional().isIn(['Active', 'Inactive', 'Suspended']).withMessage('invalid status filter.'),
];

module.exports = {
  createUserValidator,
  updateUserValidator,
  userIdParamValidator: [param('id').isMongoId().withMessage('Invalid user id.')],
  roleChangeValidator: [
    body('role')
      .isIn([ROLES.OWNER])
      .withMessage('Only owner upgrade is supported in this endpoint.'),
  ],
  listUsersValidator,
};
