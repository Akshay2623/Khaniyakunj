const Society = require('../models/Society');
const User = require('../models/User');
const mongoose = require('mongoose');

function isValidObjectId(value) {
  return Boolean(value) && mongoose.Types.ObjectId.isValid(String(value));
}

async function getDefaultSocietyId() {
  const active = await Society.findOne({
    isDeleted: { $ne: true },
    status: { $in: ['Active', 'active'] },
  })
    .sort({ createdAt: 1 })
    .select('_id');
  if (active?._id) return active._id;

  const anySociety = await Society.findOne({ isDeleted: { $ne: true } })
    .sort({ createdAt: 1 })
    .select('_id');
  if (anySociety?._id) return anySociety._id;

  // Single-society fallback: if society master rows are missing/inconsistent,
  // reuse any mapped user societyId so modules can continue to function.
  const mappedUser = await User.findOne({
    societyId: { $exists: true, $ne: null },
    isDeleted: { $ne: true },
  })
    .sort({ createdAt: 1 })
    .select('societyId');
  if (mappedUser?.societyId && isValidObjectId(mappedUser.societyId)) {
    return mappedUser.societyId;
  }
  return null;
}

async function ensureSingleSocietyRecord(user = null) {
  const existing = await Society.findOne({ isDeleted: { $ne: true } })
    .sort({ createdAt: 1 })
    .select('_id');
  if (existing?._id) return existing._id;
  if (!user?._id) return null;

  const created = await Society.create({
    name: 'Default Society',
    legalName: 'Default Society',
    contactEmail: String(user.email || '').trim().toLowerCase(),
    createdBy: user._id,
    status: 'Active',
    isDeleted: false,
  });
  return created?._id || null;
}

async function resolveSingleSocietyId({ user = null, requestedSocietyId = null }) {
  if (user?.societyId && isValidObjectId(user.societyId)) return user.societyId;
  if (requestedSocietyId && isValidObjectId(requestedSocietyId)) return requestedSocietyId;
  const defaultSocietyId = await getDefaultSocietyId();
  if (defaultSocietyId) return defaultSocietyId;
  return ensureSingleSocietyRecord(user);
}

async function ensureUserSocietyMapping(user) {
  if (!user?._id) return null;
  const resolved = await resolveSingleSocietyId({ user });
  if (!resolved || !isValidObjectId(resolved)) return null;
  if (!user.societyId || String(user.societyId) !== String(resolved)) {
    user.societyId = resolved;
    await User.updateOne({ _id: user._id }, { $set: { societyId: resolved } });
  }
  return resolved;
}

module.exports = {
  getDefaultSocietyId,
  resolveSingleSocietyId,
  ensureUserSocietyMapping,
};
