const nodemailer = require('nodemailer');

let cachedTransporter = null;
let cachedMode = null;

function buildTransporter() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS || process.env.SMTP_PASSWORD;
  const secure = String(process.env.SMTP_SECURE || 'false') === 'true';
  const mailMode = String(process.env.MAIL_MODE || 'smtp').toLowerCase();

  // Explicit local/dev mode.
  if (mailMode === 'log') {
    cachedMode = 'log';
    return nodemailer.createTransport({ jsonTransport: true });
  }

  // In SMTP mode we should not silently fallback, otherwise production appears successful while no email is sent.
  if (!host || !user || !pass) {
    cachedMode = 'unconfigured';
    return null;
  }

  cachedMode = 'smtp';
  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });
}

function getMailer() {
  if (!cachedTransporter) {
    cachedTransporter = buildTransporter();
  }
  return {
    transporter: cachedTransporter,
    mode: cachedMode || 'unconfigured',
  };
}

function getMailFrom() {
  return process.env.EMAIL_FROM
    || process.env.SMTP_FROM
    || process.env.SMTP_FROM_EMAIL
    || process.env.SMTP_USER
    || 'no-reply@societyos.local';
}

function getAuthenticatedSender() {
  return process.env.SMTP_USER || '';
}

module.exports = {
  getMailer,
  getMailFrom,
  getAuthenticatedSender,
};
