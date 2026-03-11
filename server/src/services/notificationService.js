const Notification = require('../models/Notification');
const User = require('../models/User');

const streamConnections = new Map();

function addStreamConnection(userId, res) {
  const key = String(userId);
  if (!streamConnections.has(key)) {
    streamConnections.set(key, new Set());
  }
  streamConnections.get(key).add(res);
}

function removeStreamConnection(userId, res) {
  const key = String(userId);
  const bucket = streamConnections.get(key);
  if (!bucket) return;
  bucket.delete(res);
  if (!bucket.size) {
    streamConnections.delete(key);
  }
}

function sendStreamEvent(userId, eventName, payload) {
  const key = String(userId);
  const bucket = streamConnections.get(key);
  if (!bucket || !bucket.size) return;

  const data = JSON.stringify({ type: eventName, payload });
  bucket.forEach((res) => {
    try {
      res.write(`event: ${eventName}\n`);
      res.write(`data: ${data}\n\n`);
    } catch {
      // Stream write can fail if client disconnected unexpectedly.
    }
  });
}

async function createNotificationsForUsers({ userIds, societyId = null, type = 'system', title, message, link = '', payload = null }) {
  if (!Array.isArray(userIds) || !userIds.length) return [];

  const docs = userIds.map((userId) => ({
    userId,
    societyId: societyId || null,
    type,
    title,
    message,
    link,
    payload,
  }));

  const created = await Notification.insertMany(docs);

  created.forEach((notification) => {
    sendStreamEvent(notification.userId, 'notification:new', notification);
  });

  const unreadByUser = await Notification.aggregate([
    { $match: { userId: { $in: userIds }, isRead: false } },
    { $group: { _id: '$userId', count: { $sum: 1 } } },
  ]);

  unreadByUser.forEach((item) => {
    sendStreamEvent(item._id, 'notification:unread-count', { unreadCount: item.count });
  });

  return created;
}

async function createNoticeNotifications({ societyId, actorId, notice }) {
  if (!societyId || !notice) return [];

  const users = await User.find({
    societyId,
    isDeleted: { $ne: true },
    $or: [
      { status: 'Active' },
      { status: { $exists: false } },
      { isActive: true },
    ],
  }).select('_id');

  const userIds = users.map((user) => String(user._id));
  if (!userIds.length) return [];

  return createNotificationsForUsers({
    userIds,
    societyId,
    type: 'notice',
    title: notice.title,
    message: notice.description,
    link: '/app/dashboard',
    payload: {
      noticeId: notice._id,
      createdBy: actorId,
    },
  });
}

module.exports = {
  addStreamConnection,
  removeStreamConnection,
  sendStreamEvent,
  createNotificationsForUsers,
  createNoticeNotifications,
};
