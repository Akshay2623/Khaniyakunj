const crypto = require('crypto');
const UserInvite = require('../models/UserInvite');
const { getMailer, getMailFrom, getAuthenticatedSender } = require('../config/mailer');

function generateTemporaryPassword(length = 12) {
  const charset = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
  const bytes = crypto.randomBytes(length);
  let pwd = '';
  for (let i = 0; i < length; i += 1) {
    pwd += charset[bytes[i] % charset.length];
  }
  return pwd;
}

function generateInviteToken() {
  return crypto.randomBytes(24).toString('hex');
}

function buildInviteEmail({ user, invite, temporaryPassword, locale = 'en-US', timezone = 'UTC' }) {
  const appBaseUrl = process.env.APP_BASE_URL || 'http://localhost:5173';
  const loginUrl = `${appBaseUrl}/auth`;
  const inviteUrl = `${appBaseUrl}/auth?invite=${invite.inviteToken}`;

  const subject = locale.startsWith('en')
    ? 'You are invited to SocietyOS'
    : 'SocietyOS invitation';

  const text = [
    `Hello ${user.name},`,
    '',
    'Your account has been created.',
    `Email: ${user.email}`,
    `Temporary password: ${temporaryPassword}`,
    `Login URL: ${loginUrl}`,
    `Invite link: ${inviteUrl}`,
    `Expires at: ${new Date(invite.expiresAt).toISOString()} (${timezone})`,
    '',
    'Please login and change your password on first login.',
  ].join('\n');

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #111827;">
      <h2>Welcome to SocietyOS</h2>
      <p>Hello <strong>${user.name}</strong>,</p>
      <p>Your account has been created by your administrator.</p>
      <p><strong>Email:</strong> ${user.email}</p>
      <p><strong>Temporary password:</strong> ${temporaryPassword}</p>
      <p><strong>Login URL:</strong> <a href="${loginUrl}">${loginUrl}</a></p>
      <p><strong>Invite link:</strong> <a href="${inviteUrl}">${inviteUrl}</a></p>
      <p><strong>Expires at:</strong> ${new Date(invite.expiresAt).toISOString()} (${timezone})</p>
      <p>Please login and change your password on first login.</p>
    </div>
  `;

  return { subject, text, html };
}

async function createUserInviteRecord({
  session,
  user,
  temporaryPassword,
  locale = 'en-US',
  timezone = 'UTC',
}) {
  const inviteToken = generateInviteToken();
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7);

  const invite = await UserInvite.create(
    [
      {
        userId: user._id,
        societyId: user.societyId,
        email: user.email,
        inviteToken,
        status: 'PENDING',
        expiresAt,
        locale,
        timezone,
        temporaryPassword,
        provider: 'smtp',
        providerMessage: 'Invite created and pending delivery.',
        lastSentAt: null,
      },
    ],
    { session }
  ).then((docs) => docs[0]);

  return invite;
}

async function dispatchUserInvite({ user, invite }) {
  const { transporter, mode } = getMailer();
  const from = getMailFrom();
  const sender = getAuthenticatedSender();
  const { subject, text, html } = buildInviteEmail({
    user,
    invite,
    temporaryPassword: invite.temporaryPassword,
    locale: invite.locale,
    timezone: invite.timezone,
  });

  try {
    if (!transporter || mode !== 'smtp') {
      throw new Error('Email service is not configured for SMTP.');
    }

    const info = await transporter.sendMail({
      from,
      ...(sender ? { sender } : {}),
      to: user.email,
      subject,
      text,
      html,
    });

    invite.status = 'SENT';
    invite.provider = mode === 'smtp' ? 'smtp' : 'log';
    invite.providerMessage = mode === 'smtp'
      ? `Delivered via SMTP (${info.messageId || 'message-id-unavailable'})`
      : `Logged via local transport (${info.messageId || 'json-transport'})`;
    invite.lastSentAt = new Date();
    await invite.save();

    return invite;
  } catch (error) {
    invite.status = 'FAILED';
    invite.provider = mode === 'smtp' ? 'smtp' : 'log';
    invite.providerMessage = error.message || 'Invite delivery failed.';
    await invite.save();
    throw error;
  }
}

module.exports = {
  generateTemporaryPassword,
  createUserInviteRecord,
  dispatchUserInvite,
};
