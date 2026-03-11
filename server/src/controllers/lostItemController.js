const mongoose = require('mongoose');
const LostItem = require('../models/LostItem');
const User = require('../models/User');
const { ROLES } = require('../constants/roles');
const { createNotificationsForUsers } = require('../services/notificationService');
const { resolveSingleSocietyId, ensureUserSocietyMapping } = require('../services/singleSocietyService');

function validObjectId(value) {
  return mongoose.Types.ObjectId.isValid(String(value || ''));
}

async function getAdminWatcherIds(societyId) {
  if (!societyId) return [];
  const rows = await User.find({
    isDeleted: { $ne: true },
    $or: [
      { societyId, role: { $in: [ROLES.ADMIN, ROLES.SOCIETY_ADMIN] } },
      { role: { $in: [ROLES.SUPER_ADMIN] } },
    ],
  }).select('_id');
  return [...new Set(rows.map((row) => String(row._id)))];
}

async function createLostItem(req, res) {
  try {
    const { itemName, description = '', locationFound, dateFound, image = '', notes = '' } = req.body;

    if (!itemName?.trim() || !locationFound?.trim() || !dateFound) {
      return res.status(400).json({ message: 'itemName, locationFound and dateFound are required.' });
    }

    const resolvedSocietyId = await resolveSingleSocietyId({ user: req.user });
    if (!resolvedSocietyId) {
      return res.status(400).json({ message: 'Society is not configured.' });
    }
    await ensureUserSocietyMapping(req.user);

    const lostItem = await LostItem.create({
      itemName: itemName.trim(),
      description: description.trim(),
      locationFound: locationFound.trim(),
      dateFound: new Date(dateFound),
      image: String(image || '').trim(),
      notes: notes.trim(),
      foundByGuard: req.user._id,
      societyId: resolvedSocietyId,
      status: 'FOUND',
      claimedBy: null,
    });

    const recipients = await User.find({
      isDeleted: { $ne: true },
      $or: [
        {
          societyId: resolvedSocietyId,
          role: { $in: [ROLES.ADMIN, ROLES.SOCIETY_ADMIN, ROLES.COMMITTEE, ROLES.SERVICE_PROVIDER, ROLES.TENANT, ROLES.OWNER, ROLES.RESIDENT] },
        },
        {
          role: ROLES.SUPER_ADMIN,
        },
      ],
    }).select('_id');

    const recipientIds = [...new Set(recipients.map((user) => String(user._id)))];
    if (recipientIds.length) {
      const trimmedItemName = lostItem.itemName;
      const trimmedLocation = lostItem.locationFound;
      await createNotificationsForUsers({
        userIds: recipientIds,
      societyId: resolvedSocietyId,
        type: 'lost_found',
        title: 'Lost & Found Update',
        message: `Lost item found: ${trimmedItemName} near ${trimmedLocation}`,
        link: '/app/lost-found',
        payload: {
          lostItemId: lostItem._id,
          itemName: lostItem.itemName,
          locationFound: lostItem.locationFound,
          image: lostItem.image || '',
          status: lostItem.status,
          foundByGuard: req.user._id,
        },
      });
    }

    return res.status(201).json({ success: true, message: 'Lost item posted successfully.', data: lostItem });
  } catch {
    return res.status(400).json({ success: false, message: 'Failed to post lost item.', data: null });
  }
}

async function listLostItems(req, res) {
  try {
    const filter = {};
    const resolvedSocietyId = await resolveSingleSocietyId({ user: req.user, requestedSocietyId: req.query?.societyId || null });
    if (resolvedSocietyId) filter.societyId = resolvedSocietyId;
    if (req.query.status) filter.status = String(req.query.status).toUpperCase();

    const rows = await LostItem.find(filter)
      .populate('foundByGuard', 'name email')
      .populate('claimedBy', 'name email')
      .sort({ createdAt: -1 });

    return res.status(200).json({ success: true, message: 'Lost items fetched successfully.', data: rows });
  } catch {
    return res.status(500).json({ success: false, message: 'Failed to fetch lost items.', data: null });
  }
}

async function claimLostItem(req, res) {
  try {
    const { id } = req.params;
    if (!validObjectId(id)) {
      return res.status(400).json({ message: 'Invalid item id.' });
    }

    const filter = { _id: id };
    const resolvedSocietyId = await resolveSingleSocietyId({ user: req.user, requestedSocietyId: req.body?.societyId || req.query?.societyId || null });
    if (resolvedSocietyId) filter.societyId = resolvedSocietyId;

    const item = await LostItem.findOne(filter);
    if (!item) {
      return res.status(404).json({ message: 'Lost item not found.' });
    }
    if (item.status === 'CLAIMED') {
      return res.status(400).json({ message: 'Item is already marked as claimed.' });
    }

    const alreadyClaimedBySameUser = item.claimedBy && String(item.claimedBy) === String(req.user._id);
    if (alreadyClaimedBySameUser) {
      return res.status(200).json({ success: true, message: 'Item already claimed by you.', data: item });
    }

    item.claimedBy = req.user._id;
    await item.save();

    if (item.foundByGuard) {
      const adminWatcherIds = await getAdminWatcherIds(resolvedSocietyId || item.societyId);
      const claimNotificationRecipients = [...new Set([String(item.foundByGuard), ...adminWatcherIds])];
      await createNotificationsForUsers({
        userIds: claimNotificationRecipients,
        societyId: resolvedSocietyId || item.societyId,
        type: 'lost_found_claim',
        title: 'Lost Item Claim Request',
        message: `${req.user.name || 'A resident'} claimed item "${item.itemName}".`,
        link: '/app/lost-found',
        payload: {
          lostItemId: item._id,
          itemName: item.itemName,
          image: item.image || '',
          claimedBy: req.user._id,
        },
      });
    }

    return res.status(200).json({ success: true, message: 'Claim request submitted.', data: item });
  } catch {
    return res.status(400).json({ success: false, message: 'Failed to claim lost item.', data: null });
  }
}

async function closeLostItem(req, res) {
  try {
    const { id } = req.params;
    if (!validObjectId(id)) {
      return res.status(400).json({ message: 'Invalid item id.' });
    }

    const filter = { _id: id };
    const resolvedSocietyId = await resolveSingleSocietyId({ user: req.user, requestedSocietyId: req.body?.societyId || req.query?.societyId || null });
    if (resolvedSocietyId) filter.societyId = resolvedSocietyId;

    const item = await LostItem.findOne(filter);
    if (!item) {
      return res.status(404).json({ message: 'Lost item not found.' });
    }

    if (req.body?.claimedBy && validObjectId(req.body.claimedBy)) {
      item.claimedBy = req.body.claimedBy;
    }

    item.status = 'CLAIMED';
    await item.save();

    const adminWatcherIds = await getAdminWatcherIds(resolvedSocietyId || item.societyId);
    if (adminWatcherIds.length) {
      const claimedByUser = item.claimedBy ? await User.findById(item.claimedBy).select('name').lean() : null;
      const claimedByName = claimedByUser?.name || 'unknown user';
      await createNotificationsForUsers({
        userIds: adminWatcherIds,
        societyId: resolvedSocietyId || item.societyId,
        type: 'lost_found_closed',
        title: 'Lost Item Marked Claimed',
        message: `Guard marked "${item.itemName}" as claimed by ${claimedByName}.`,
        link: '/app/lost-found',
        payload: {
          lostItemId: item._id,
          itemName: item.itemName,
          image: item.image || '',
          status: item.status,
          claimedBy: item.claimedBy || null,
          closedByGuard: req.user._id,
        },
      });
    }

    return res.status(200).json({ success: true, message: 'Lost item marked as claimed.', data: item });
  } catch {
    return res.status(400).json({ success: false, message: 'Failed to close lost item.', data: null });
  }
}

module.exports = {
  createLostItem,
  listLostItems,
  claimLostItem,
  closeLostItem,
};
