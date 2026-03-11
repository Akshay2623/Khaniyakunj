const Alert = require('../models/Alert');
const User = require('../models/User');
const { createNotificationsForUsers } = require('../services/notificationService');
const { resolveSingleSocietyId } = require('../services/singleSocietyService');

async function resolveSocietyId(req, bodySocietyId) {
  const resolved = await resolveSingleSocietyId({
    user: req.user,
    requestedSocietyId: bodySocietyId || req.query?.societyId || null,
  });
  if (resolved && req.user && !req.user.societyId) req.user.societyId = resolved;
  return resolved || null;
}

function getRoleFilterByTarget(targetRole) {
  if (targetRole === 'COMMITTEE') return { role: { $in: ['committee', 'committee_member'] } };
  if (targetRole === 'GUARDS') return { role: 'guard' };
  if (targetRole === 'TENANTS' || targetRole === 'RESIDENTS') {
    return { role: { $in: ['tenant', 'owner', 'resident'] } };
  }
  return {};
}

function roleTargetsForUser(userRole) {
  const normalized = String(userRole || '').toLowerCase();
  if (['admin', 'super_admin'].includes(normalized)) {
    return ['ALL', 'RESIDENTS', 'GUARDS', 'TENANTS', 'COMMITTEE'];
  }
  if (['committee', 'committee_member'].includes(normalized)) {
    return ['ALL', 'RESIDENTS', 'GUARDS', 'TENANTS', 'COMMITTEE'];
  }
  const targets = ['ALL'];
  if (normalized === 'guard') targets.push('GUARDS');
  if (['tenant', 'owner', 'resident'].includes(normalized)) {
    targets.push('TENANTS', 'RESIDENTS');
  }
  return targets;
}

function parseDateInput(value, mode = 'start') {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (dateOnlyMatch) {
    const year = Number(dateOnlyMatch[1]);
    const month = Number(dateOnlyMatch[2]) - 1;
    const day = Number(dateOnlyMatch[3]);
    if (mode === 'end') return new Date(year, month, day, 23, 59, 59, 999);
    return new Date(year, month, day, 0, 0, 0, 0);
  }
  return new Date(raw);
}

async function createAlert(req, res) {
  try {
    const {
      title,
      message,
      priority = 'Normal',
      startDate,
      endDate,
      targetRole = 'ALL',
      societyId,
    } = req.body;

    if (!title || !message || !startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'title, message, startDate and endDate are required.',
        data: null,
      });
    }

    const resolvedSocietyId = await resolveSocietyId(req, societyId);
    if (!resolvedSocietyId) {
      return res.status(400).json({
        success: false,
        message: 'societyId is required.',
        data: null,
      });
    }

    const start = parseDateInput(startDate, 'start');
    const end = parseDateInput(endDate, 'end');
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return res.status(400).json({ success: false, message: 'Invalid startDate or endDate.', data: null });
    }
    if (end <= start) {
      return res.status(400).json({ success: false, message: 'End time must be later than start time.', data: null });
    }
    if (end < new Date()) {
      return res.status(400).json({ success: false, message: 'End time cannot be in the past.', data: null });
    }

    const alert = await Alert.create({
      title: String(title).trim(),
      message: String(message).trim(),
      priority,
      startDate: start,
      endDate: end,
      targetRole,
      createdBy: req.user._id,
      societyId: resolvedSocietyId,
    });

    const roleFilter = getRoleFilterByTarget(targetRole);
    const recipients = await User.find({
      societyId: resolvedSocietyId,
      isDeleted: { $ne: true },
      $or: [{ status: 'Active' }, { status: { $exists: false } }, { isActive: true }],
      ...roleFilter,
    }).select('_id');

    await createNotificationsForUsers({
      userIds: recipients.map((row) => String(row._id)),
      societyId: resolvedSocietyId,
      type: 'alert',
      title: `${priority.toUpperCase()} ALERT: ${alert.title}`,
      message: alert.message,
      link: '/app/dashboard',
      payload: {
        alertId: alert._id,
        priority: alert.priority,
      },
    });

    return res.status(201).json({
      success: true,
      message: 'Alert posted successfully.',
      data: {
        ...alert.toObject(),
        startTime: alert.startDate,
        endTime: alert.endDate,
      },
    });
  } catch {
    return res.status(400).json({ success: false, message: 'Failed to post alert.', data: null });
  }
}

async function getActiveAlerts(req, res) {
  try {
    const societyId = await resolveSocietyId(req, req.query.societyId || null);
    if (!societyId) {
      return res.status(200).json({ success: true, message: 'No society mapping found.', data: [] });
    }

    const now = new Date();
    const allowedTargets = roleTargetsForUser(req.user.role);
    await Alert.updateMany(
      {
        societyId,
        isActive: true,
        endDate: { $lt: now },
      },
      { $set: { isActive: false } }
    );

    const alerts = await Alert.find({
      societyId,
      isActive: true,
      startDate: { $lte: now },
      endDate: { $gte: now },
      targetRole: { $in: allowedTargets },
    })
      .populate('createdBy', 'name role')
      .sort({ priority: -1, createdAt: -1 });

    const safeRows = (alerts || []).filter((row) => {
      const start = new Date(row.startDate);
      const end = new Date(row.endDate);
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return false;
      return start <= now && end >= now;
    });

    return res.status(200).json({
      success: true,
      message: 'Active alerts fetched.',
      data: safeRows.map((row) => ({
        ...row.toObject(),
        startTime: row.startDate,
        endTime: row.endDate,
      })),
    });
  } catch {
    return res.status(500).json({ success: false, message: 'Failed to fetch active alerts.', data: null });
  }
}

async function getAlertHistory(req, res) {
  try {
    const societyId = await resolveSocietyId(req, req.query.societyId || null);
    if (!societyId) {
      return res.status(200).json({ success: true, message: 'No society mapping found.', data: [] });
    }
    const now = new Date();
    const rows = await Alert.find({ societyId })
      .populate('createdBy', 'name role')
      .sort({ createdAt: -1 })
      .limit(100);

    const mapped = rows.map((row) => {
      const start = new Date(row.startDate);
      const end = new Date(row.endDate);
      const active = row.isActive && start <= now && end >= now;
      return {
        ...row.toObject(),
        startTime: row.startDate,
        endTime: row.endDate,
        status: active ? 'Active' : 'Expired',
      };
    });

    return res.status(200).json({
      success: true,
      message: 'Alert history fetched.',
      data: mapped,
    });
  } catch {
    return res.status(500).json({ success: false, message: 'Failed to fetch alert history.', data: null });
  }
}

module.exports = {
  createAlert,
  getActiveAlerts,
  getAlertHistory,
  deleteAlert: async function deleteAlert(req, res) {
    try {
      const societyId = await resolveSocietyId(req, req.query.societyId || null);
      if (!societyId) {
        return res.status(400).json({ success: false, message: 'societyId is required.', data: null });
      }
      const { id } = req.params;
      const deleted = await Alert.findOneAndDelete({ _id: id, societyId });
      if (!deleted) {
        return res.status(404).json({ success: false, message: 'Alert not found.', data: null });
      }
      return res.status(200).json({ success: true, message: 'Alert deleted successfully.', data: { _id: deleted._id } });
    } catch {
      return res.status(400).json({ success: false, message: 'Failed to delete alert.', data: null });
    }
  },
};
