const { body } = require('express-validator');
const { getRoleValues } = require('../constants/roles');

const STRONG_PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*[^A-Za-z0-9]).+$/;

const loginValidator = [
  body('email').isEmail().withMessage('Valid email is required.').normalizeEmail(),
  body('password')
    .isString()
    .customSanitizer((value) => String(value ?? ''))
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters.'),
];

const registerValidator = [
  body('name').trim().notEmpty().withMessage('Name is required.'),
  body('email').isEmail().withMessage('Valid email is required.').normalizeEmail(),
  body('password')
    .isString()
    .trim()
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters.'),
  body('role')
    .optional()
    .isIn(getRoleValues())
    .withMessage(`Role must be one of: ${getRoleValues().join(', ')}.`),
  body('societyId').optional().isMongoId().withMessage('societyId must be a valid MongoDB ObjectId.'),
];

const changePasswordValidator = [
  body('currentPassword')
    .isString()
    .trim()
    .isLength({ min: 6 })
    .withMessage('currentPassword must be at least 6 characters.'),
  body('newPassword')
    .isString()
    .trim()
    .isLength({ min: 8 })
    .withMessage('newPassword must be at least 8 characters.')
    .matches(STRONG_PASSWORD_REGEX)
    .withMessage('newPassword must include uppercase, lowercase, and special character.'),
];

const forgotPasswordValidator = [
  body('email').isEmail().withMessage('Valid email is required.').normalizeEmail(),
];

const resetPasswordValidator = [
  body('token').isString().trim().notEmpty().withMessage('Reset token is required.'),
  body('newPassword')
    .isString()
    .trim()
    .isLength({ min: 8 })
    .withMessage('newPassword must be at least 8 characters.')
    .matches(STRONG_PASSWORD_REGEX)
    .withMessage('newPassword must include uppercase, lowercase, and special character.'),
  body('confirmPassword')
    .isString()
    .trim()
    .custom((value, { req }) => value === req.body.newPassword)
    .withMessage('confirmPassword must match newPassword.'),
];

module.exports = {
  loginValidator,
  registerValidator,
  changePasswordValidator,
  forgotPasswordValidator,
  resetPasswordValidator,
};
