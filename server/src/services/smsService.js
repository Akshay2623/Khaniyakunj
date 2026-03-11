function normalizeToE164(phone, defaultCountryCode = '+91') {
  const digits = String(phone || '').replace(/\D+/g, '');
  if (!digits) return '';
  if (digits.length === 10) return `${defaultCountryCode}${digits}`;
  if (digits.startsWith('91') && digits.length === 12) return `+${digits}`;
  if (String(phone).trim().startsWith('+')) return `+${digits}`;
  return `+${digits}`;
}

async function sendSmsTwilio({ to, body }) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_NUMBER;
  const baseUrl = process.env.TWILIO_API_BASE_URL || 'https://api.twilio.com';

  if (!accountSid || !authToken || !from) {
    throw new Error('Twilio SMS is not configured.');
  }

  const endpoint = `${baseUrl}/2010-04-01/Accounts/${accountSid}/Messages.json`;
  const form = new URLSearchParams();
  form.append('To', to);
  form.append('From', from);
  form.append('Body', body);

  const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: form.toString(),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.message || 'Twilio SMS failed.');
  }
  return payload;
}

async function sendOtpSms({ phone, otp }) {
  const provider = String(process.env.SMS_PROVIDER || '').trim().toLowerCase();
  const smsEnabled = String(process.env.SMS_ENABLED || 'false').toLowerCase() === 'true';
  if (!smsEnabled) {
    throw new Error('SMS sending is disabled on server.');
  }

  const to = normalizeToE164(phone, process.env.SMS_DEFAULT_COUNTRY_CODE || '+91');
  if (!to) {
    throw new Error('Invalid phone number for SMS.');
  }

  const template = process.env.SMS_OTP_TEMPLATE || 'Your SocietyOS OTP is {{OTP}}. It expires in 5 minutes.';
  const body = template.replace('{{OTP}}', String(otp));

  if (provider === 'twilio') {
    return sendSmsTwilio({ to, body });
  }

  throw new Error('Unsupported SMS provider.');
}

module.exports = {
  sendOtpSms,
  normalizeToE164,
};
