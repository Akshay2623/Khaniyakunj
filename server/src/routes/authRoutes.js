const express = require('express');
const {
  register,
  login,
  me,
  changePassword,
  forgotPassword,
  resetPassword,
  validateResetToken,
} = require('../controllers/authController');
const { protect, authorizeRoles } = require('../middleware/authMiddleware');
const validateRequest = require('../middleware/validateRequest');
const {
  loginValidator,
  registerValidator,
  changePasswordValidator,
  forgotPasswordValidator,
  resetPasswordValidator,
} = require('../validators/authValidators');
const { ROLES } = require('../constants/roles');

const router = express.Router();

router.post('/register', protect, authorizeRoles(ROLES.ADMIN), registerValidator, validateRequest, register);
router.post('/login', loginValidator, validateRequest, login);
router.post('/forgot-password', forgotPasswordValidator, validateRequest, forgotPassword);
router.get('/reset-password/validate', validateResetToken);
router.post('/reset-password', resetPasswordValidator, validateRequest, resetPassword);
router.get('/me', protect, me);
router.put('/change-password', protect, changePasswordValidator, validateRequest, changePassword);

module.exports = router;
