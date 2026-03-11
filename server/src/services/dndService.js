const Resident = require('../models/Resident');
const User = require('../models/User');
const { createNotificationsForUsers } = require('./notificationService');

const EMERGENCY_KEYWORDS = ['emergency', 'ambulance', 'police', 'fire', 'medical', 'doctor', 'hospital'];

function hasEmergencyKeyword(text = '') {
  const normalized = String(text || '').toLowerCase();
  return EMERGENCY_KEYWORDS.some((keyword) => normalized.includes(keyword));
}

function isEmergencyVisitorRequest({ purpose = '', visitorName = '' }) {
  return hasEmergencyKeyword(purpose) || hasEmergencyKeyword(visitorName);
}

function isEmergencyDeliveryRequest({ deliveryType = '', deliveryPersonName = '' }) {
  return hasEmergencyKeyword(deliveryType) || hasEmergencyKeyword(deliveryPersonName);
}

function resolveDndExpiryFromTimer(timer = 'manual') {
  const now = Date.now();
  const map = {
    '30m': 30 * 60 * 1000,
    '1h': 60 * 60 * 1000,
    '2h': 2 * 60 * 60 * 1000,
    manual: null,
  };
  if (!Object.prototype.hasOwnProperty.call(map, timer)) return null;
  if (map[timer] === null) return null;
  return new Date(now + map[timer]);
}

async function getResidentDndState(userId, { notifyOnExpiry = true } = {}) {
  const resident = await Resident.findOne({ userId }).select('dndEnabled dndExpiryTime societyId userId');
  const user = await User.findById(userId).select('dndEnabled dndExpiryTime societyId');
  if (!resident && !user) return { enabled: false, expiryTime: null, expiredNow: false };

  const source = resident || user;

  const now = Date.now();
  const expiry = source.dndExpiryTime ? new Date(source.dndExpiryTime).getTime() : null;

  if (source.dndEnabled && expiry && expiry <= now) {
    source.dndEnabled = false;
    source.dndExpiryTime = null;
    await source.save();

    if (notifyOnExpiry && userId) {
      await createNotificationsForUsers({
        userIds: [String(userId)],
        societyId: source.societyId || null,
        type: 'resident_dnd',
        title: 'DND Auto Disabled',
        message: 'Do Not Disturb mode has been automatically disabled.',
        link: '/app/dashboard',
        payload: {
          dndEnabled: false,
          reason: 'expired',
        },
      });
    }

    return { enabled: false, expiryTime: null, expiredNow: true };
  }

  return {
    enabled: Boolean(source.dndEnabled),
    expiryTime: source.dndExpiryTime || null,
    expiredNow: false,
  };
}

module.exports = {
  isEmergencyVisitorRequest,
  isEmergencyDeliveryRequest,
  resolveDndExpiryFromTimer,
  getResidentDndState,
};
