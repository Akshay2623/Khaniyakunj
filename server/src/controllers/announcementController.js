const Announcement = require('../models/Announcement');
const { createNotificationsForUsers } = require('../services/notificationService');
const User = require('../models/User');
const { resolveSingleSocietyId } = require('../services/singleSocietyService');

async function scopedSocietyId(req, bodySocietyId) {
  const resolved = await resolveSingleSocietyId({
    user: req.user,
    requestedSocietyId: bodySocietyId || req.query?.societyId || null,
  });
  if (resolved && req.user && !req.user.societyId) req.user.societyId = resolved;
  return resolved || null;
}

function mapUserRoleToTargets(role) {
  const normalized = String(role || '').toLowerCase();
  if (['admin', 'super_admin'].includes(normalized)) {
    return ['ALL', 'COMMITTEE_MEMBERS', 'COMMITTEE', 'GUARDS', 'TENANTS', 'RESIDENTS'];
  }
  if (['committee', 'committee_member'].includes(normalized)) {
    return ['ALL', 'COMMITTEE_MEMBERS', 'COMMITTEE', 'GUARDS', 'TENANTS', 'RESIDENTS'];
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

async function createAnnouncement(req, res) {
  try {
    const {
      title,
      message,
      startDate,
      endDate,
      targetRole = 'ALL',
      societyId,
    } = req.body;

    if (!title || !message || !startDate || !endDate) {
      return res.status(400).json({ success: false, message: 'title, message, startDate and endDate are required.', data: null });
    }

    const resolvedSocietyId = await scopedSocietyId(req, societyId);
    if (!resolvedSocietyId) {
      return res.status(400).json({ success: false, message: 'societyId is required.', data: null });
    }

    const start = parseDateInput(startDate, 'start');
    const end = parseDateInput(endDate, 'end');
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return res.status(400).json({ success: false, message: 'Invalid startDate or endDate.', data: null });
    }
    if (end < start) {
      return res.status(400).json({ success: false, message: 'endDate must be after startDate.', data: null });
    }

    const announcement = await Announcement.create({
      title: String(title).trim(),
      message: String(message).trim(),
      startDate: start,
      endDate: end,
      targetRole,
      createdBy: req.user._id,
      societyId: resolvedSocietyId,
    });

    const roleFilter = targetRole === 'ALL'
      ? {}
      : targetRole === 'COMMITTEE_MEMBERS' || targetRole === 'COMMITTEE'
      ? { role: { $in: ['committee', 'committee_member'] } }
      : targetRole === 'GUARDS'
      ? { role: 'guard' }
      : targetRole === 'TENANTS' || targetRole === 'RESIDENTS'
      ? { role: { $in: ['tenant', 'owner', 'resident'] } }
      : {};

    const recipients = await User.find({
      societyId: resolvedSocietyId,
      isDeleted: { $ne: true },
      $or: [{ status: 'Active' }, { status: { $exists: false } }, { isActive: true }],
      ...roleFilter,
    }).select('_id');

    await createNotificationsForUsers({
      userIds: recipients.map((row) => String(row._id)),
      societyId: resolvedSocietyId,
      type: 'announcement',
      title: `Announcement: ${announcement.title}`,
      message: announcement.message,
      link: '/app/dashboard',
      payload: {
        announcementId: announcement._id,
      },
    });

    return res.status(201).json({
      success: true,
      message: 'Announcement created successfully.',
      data: announcement,
    });
  } catch {
    return res.status(400).json({ success: false, message: 'Failed to create announcement.', data: null });
  }
}

async function getActiveAnnouncements(req, res) {
  try {
    const societyId = await scopedSocietyId(req, req.query.societyId || null);
    if (!societyId) {
      return res.status(200).json({ success: true, message: 'No society mapping found.', data: [] });
    }

    const now = new Date();
    const targetRoles = mapUserRoleToTargets(req.user.role);

    await Announcement.updateMany(
      {
        societyId,
        isActive: true,
        endDate: { $lt: now },
      },
      { $set: { isActive: false } }
    );

    const announcements = await Announcement.find({
      societyId,
      isActive: true,
      startDate: { $lte: now },
      endDate: { $gte: now },
      targetRole: { $in: targetRoles },
    })
      .sort({ createdAt: -1 })
      .populate('createdBy', 'name role');

    const safeRows = (announcements || []).filter((row) => {
      const start = new Date(row.startDate);
      const end = new Date(row.endDate);
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return false;
      return start <= now && end >= now;
    });

    return res.status(200).json({
      success: true,
      message: 'Active announcements fetched.',
      data: safeRows,
    });
  } catch {
    return res.status(500).json({ success: false, message: 'Failed to fetch active announcements.', data: null });
  }
}

module.exports = {
  createAnnouncement,
  getActiveAnnouncements,
};
