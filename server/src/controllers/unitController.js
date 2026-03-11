const asyncHandler = require('../utils/asyncHandler');
const Unit = require('../models/Unit');
const User = require('../models/User');
const Resident = require('../models/Resident');
const { successResponse } = require('../utils/response');
const { resolveSingleSocietyId } = require('../services/singleSocietyService');
const { ROLES, normalizeRole } = require('../constants/roles');

async function resolveScopedSocietyId(req) {
  return resolveSingleSocietyId({
    user: req.user,
    requestedSocietyId: req.query?.societyId || req.body?.societyId || null,
  });
}

function normalizeUnitStatus(value = '') {
  const normalized = String(value || '').trim().toUpperCase();
  if (['VACANT', 'OCCUPIED', 'INACTIVE'].includes(normalized)) return normalized;
  if (normalized === 'ACTIVE') return 'VACANT';
  return 'VACANT';
}

function toUnitDto(unit) {
  const resident = unit.assignedResidentId || unit.tenantId || unit.ownerId || null;
  return {
    _id: unit._id,
    wing: unit.wing || '',
    flatNumber: unit.flatNumber || unit.unitNumber || '',
    unitNumber: unit.unitNumber || '',
    floor: unit.floorNumber ?? 0,
    floorNumber: unit.floorNumber ?? 0,
    unitType: unit.unitType || 'Other',
    status: unit.status || (unit.occupancyStatus === 'Occupied' ? 'OCCUPIED' : 'VACANT'),
    occupancyStatus: unit.occupancyStatus || 'Vacant',
    assignedResidentId: resident?._id || resident || null,
    assignedResident: resident
      ? {
          _id: resident?._id || null,
          name: resident?.name || '',
          email: resident?.email || '',
          phone: resident?.phone || '',
          role: resident?.role || '',
        }
      : null,
    buildingId: unit.buildingId || null,
    societyId: unit.societyId,
    createdAt: unit.createdAt,
    updatedAt: unit.updatedAt,
  };
}

const listUnits = asyncHandler(async (req, res) => {
  const filter = { isDeleted: { $ne: true } };
  const societyId = await resolveScopedSocietyId(req);
  if (societyId) filter.societyId = societyId;
  if (req.query.buildingId) filter.buildingId = req.query.buildingId;
  if (req.query.occupancyStatus) filter.occupancyStatus = req.query.occupancyStatus;
  if (req.query.status) filter.status = normalizeUnitStatus(req.query.status);
  if (req.query.onlyOccupied === 'true') filter.status = 'OCCUPIED';
  if (req.query.availableOnly === 'true') filter.status = 'VACANT';
  if (req.query.search) {
    const escaped = String(req.query.search).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filter.$or = [
      { unitNumber: { $regex: escaped, $options: 'i' } },
      { flatNumber: { $regex: escaped, $options: 'i' } },
      { wing: { $regex: escaped, $options: 'i' } },
    ];
  }

  const items = await Unit.find(filter)
    .populate('assignedResidentId', 'name email phone role')
    .populate('tenantId', 'name email phone role')
    .populate('ownerId', 'name email phone role')
    .sort({ wing: 1, flatNumber: 1, unitNumber: 1, createdAt: -1 });
  return successResponse(res, {
    message: 'Units fetched successfully.',
    data: items.map(toUnitDto),
  });
});

const getUnitSummary = asyncHandler(async (req, res) => {
  const societyId = await resolveScopedSocietyId(req);
  if (!societyId) {
    return successResponse(res, {
      message: 'No society configured.',
      data: { totalUnits: 0, occupiedUnits: 0, vacantUnits: 0, inactiveUnits: 0 },
    });
  }
  const [totalUnits, occupiedUnits, vacantUnits, inactiveUnits] = await Promise.all([
    Unit.countDocuments({ societyId, isDeleted: { $ne: true } }),
    Unit.countDocuments({ societyId, isDeleted: { $ne: true }, status: 'OCCUPIED' }),
    Unit.countDocuments({ societyId, isDeleted: { $ne: true }, status: 'VACANT' }),
    Unit.countDocuments({ societyId, isDeleted: { $ne: true }, status: 'INACTIVE' }),
  ]);
  return successResponse(res, {
    message: 'Unit summary fetched successfully.',
    data: { totalUnits, occupiedUnits, vacantUnits, inactiveUnits },
  });
});

const createUnit = asyncHandler(async (req, res) => {
  const societyId = await resolveScopedSocietyId(req);
  if (!societyId) {
    return res.status(400).json({ success: false, message: 'societyId is required.', data: null });
  }
  const wing = String(req.body.wing || '').trim().toUpperCase();
  const flatNumber = String(req.body.flatNumber || '').trim().toUpperCase();
  const floor = Number(req.body.floor ?? req.body.floorNumber ?? 0);
  const unitType = String(req.body.unitType || '2BHK').trim();
  const status = normalizeUnitStatus(req.body.status || 'VACANT');
  if (!flatNumber) {
    return res.status(400).json({ success: false, message: 'Flat number is required.', data: null });
  }
  if (!Number.isFinite(floor) || floor < 0) {
    return res.status(400).json({ success: false, message: 'Floor must be 0 or greater.', data: null });
  }

  const existing = await Unit.findOne({
    societyId,
    isDeleted: { $ne: true },
    wing,
    flatNumber,
  }).select('_id');
  if (existing) {
    return res.status(409).json({ success: false, message: 'Unit already exists for this wing/flat number.', data: null });
  }

  const created = await Unit.create({
    societyId,
    wing,
    flatNumber,
    unitNumber: wing ? `${wing}-${flatNumber}` : flatNumber,
    floorNumber: floor,
    unitType,
    status,
    occupancyStatus: status === 'OCCUPIED' ? 'Occupied' : 'Vacant',
    buildingId: req.body.buildingId || null,
  });
  const fresh = await Unit.findById(created._id)
    .populate('assignedResidentId', 'name email phone role')
    .populate('tenantId', 'name email phone role')
    .populate('ownerId', 'name email phone role');
  return res.status(201).json({ success: true, message: 'Unit created successfully.', data: toUnitDto(fresh) });
});

const updateUnit = asyncHandler(async (req, res) => {
  const societyId = await resolveScopedSocietyId(req);
  const unit = await Unit.findOne({ _id: req.params.id, isDeleted: { $ne: true }, ...(societyId ? { societyId } : {}) });
  if (!unit) {
    return res.status(404).json({ success: false, message: 'Unit not found.', data: null });
  }

  const nextWing = req.body.wing !== undefined ? String(req.body.wing || '').trim().toUpperCase() : unit.wing;
  const nextFlat = req.body.flatNumber !== undefined ? String(req.body.flatNumber || '').trim().toUpperCase() : unit.flatNumber;
  const nextFloor = req.body.floor !== undefined || req.body.floorNumber !== undefined
    ? Number(req.body.floor ?? req.body.floorNumber)
    : unit.floorNumber;
  if (!nextFlat) {
    return res.status(400).json({ success: false, message: 'Flat number is required.', data: null });
  }
  if (!Number.isFinite(nextFloor) || nextFloor < 0) {
    return res.status(400).json({ success: false, message: 'Floor must be 0 or greater.', data: null });
  }

  const duplicate = await Unit.findOne({
    _id: { $ne: unit._id },
    societyId: unit.societyId,
    isDeleted: { $ne: true },
    wing: nextWing,
    flatNumber: nextFlat,
  }).select('_id');
  if (duplicate) {
    return res.status(409).json({ success: false, message: 'Unit already exists for this wing/flat number.', data: null });
  }

  unit.wing = nextWing;
  unit.flatNumber = nextFlat;
  unit.floorNumber = nextFloor;
  if (req.body.unitType !== undefined) unit.unitType = String(req.body.unitType || unit.unitType);
  if (req.body.status !== undefined) {
    const nextStatus = normalizeUnitStatus(req.body.status);
    if (nextStatus === 'OCCUPIED' && !(unit.assignedResidentId || unit.tenantId || unit.ownerId)) {
      return res.status(400).json({ success: false, message: 'Cannot mark occupied without assigned resident.', data: null });
    }
    unit.status = nextStatus;
  }
  if (req.body.buildingId !== undefined) unit.buildingId = req.body.buildingId || null;
  await unit.save();
  const fresh = await Unit.findById(unit._id)
    .populate('assignedResidentId', 'name email phone role')
    .populate('tenantId', 'name email phone role')
    .populate('ownerId', 'name email phone role');
  return successResponse(res, { message: 'Unit updated successfully.', data: toUnitDto(fresh) });
});

const assignResidentToUnit = asyncHandler(async (req, res) => {
  const societyId = await resolveScopedSocietyId(req);
  const { residentId } = req.body;
  if (!residentId) {
    return res.status(400).json({ success: false, message: 'residentId is required.', data: null });
  }
  const unit = await Unit.findOne({ _id: req.params.id, isDeleted: { $ne: true }, ...(societyId ? { societyId } : {}) });
  if (!unit) {
    return res.status(404).json({ success: false, message: 'Unit not found.', data: null });
  }
  if (unit.status === 'OCCUPIED' && (unit.assignedResidentId || unit.tenantId || unit.ownerId)) {
    return res.status(409).json({ success: false, message: 'This unit is already assigned to another resident.', data: null });
  }

  const residentUser = await User.findOne({
    _id: residentId,
    isDeleted: { $ne: true },
    ...(societyId ? { societyId } : {}),
    role: { $in: [ROLES.RESIDENT, ROLES.TENANT, ROLES.OWNER] },
  });
  if (!residentUser) {
    return res.status(404).json({ success: false, message: 'Resident user not found.', data: null });
  }

  // Ensure resident is not already assigned elsewhere.
  const occupiedElsewhere = await Unit.findOne({
    _id: { $ne: unit._id },
    societyId: unit.societyId,
    isDeleted: { $ne: true },
    $or: [{ assignedResidentId: residentUser._id }, { tenantId: residentUser._id }, { ownerId: residentUser._id }],
  }).select('_id');
  if (occupiedElsewhere) {
    return res.status(409).json({ success: false, message: 'This resident is already assigned to another unit.', data: null });
  }

  const residentRole = normalizeRole(residentUser.role);
  unit.assignedResidentId = residentUser._id;
  if (residentRole === ROLES.TENANT) unit.tenantId = residentUser._id;
  if (residentRole === ROLES.OWNER) unit.ownerId = residentUser._id;
  unit.status = 'OCCUPIED';
  unit.occupancyStatus = 'Occupied';
  await unit.save();

  residentUser.unitId = unit._id;
  residentUser.flatId = unit._id;
  if (!residentUser.buildingId && unit.buildingId) residentUser.buildingId = unit.buildingId;
  await residentUser.save();

  await Resident.updateOne(
    { userId: residentUser._id, societyId: unit.societyId },
    {
      $set: {
        userId: residentUser._id,
        societyId: unit.societyId,
        name: residentUser.name,
        email: residentUser.email,
        phone: residentUser.phone || '0000000000',
        flatNumber: unit.flatNumber || unit.unitNumber,
        block: unit.wing || 'Block',
        occupancyType: residentRole === ROLES.OWNER ? 'owner' : 'tenant',
      },
      $setOnInsert: {
        createdBy: req.user._id,
      },
    },
    { upsert: true }
  );

  const fresh = await Unit.findById(unit._id)
    .populate('assignedResidentId', 'name email phone role')
    .populate('tenantId', 'name email phone role')
    .populate('ownerId', 'name email phone role');
  return successResponse(res, { message: 'Resident assigned to unit successfully.', data: toUnitDto(fresh) });
});

const markUnitVacant = asyncHandler(async (req, res) => {
  const societyId = await resolveScopedSocietyId(req);
  const unit = await Unit.findOne({ _id: req.params.id, isDeleted: { $ne: true }, ...(societyId ? { societyId } : {}) });
  if (!unit) {
    return res.status(404).json({ success: false, message: 'Unit not found.', data: null });
  }

  const userIds = [unit.assignedResidentId, unit.tenantId, unit.ownerId].filter(Boolean);
  if (userIds.length) {
    await User.updateMany(
      { _id: { $in: userIds } },
      { $set: { unitId: null, flatId: null } }
    );
  }
  unit.assignedResidentId = null;
  unit.tenantId = null;
  unit.ownerId = null;
  unit.status = 'VACANT';
  unit.occupancyStatus = 'Vacant';
  await unit.save();

  const fresh = await Unit.findById(unit._id)
    .populate('assignedResidentId', 'name email phone role')
    .populate('tenantId', 'name email phone role')
    .populate('ownerId', 'name email phone role');
  return successResponse(res, { message: 'Unit marked as vacant.', data: toUnitDto(fresh) });
});

module.exports = {
  listUnits,
  getUnitSummary,
  createUnit,
  updateUnit,
  assignResidentToUnit,
  markUnitVacant,
};
