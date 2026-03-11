const Notice = require('../models/Notice');
const Alert = require('../models/Alert');
const Announcement = require('../models/Announcement');
const { createNoticeNotifications } = require('../services/notificationService');
const { resolveSingleSocietyId } = require('../services/singleSocietyService');

async function getScopedSocietyId(req, bodySocietyId) {
  const resolved = await resolveSingleSocietyId({
    user: req.user,
    requestedSocietyId: bodySocietyId || req.query?.societyId || null,
  });
  if (resolved && req.user && !req.user.societyId) req.user.societyId = resolved;
  return resolved || null;
}

async function createNotice(req, res) {
  try {
    const { title, description, societyId, isPinned = false, attachments = [] } = req.body;

    if (!title || !description) {
      return res.status(400).json({ message: 'title and description are required.' });
    }

    const resolvedSocietyId = await getScopedSocietyId(req, societyId);
    if (!resolvedSocietyId) {
      return res.status(400).json({ message: 'societyId is required.' });
    }

    const notice = await Notice.create({
      title,
      description,
      societyId: resolvedSocietyId,
      createdBy: req.user._id,
      isPinned: Boolean(isPinned),
      attachments: Array.isArray(attachments) ? attachments : [],
    });

    await createNoticeNotifications({
      societyId: resolvedSocietyId,
      actorId: req.user._id,
      notice,
    });

    return res.status(201).json(notice);
  } catch (error) {
    return res.status(400).json({ message: 'Failed to create notice.' });
  }
}

async function updateNotice(req, res) {
  try {
    const { id } = req.params;
    const { title, description, isPinned, attachments } = req.body;

    const notice = await Notice.findById(id);
    if (!notice) {
      return res.status(404).json({ message: 'Notice not found.' });
    }

    if (req.user.societyId && String(req.user.societyId) !== String(notice.societyId)) {
      return res.status(403).json({ message: 'Forbidden: notice belongs to another society.' });
    }

    if (title !== undefined) notice.title = title;
    if (description !== undefined) notice.description = description;
    if (isPinned !== undefined) notice.isPinned = Boolean(isPinned);
    if (attachments !== undefined) notice.attachments = Array.isArray(attachments) ? attachments : [];

    await notice.save();
    return res.status(200).json(notice);
  } catch (error) {
    return res.status(400).json({ message: 'Failed to update notice.' });
  }
}

async function deleteNotice(req, res) {
  try {
    const { id } = req.params;

    const notice = await Notice.findById(id);
    if (!notice) {
      return res.status(404).json({ message: 'Notice not found.' });
    }

    if (req.user.societyId && String(req.user.societyId) !== String(notice.societyId)) {
      return res.status(403).json({ message: 'Forbidden: notice belongs to another society.' });
    }

    await Notice.findByIdAndDelete(id);

    const now = new Date();
    const matchFilter = {
      societyId: notice.societyId,
      isActive: true,
      $or: [
        { title: String(notice.title || '').trim() },
        { message: String(notice.description || '').trim() },
        { message: String(notice.title || '').trim() },
      ],
    };

    await Promise.all([
      Announcement.updateMany(matchFilter, { $set: { isActive: false, endDate: now } }),
      Alert.updateMany(matchFilter, { $set: { isActive: false, endDate: now } }),
    ]);

    return res.status(200).json({ message: 'Notice deleted successfully.' });
  } catch (error) {
    return res.status(400).json({ message: 'Failed to delete notice.' });
  }
}

async function getResidentNotices(req, res) {
  try {
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(req.query.limit) || 10, 1), 100);
    const skip = (page - 1) * limit;

    const filter = {};
    const resolvedSocietyId = await getScopedSocietyId(req, req.query.societyId);
    if (resolvedSocietyId) filter.societyId = resolvedSocietyId;

    const [notices, total] = await Promise.all([
      Notice.find(filter)
        .populate('createdBy', 'name email role')
        .sort({ isPinned: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Notice.countDocuments(filter),
    ]);

    const mapped = notices.map((notice) => {
      const readEntry = notice.readBy.find((entry) => String(entry.userId) === String(req.user._id));
      return {
        ...notice.toObject(),
        isRead: Boolean(readEntry),
        readAt: readEntry ? readEntry.readAt : null,
      };
    });

    const unreadCount = await Notice.countDocuments({
      ...(filter.societyId ? { societyId: filter.societyId } : {}),
      'readBy.userId': { $ne: req.user._id },
    });

    return res.status(200).json({
      data: mapped,
      unreadCount,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch notices.' });
  }
}

async function markNoticeAsRead(req, res) {
  try {
    const { id } = req.params;

    const noticeFilter = { _id: id };
    const resolvedSocietyId = await getScopedSocietyId(req, req.query.societyId);
    if (resolvedSocietyId) noticeFilter.societyId = resolvedSocietyId;

    const notice = await Notice.findOne(noticeFilter);
    if (!notice) {
      return res.status(404).json({ message: 'Notice not found.' });
    }

    const alreadyRead = notice.readBy.some((entry) => String(entry.userId) === String(req.user._id));
    if (!alreadyRead) {
      notice.readBy.push({ userId: req.user._id, readAt: new Date() });
      await notice.save();
    }

    return res.status(200).json({
      message: alreadyRead ? 'Notice already marked as read.' : 'Notice marked as read.',
      noticeId: notice._id,
    });
  } catch (error) {
    return res.status(400).json({ message: 'Failed to mark notice as read.' });
  }
}

module.exports = {
  createNotice,
  updateNotice,
  deleteNotice,
  getResidentNotices,
  markNoticeAsRead,
};
