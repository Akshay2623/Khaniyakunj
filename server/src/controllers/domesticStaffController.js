const Staff = require('../models/Staff');
const StaffOTP = require('../models/StaffOTP');
const StaffEntryLog = require('../models/StaffEntryLog');
const { createNotificationsForUsers } = require('../services/notificationService');
const { sendOtpSms } = require('../services/smsService');
const { resolveSingleSocietyId } = require('../services/singleSocietyService');

function normalizePhone(phone) {
  const digits = String(phone || '').replace(/\D+/g, '').trim();
  if (!digits) return '';
  if (digits.length >= 10) return digits.slice(-10);
  return digits;
}

function validatePhoneInput(phone) {
  const raw = String(phone || '');
  if (/[A-Za-z]/.test(raw)) {
    return 'Phone number cannot contain alphabets.';
  }
  const digits = normalizePhoneLoose(raw);
  if (digits.length !== 10) {
    return 'Phone number must be exactly 10 digits.';
  }
  return '';
}

function normalizePhoneLoose(phone) {
  return String(phone || '').replace(/\D+/g, '').trim();
}

function buildPhoneCandidates(phone) {
  const raw = String(phone || '').trim();
  const noSpaces = raw.replace(/\s+/g, '');
  const digits = normalizePhoneLoose(phone);
  const normalized = normalizePhone(phone);
  const variants = new Set([raw, noSpaces, digits, normalized]);
  if (digits.length === 10) {
    variants.add(`91${digits}`);
    variants.add(`+91${digits}`);
  }
  return Array.from(variants).filter(Boolean);
}

async function findStaffByPhone({ societyId, phone, status = 'active' }) {
  const candidates = buildPhoneCandidates(phone);
  let staff = await Staff.findOne({
    societyId,
    phone: { $in: candidates },
    status,
  });
  if (staff) return staff;

  // Backward-compatible fallback for previously stored phone formats.
  const targetDigits = normalizePhoneLoose(phone);
  if (!targetDigits) return null;

  const rows = await Staff.find({ societyId, status }).select(
    'name phone photo workType houseNumber residentId workingDays expectedEntryTime expectedExitTime status createdByResident societyId createdAt'
  );
  staff = rows.find((row) => {
    const rowDigits = normalizePhoneLoose(row.phone);
    return rowDigits === targetDigits || rowDigits.endsWith(targetDigits) || targetDigits.endsWith(rowDigits);
  });
  if (staff) return staff;

  // Last fallback for manual gate-entry convenience: allow partial match only when unique.
  const partialMatches = rows.filter((row) => {
    const rowDigits = normalizePhoneLoose(row.phone);
    return rowDigits.includes(targetDigits) || targetDigits.includes(rowDigits);
  });
  if (partialMatches.length === 1) return partialMatches[0];

  return null;
}

function dateKey(date = new Date()) {
  return new Date(date).toISOString().slice(0, 10);
}

function generateOtp() {
  return String(Math.floor(1000 + Math.random() * 9000));
}

async function sendOtpToPhone(phone, otp) {
  try {
    await sendOtpSms({ phone, otp });
    return { delivered: true };
  } catch {
    // Fallback for local testing when SMS is not configured.
    // eslint-disable-next-line no-console
    console.log(`[DomesticStaffOTP] phone=${phone} otp=${otp}`);
    return { delivered: false };
  }
}

async function requireSocietyId(req, res) {
  const resolvedSocietyId = await resolveSingleSocietyId({
    user: req.user,
    requestedSocietyId: req.query?.societyId || req.body?.societyId || null,
  });
  if (resolvedSocietyId && req.user && !req.user.societyId) {
    req.user.societyId = resolvedSocietyId;
  }
  if (!req.user?.societyId) {
    res.status(400).json({ message: 'User is not mapped to a society.' });
    return false;
  }
  return true;
}

function normalizeRole(role) {
  return String(role || '').toLowerCase();
}

function resolveAdminSocietyScope(req) {
  const requestedSocietyId = String(req.query?.societyId || req.body?.societyId || '').trim();
  if (req.user?.societyId) {
    return { societyId: req.user.societyId, global: false };
  }
  if (requestedSocietyId) {
    return { societyId: requestedSocietyId, global: false };
  }
  const role = normalizeRole(req.user?.role);
  if (role === 'super_admin' || role === 'admin') {
    return { societyId: null, global: true };
  }
  return { societyId: null, global: false };
}

async function addStaff(req, res) {
  try {
    if (!(await requireSocietyId(req, res))) return;
    const {
      name,
      phone,
      photo = '',
      workType,
      houseNumber,
      workingDays = [],
      expectedEntryTime = '',
      expectedExitTime = '',
    } = req.body;

    if (!name?.trim() || !phone?.trim() || !workType || !houseNumber?.trim()) {
      return res.status(400).json({ message: 'name, phone, workType and houseNumber are required.' });
    }
    const phoneError = validatePhoneInput(phone);
    if (phoneError) {
      return res.status(400).json({ message: phoneError });
    }

    const row = await Staff.create({
      name: name.trim(),
      phone: normalizePhone(phone),
      photo: String(photo || '').trim(),
      workType,
      houseNumber: houseNumber.trim(),
      residentId: req.user._id,
      workingDays: Array.isArray(workingDays) ? workingDays : [],
      expectedEntryTime: String(expectedEntryTime || '').trim(),
      expectedExitTime: String(expectedExitTime || '').trim(),
      status: 'active',
      createdByResident: req.user._id,
      societyId: req.user.societyId,
    });

    return res.status(201).json({ success: true, message: 'Domestic staff registered.', data: row });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({ message: 'Staff phone is already registered in this society.' });
    }
    return res.status(400).json({ success: false, message: 'Failed to register domestic staff.', data: null });
  }
}

async function editStaff(req, res) {
  try {
    if (!(await requireSocietyId(req, res))) return;
    const { id } = req.params;
    const {
      name,
      phone,
      photo = '',
      workType,
      houseNumber,
      workingDays = [],
      expectedEntryTime = '',
      expectedExitTime = '',
      status,
    } = req.body;

    const row = await Staff.findOne({
      _id: id,
      societyId: req.user.societyId,
      residentId: req.user._id,
    });
    if (!row) {
      return res.status(404).json({ message: 'Staff not found.' });
    }

    if (name !== undefined) row.name = String(name || '').trim();
    if (phone !== undefined) {
      const phoneError = validatePhoneInput(phone);
      if (phoneError) {
        return res.status(400).json({ message: phoneError });
      }
      row.phone = normalizePhone(phone);
    }
    if (photo !== undefined) row.photo = String(photo || '').trim();
    if (workType !== undefined) row.workType = workType;
    if (houseNumber !== undefined) row.houseNumber = String(houseNumber || '').trim();
    if (workingDays !== undefined) row.workingDays = Array.isArray(workingDays) ? workingDays : [];
    if (expectedEntryTime !== undefined) row.expectedEntryTime = String(expectedEntryTime || '').trim();
    if (expectedExitTime !== undefined) row.expectedExitTime = String(expectedExitTime || '').trim();
    if (status && ['active', 'blocked', 'inactive'].includes(status)) row.status = status;

    await row.save();
    return res.status(200).json({ success: true, message: 'Staff updated.', data: row });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({ message: 'Staff phone is already registered in this society.' });
    }
    return res.status(400).json({ success: false, message: 'Failed to update staff.', data: null });
  }
}

async function removeStaff(req, res) {
  try {
    if (!(await requireSocietyId(req, res))) return;
    const { id } = req.params;

    const row = await Staff.findOneAndDelete({
      _id: id,
      societyId: req.user.societyId,
      residentId: req.user._id,
    });
    if (!row) {
      return res.status(404).json({ message: 'Staff not found.' });
    }
    return res.status(200).json({ success: true, message: 'Staff removed.', data: row });
  } catch {
    return res.status(400).json({ success: false, message: 'Failed to remove staff.', data: null });
  }
}

async function listMyStaff(req, res) {
  try {
    if (!(await requireSocietyId(req, res))) return;
    const rows = await Staff.find({
      societyId: req.user.societyId,
      residentId: req.user._id,
    }).sort({ createdAt: -1 });
    return res.status(200).json({ success: true, message: 'Staff fetched.', data: rows });
  } catch {
    return res.status(500).json({ success: false, message: 'Failed to fetch staff.', data: null });
  }
}

async function listAllStaff(req, res) {
  try {
    const scope = resolveAdminSocietyScope(req);
    if (!scope.global && !scope.societyId) {
      return res.status(400).json({ message: 'User is not mapped to a society.' });
    }

    const filter = {};
    if (scope.societyId) filter.societyId = scope.societyId;

    const rows = await Staff.find(filter)
      .populate('residentId', 'name email')
      .sort({ createdAt: -1 });
    return res.status(200).json({ success: true, message: 'All staff fetched.', data: rows });
  } catch {
    return res.status(500).json({ success: false, message: 'Failed to fetch all staff.', data: null });
  }
}

async function updateStaffStatus(req, res) {
  try {
    const scope = resolveAdminSocietyScope(req);
    if (!scope.global && !scope.societyId) {
      return res.status(400).json({ message: 'User is not mapped to a society.' });
    }
    const { id } = req.params;
    const { status } = req.body;
    if (!['active', 'blocked', 'inactive'].includes(status)) {
      return res.status(400).json({ message: 'status must be active, blocked or inactive.' });
    }
    const filter = { _id: id };
    if (scope.societyId) filter.societyId = scope.societyId;

    const row = await Staff.findOneAndUpdate(
      filter,
      { $set: { status } },
      { new: true }
    );
    if (!row) return res.status(404).json({ message: 'Staff not found.' });
    return res.status(200).json({ success: true, message: 'Staff status updated.', data: row });
  } catch {
    return res.status(400).json({ success: false, message: 'Failed to update staff status.', data: null });
  }
}

async function requestStaffOtp(req, res) {
  try {
    if (!(await requireSocietyId(req, res))) return;
    const phone = normalizePhone(req.body.phone);
    if (!phone) return res.status(400).json({ message: 'phone is required.' });
    const phoneError = validatePhoneInput(req.body.phone);
    if (phoneError) return res.status(400).json({ message: phoneError });

    const staff = await findStaffByPhone({
      societyId: req.user.societyId,
      phone,
      status: 'active',
    });

    if (!staff) {
      const globalStaff = await Staff.findOne({
        phone: { $in: buildPhoneCandidates(phone) },
        status: 'active',
      }).select('_id societyId');
      if (globalStaff && String(globalStaff.societyId) !== String(req.user.societyId)) {
        return res.status(403).json({ message: 'Staff is registered in a different society.' });
      }
      return res.status(404).json({ message: 'Staff not registered. Contact resident or admin.' });
    }

    const otp = generateOtp();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    const otpPhoneKey = normalizePhone(staff.phone);
    await StaffOTP.deleteMany({ phone: otpPhoneKey });
    await StaffOTP.create({ phone: otpPhoneKey, otp, expiresAt, isVerified: false, verifiedAt: null });
    const otpDelivery = await sendOtpToPhone(staff.phone, otp);

    const response = {
      success: true,
      message: 'OTP sent to staff phone.',
      data: { phone: staff.phone },
    };
    if (!otpDelivery.delivered || process.env.NODE_ENV !== 'production') {
      response.data.devOtp = otp;
    }

    return res.status(200).json(response);
  } catch {
    return res.status(400).json({ success: false, message: 'Failed to send OTP.', data: null });
  }
}

async function verifyStaffOtp(req, res) {
  try {
    if (!(await requireSocietyId(req, res))) return;
    const phone = normalizePhone(req.body.phone);
    const otp = String(req.body.otp || '').trim();
    if (!phone || !otp) return res.status(400).json({ message: 'phone and otp are required.' });
    const phoneError = validatePhoneInput(req.body.phone);
    if (phoneError) return res.status(400).json({ message: phoneError });

    const staff = await findStaffByPhone({
      societyId: req.user.societyId,
      phone,
      status: 'active',
    });
    if (!staff) {
      return res.status(404).json({ message: 'Staff not registered. Contact resident or admin.' });
    }

    const otpPhoneKey = normalizePhone(staff.phone);
    const otpDoc = await StaffOTP.findOne({
      phone: otpPhoneKey,
      expiresAt: { $gt: new Date() },
    }).sort({ createdAt: -1 });

    if (!otpDoc) {
      return res.status(400).json({ message: 'OTP expired or not found.' });
    }
    if (otpDoc.otp !== otp) {
      return res.status(400).json({ message: 'Invalid OTP.' });
    }

    otpDoc.isVerified = true;
    otpDoc.verifiedAt = new Date();
    otpDoc.expiresAt = new Date(Date.now() + 5 * 60 * 1000);
    await otpDoc.save();

    return res.status(200).json({
      success: true,
      message: 'OTP verified.',
      data: {
        staffId: staff._id,
        name: staff.name,
        workType: staff.workType,
        houseNumber: staff.houseNumber,
      },
    });
  } catch {
    return res.status(400).json({ success: false, message: 'Failed to verify OTP.', data: null });
  }
}

async function markStaffEntry(req, res) {
  try {
    if (!(await requireSocietyId(req, res))) return;
    const { staffId } = req.body;
    if (!staffId) return res.status(400).json({ message: 'staffId is required.' });

    const staff = await Staff.findOne({ _id: staffId, societyId: req.user.societyId, status: 'active' });
    if (!staff) return res.status(404).json({ message: 'Active staff not found.' });

    const verifiedOtp = await StaffOTP.findOne({
      phone: staff.phone,
      isVerified: true,
      expiresAt: { $gt: new Date() },
    }).sort({ createdAt: -1 });
    if (!verifiedOtp) {
      return res.status(403).json({ message: 'OTP verification required before marking entry.' });
    }

    const openLog = await StaffEntryLog.findOne({
      societyId: req.user.societyId,
      staffId: staff._id,
      exitTime: null,
    });
    if (openLog) {
      return res.status(400).json({ message: 'Staff entry already active. Mark exit first.' });
    }

    const now = new Date();
    const log = await StaffEntryLog.create({
      staffId: staff._id,
      houseNumber: staff.houseNumber,
      residentId: staff.residentId,
      entryTime: now,
      exitTime: null,
      date: dateKey(now),
      guardId: req.user._id,
      societyId: req.user.societyId,
    });

    await StaffOTP.deleteMany({ phone: staff.phone });

    await createNotificationsForUsers({
      userIds: [String(staff.residentId)],
      societyId: req.user.societyId,
      type: 'domestic_staff',
      title: 'Domestic Staff Entry',
      message: `Your ${staff.workType} ${staff.name} has arrived at ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`,
      link: '/app/domestic-staff',
      payload: {
        staffId: staff._id,
        entryLogId: log._id,
      },
    });

    return res.status(201).json({ success: true, message: 'Staff entry marked.', data: log });
  } catch {
    return res.status(400).json({ success: false, message: 'Failed to mark staff entry.', data: null });
  }
}

async function markStaffExit(req, res) {
  try {
    if (!(await requireSocietyId(req, res))) return;
    const { logId } = req.params;
    const log = await StaffEntryLog.findOne({
      _id: logId,
      societyId: req.user.societyId,
    });
    if (!log) return res.status(404).json({ message: 'Entry log not found.' });
    if (log.exitTime) return res.status(400).json({ message: 'Exit already marked.' });

    log.exitTime = new Date();
    await log.save();

    return res.status(200).json({ success: true, message: 'Staff exit marked.', data: log });
  } catch {
    return res.status(400).json({ success: false, message: 'Failed to mark staff exit.', data: null });
  }
}

async function listActiveEntries(req, res) {
  try {
    if (!(await requireSocietyId(req, res))) return;
    const rows = await StaffEntryLog.find({
      societyId: req.user.societyId,
      exitTime: null,
    })
      .populate('staffId', 'name phone workType houseNumber')
      .populate('residentId', 'name')
      .sort({ createdAt: -1 });
    return res.status(200).json({ success: true, message: 'Active entries fetched.', data: rows });
  } catch {
    return res.status(500).json({ success: false, message: 'Failed to fetch active entries.', data: null });
  }
}

async function listEntryLogs(req, res) {
  try {
    const scope = resolveAdminSocietyScope(req);
    if (!scope.global && !scope.societyId) {
      return res.status(400).json({ message: 'User is not mapped to a society.' });
    }

    const filter = {};
    if (scope.societyId) filter.societyId = scope.societyId;
    if (req.query.staffId) filter.staffId = req.query.staffId;
    if (req.query.residentId) filter.residentId = req.query.residentId;
    if (req.query.date) filter.date = req.query.date;

    const rows = await StaffEntryLog.find(filter)
      .populate('staffId', 'name phone workType houseNumber')
      .populate('residentId', 'name email')
      .populate('guardId', 'name')
      .sort({ createdAt: -1 });
    return res.status(200).json({ success: true, message: 'Staff logs fetched.', data: rows });
  } catch {
    return res.status(500).json({ success: false, message: 'Failed to fetch staff logs.', data: null });
  }
}

async function listResidentStaffLogs(req, res) {
  try {
    if (!(await requireSocietyId(req, res))) return;
    const { staffId } = req.params;
    const staff = await Staff.findOne({
      _id: staffId,
      residentId: req.user._id,
      societyId: req.user.societyId,
    });
    if (!staff) return res.status(404).json({ message: 'Staff not found.' });

    const rows = await StaffEntryLog.find({
      societyId: req.user.societyId,
      staffId: staff._id,
      residentId: req.user._id,
    })
      .populate('guardId', 'name')
      .sort({ createdAt: -1 });
    return res.status(200).json({ success: true, message: 'Staff attendance history fetched.', data: rows });
  } catch {
    return res.status(500).json({ success: false, message: 'Failed to fetch attendance history.', data: null });
  }
}

module.exports = {
  addStaff,
  editStaff,
  removeStaff,
  listMyStaff,
  listAllStaff,
  updateStaffStatus,
  requestStaffOtp,
  verifyStaffOtp,
  markStaffEntry,
  markStaffExit,
  listActiveEntries,
  listEntryLogs,
  listResidentStaffLogs,
};

