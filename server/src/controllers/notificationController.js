const jwt = require('jsonwebtoken');
const Notification = require('../models/Notification');
const User = require('../models/User');
const { normalizeRole } = require('../constants/roles');
const { addStreamConnection, removeStreamConnection, sendStreamEvent } = require('../services/notificationService');

function isUserActive(user) {
  if (!user) return false;
  if (user.isDeleted) return false;
  if (user.status) return user.status === 'Active';
  return Boolean(user.isActive);
}

async function listMyNotifications(req, res) {
  try {
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
    const skip = (page - 1) * limit;

    const [rows, unreadCount, total] = await Promise.all([
      Notification.find({ userId: req.user._id })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Notification.countDocuments({ userId: req.user._id, isRead: false }),
      Notification.countDocuments({ userId: req.user._id }),
    ]);

    return res.status(200).json({
      data: rows,
      unreadCount,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch {
    return res.status(500).json({ message: 'Failed to fetch notifications.' });
  }
}

async function markNotificationAsRead(req, res) {
  try {
    const { id } = req.params;
    const notification = await Notification.findOne({ _id: id, userId: req.user._id });
    if (!notification) {
      return res.status(404).json({ message: 'Notification not found.' });
    }

    if (!notification.isRead) {
      notification.isRead = true;
      notification.readAt = new Date();
      await notification.save();
    }

    const unreadCount = await Notification.countDocuments({ userId: req.user._id, isRead: false });
    sendStreamEvent(req.user._id, 'notification:unread-count', { unreadCount });

    return res.status(200).json({ message: 'Notification marked as read.', unreadCount });
  } catch {
    return res.status(400).json({ message: 'Failed to mark notification as read.' });
  }
}

async function markAllAsRead(req, res) {
  try {
    await Notification.updateMany(
      { userId: req.user._id, isRead: false },
      { $set: { isRead: true, readAt: new Date() } }
    );

    sendStreamEvent(req.user._id, 'notification:unread-count', { unreadCount: 0 });
    return res.status(200).json({ message: 'All notifications marked as read.', unreadCount: 0 });
  } catch {
    return res.status(400).json({ message: 'Failed to mark all notifications as read.' });
  }
}

async function clearAllNotifications(req, res) {
  try {
    await Notification.deleteMany({ userId: req.user._id });
    sendStreamEvent(req.user._id, 'notification:unread-count', { unreadCount: 0 });
    return res.status(200).json({ message: 'All notifications cleared.', unreadCount: 0 });
  } catch {
    return res.status(400).json({ message: 'Failed to clear notifications.' });
  }
}

async function streamNotifications(req, res) {
  try {
    const token = String(req.query.token || '').trim();
    if (!token) {
      return res.status(401).json({ message: 'Unauthorized.' });
    }

    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(payload.userId).select('-password');
    if (!user || !isUserActive(user)) {
      return res.status(401).json({ message: 'Unauthorized.' });
    }

    user.role = normalizeRole(user.role);

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    addStreamConnection(user._id, res);

    const unreadCount = await Notification.countDocuments({ userId: user._id, isRead: false });
    res.write(`event: ready\n`);
    res.write(`data: ${JSON.stringify({ type: 'ready', payload: { unreadCount } })}\n\n`);

    const heartbeat = setInterval(() => {
      res.write(`event: ping\n`);
      res.write(`data: ${JSON.stringify({ type: 'ping', payload: { at: Date.now() } })}\n\n`);
    }, 25000);

    req.on('close', () => {
      clearInterval(heartbeat);
      removeStreamConnection(user._id, res);
      res.end();
    });
  } catch {
    return res.status(401).json({ message: 'Invalid or expired token.' });
  }
}

module.exports = {
  listMyNotifications,
  markNotificationAsRead,
  markAllAsRead,
  clearAllNotifications,
  streamNotifications,
};
