const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const User = require('../models/User');
const { ROLES, getAllowedModulesByRole, normalizeRole } = require('../constants/roles');
const { signToken } = require('../config/jwt');
const { getMailer, getMailFrom, getAuthenticatedSender } = require('../config/mailer');
const asyncHandler = require('../utils/asyncHandler');

function isUserActiveState(user) {
  if (!user || user.isDeleted) return false;
  const status = String(user.status || '').trim().toLowerCase();
  if (!status) return Boolean(user.isActive);
  if (status === 'active') return true;
  return Boolean(user.isActive) && status !== 'suspended' && status !== 'inactive';
}

function getPasswordCandidates(value) {
  const raw = String(value ?? '');
  const trimmed = raw.trim();
  if (raw === trimmed) return [raw];
  return [raw, trimmed];
}

function sanitizeUser(user) {
  const joinedAt = user.joinedAt || user.createdAt || null;
  let joinedAtLocal = null;
  if (joinedAt) {
    try {
      joinedAtLocal = new Intl.DateTimeFormat('en-US', {
        timeZone: user.timezone || 'UTC',
        dateStyle: 'short',
        timeStyle: 'medium',
      }).format(new Date(joinedAt));
    } catch {
      joinedAtLocal = new Date(joinedAt).toISOString();
    }
  }

  return {
    id: user._id,
    name: user.name,
    email: user.email,
    role: normalizeRole(user.role),
    phone: user.phone || '',
    languagePreference: user.languagePreference || 'en-US',
    timezone: user.timezone || 'UTC',
    societyId: user.societyId || null,
    buildingId: user.buildingId || null,
    unitId: user.unitId || null,
    status: user.status || (user.isActive ? 'Active' : 'Inactive'),
    onboardingStatus: user.onboardingStatus || 'Pending',
    onboardingWorkflow: user.onboardingWorkflow || null,
    mustChangePassword: Boolean(user.mustChangePassword),
    joinedAt,
    joinedAtLocal,
    isActive: user.isActive,
    createdAt: user.createdAt,
  };
}

function buildResetPasswordEmail({ userName, resetUrl }) {
  const subject = 'Password Reset Request';
  const text = [
    `Hello ${userName},`,
    '',
    'You requested to reset your password for your SocietyOS account.',
    '',
    'Click the link below to reset your password:',
    resetUrl,
    '',
    'This link will expire in 30 minutes.',
    '',
    'If you did not request this, please ignore this email.',
  ].join('\n');

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #111827;">
      <h2>Password Reset Request</h2>
      <p>Hello <strong>${userName}</strong>,</p>
      <p>You requested to reset your password for your SocietyOS account.</p>
      <p>Click the link below to reset your password:</p>
      <p><a href="${resetUrl}">${resetUrl}</a></p>
      <p>This link will expire in <strong>30 minutes</strong>.</p>
      <p>If you did not request this, please ignore this email.</p>
    </div>
  `;

  return { subject, text, html };
}

const register = asyncHandler(async (req, res) => {
  const { name, email, password, role = ROLES.TENANT, societyId = null } = req.body;

  const normalizedEmail = email.toLowerCase().trim();
  const existingUser = await User.findOne({ email: normalizedEmail });
  if (existingUser) {
    return res.status(409).json({ message: 'Email already registered.' });
  }

  const user = await User.create({
    name: name.trim(),
    email: normalizedEmail,
    password: String(password || '').trim(),
    role,
    societyId,
  });

  return res.status(201).json({
    success: true,
    message: 'User registered successfully.',
    data: {
      user: sanitizeUser(user),
    },
  });
});

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const normalizedEmail = email.toLowerCase().trim();
  const user = await User.findOne({ email: normalizedEmail, isDeleted: { $ne: true } });

  const activeState = isUserActiveState(user);
  if (!user || !activeState) {
    return res.status(401).json({ message: 'Invalid email or password.' });
  }

  // Backward compatibility for legacy users stored with passwordHash.
  const legacyHash = user.get('passwordHash');
  const passwordCandidates = getPasswordCandidates(password);
  let validPassword = false;
  for (const candidate of passwordCandidates) {
    // eslint-disable-next-line no-await-in-loop
    validPassword = user.password
      ? await user.comparePassword(candidate)
      : legacyHash
      ? await bcrypt.compare(candidate, legacyHash)
      : false;
    if (validPassword) break;
  }

  if (!validPassword) {
    return res.status(401).json({ message: 'Invalid email or password.' });
  }

  const token = signToken(user._id.toString());
  const safeUser = sanitizeUser(user);

  return res.status(200).json({
    success: true,
    message: 'Login successful.',
    token,
    requiresPasswordReset: Boolean(user.mustChangePassword),
    user: safeUser,
    admin: safeUser,
  });
});

const me = asyncHandler(async (req, res) => {
  const safeUser = sanitizeUser(req.user);

  return res.status(200).json({
    success: true,
    message: 'Profile fetched successfully.',
    user: safeUser,
    allowedModules: getAllowedModulesByRole(normalizeRole(req.user.role)),
  });
});

const changePassword = asyncHandler(async (req, res) => {
  const currentPassword = String(req.body.currentPassword || '').trim();
  const newPassword = String(req.body.newPassword || '').trim();
  const user = await User.findById(req.user._id);
  if (!user || user.isDeleted) {
    return res.status(404).json({ success: false, message: 'User not found.', data: null });
  }

  const legacyHash = user.get('passwordHash');
  const currentPasswordCandidates = getPasswordCandidates(req.body.currentPassword);
  let validPassword = false;
  for (const candidate of currentPasswordCandidates) {
    // eslint-disable-next-line no-await-in-loop
    validPassword = user.password
      ? await user.comparePassword(candidate)
      : legacyHash
      ? await bcrypt.compare(candidate, legacyHash)
      : false;
    if (validPassword) break;
  }

  if (!validPassword) {
    return res.status(401).json({ success: false, message: 'Current password is incorrect.', data: null });
  }

  if (currentPassword === newPassword) {
    return res.status(400).json({
      success: false,
      message: 'New password must be different from old password.',
      data: null,
    });
  }

  user.password = newPassword;
  user.mustChangePassword = false;
  user.temporaryPasswordIssuedAt = null;
  await user.save();

  const safeUser = sanitizeUser(user);

  return res.status(200).json({
    success: true,
    message: 'Password changed successfully.',
    data: {
      user: safeUser,
    },
  });
});

const forgotPassword = asyncHandler(async (req, res) => {
  const email = String(req.body.email || '').toLowerCase().trim();
  const user = await User.findOne({ email, isDeleted: { $ne: true } });

  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'No account found with this email.',
      data: null,
    });
  }

  const rawToken = crypto.randomBytes(32).toString('hex');
  const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

  user.resetPasswordToken = hashedToken;
  user.resetPasswordExpires = expiresAt;
  await user.save();

  const appBaseUrl = process.env.APP_BASE_URL || 'http://localhost:5173';
  const resetUrl = `${appBaseUrl}/reset-password?token=${rawToken}`;
  // Static sender from environment; recipient remains dynamic from forgot-password form input.
  const from = getMailFrom();
  const sender = getAuthenticatedSender();
  const recipientEmail = email;
  const { transporter, mode } = getMailer();
  if (!transporter || mode !== 'smtp') {
    return res.status(503).json({
      success: false,
      message: 'Email service is not configured for SMTP. Please contact admin.',
      data: null,
    });
  }
  const { subject, text, html } = buildResetPasswordEmail({
    userName: user.name || 'User',
    resetUrl,
  });

  try {
    await transporter.sendMail({
      from,
      ...(sender ? { sender } : {}),
      to: recipientEmail,
      subject,
      text,
      html,
    });
  } catch {
    user.resetPasswordToken = null;
    user.resetPasswordExpires = null;
    await user.save();
    return res.status(502).json({
      success: false,
      message: 'Failed to send reset email. Please try again.',
      data: null,
    });
  }

  return res.status(200).json({
    success: true,
    message: 'Reset link sent to your email.',
    data: { expiresAt },
  });
});

const resetPassword = asyncHandler(async (req, res) => {
  const { token } = req.body;
  const newPassword = String(req.body.newPassword || '').trim();
  const hashedToken = crypto.createHash('sha256').update(String(token)).digest('hex');

  const user = await User.findOne({
    resetPasswordToken: hashedToken,
    resetPasswordExpires: { $gt: new Date() },
    isDeleted: { $ne: true },
  });

  if (!user) {
    return res.status(400).json({
      success: false,
      message: 'Reset token is invalid or expired.',
      data: null,
    });
  }

  user.password = newPassword;
  user.mustChangePassword = false;
  user.temporaryPasswordIssuedAt = null;
  user.resetPasswordToken = null;
  user.resetPasswordExpires = null;
  await user.save();

  return res.status(200).json({
    success: true,
    message: 'Password reset successfully.',
    data: null,
  });
});

const validateResetToken = asyncHandler(async (req, res) => {
  const token = String(req.query.token || '').trim();
  if (!token) {
    return res.status(400).json({
      success: false,
      message: 'Reset token is required.',
      data: null,
    });
  }

  const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
  const user = await User.findOne({
    resetPasswordToken: hashedToken,
    resetPasswordExpires: { $gt: new Date() },
    isDeleted: { $ne: true },
  }).select('_id');

  if (!user) {
    return res.status(400).json({
      success: false,
      message: 'Reset token is invalid or expired.',
      data: null,
    });
  }

  return res.status(200).json({
    success: true,
    message: 'Reset token is valid.',
    data: null,
  });
});

module.exports = {
  register,
  login,
  me,
  changePassword,
  forgotPassword,
  resetPassword,
  validateResetToken,
};
