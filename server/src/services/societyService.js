const mongoose = require('mongoose');
const Society = require('../models/Society');
const SocietySettings = require('../models/SocietySettings');
const Resident = require('../models/Resident');
const Unit = require('../models/Unit');
const MaintenanceBill = require('../models/MaintenanceBill');
const ServiceRequest = require('../models/ServiceRequest');
const Visitor = require('../models/Visitor');
const AuditLog = require('../models/AuditLog');

function isSingleSocietyMode() {
  const raw = String(process.env.SINGLE_SOCIETY_MODE || 'true').toLowerCase();
  return raw !== 'false';
}

function mapLegacyFields(payload = {}) {
  const mapped = { ...payload };

  // Backward compatibility for existing UI payload shape.
  if (typeof mapped.address === 'string') {
    mapped.address = { line1: mapped.address };
  }
  if (mapped.totalFlats !== undefined && mapped.totalUnits === undefined) {
    mapped.totalUnits = mapped.totalFlats;
  }
  if (mapped.gstNumber && !mapped.taxIdentificationNumber) {
    mapped.taxIdentificationNumber = mapped.gstNumber;
  }
  if (mapped.logo && !mapped.logoUrl) {
    mapped.logoUrl = mapped.logo;
  }

  return mapped;
}

function toSocietyDto(society) {
  const obj = society.toObject ? society.toObject() : society;
  return {
    ...obj,
    // Backward compatibility for existing frontend pages.
    addressText: [obj.address?.line1, obj.address?.line2, obj.address?.city, obj.address?.state, obj.address?.country]
      .filter(Boolean)
      .join(', '),
    address: [obj.address?.line1, obj.address?.line2, obj.address?.city, obj.address?.state, obj.address?.country]
      .filter(Boolean)
      .join(', '),
    totalFlats: obj.totalUnits || 0,
  };
}

function buildSocietyScopeFilter(scope) {
  const filter = { isDeleted: { $ne: true } };
  if (!scope.isSuperAdmin && scope.societyId) {
    filter._id = scope.societyId;
  }
  return filter;
}

async function writeAuditLog({ actorId, societyId, entity, entityId, action, metadata = {} }) {
  await AuditLog.create({
    actorId,
    societyId,
    entity,
    entityId,
    action,
    metadata,
  });
}

async function createSociety({ scope, actorId, payload }) {
  try {
    if (isSingleSocietyMode()) {
      const existing = await Society.findOne({ isDeleted: { $ne: true } }).select('_id name');
      if (existing) {
        const e = new Error('Single-society mode is enabled. Creating additional societies is disabled.');
        e.statusCode = 400;
        throw e;
      }
    }

    const mapped = mapLegacyFields(payload);
    const created = await Society.create({
      ...mapped,
      createdBy: actorId,
    });

    await SocietySettings.updateOne(
      { societyId: created._id },
      { $setOnInsert: { societyId: created._id } },
      { upsert: true }
    );

    await writeAuditLog({
      actorId,
      societyId: created._id,
      entity: 'Society',
      entityId: created._id,
      action: 'CREATE',
      metadata: { name: created.name, scope },
    });

    return toSocietyDto(created);
  } catch (error) {
    if (error.code === 11000) {
      const duplicateField = Object.keys(error.keyPattern || {})[0] || 'field';
      const e = new Error(`${duplicateField} already exists.`);
      e.statusCode = 409;
      throw e;
    }
    throw error;
  }
}

async function listSocieties({ scope, query }) {
  const page = Math.max(Number(query.page) || 1, 1);
  const limit = Math.min(Math.max(Number(query.limit) || 20, 1), 100);
  const skip = (page - 1) * limit;
  const sortBy = query.sortBy || 'createdAt';
  const sortOrder = query.sortOrder === 'asc' ? 1 : -1;

  const filter = buildSocietyScopeFilter(scope);

  if (query.status) filter.status = query.status;
  if (query.subscriptionPlan) filter.subscriptionPlan = query.subscriptionPlan;
  if (query.search) {
    filter.$or = [
      { name: { $regex: query.search, $options: 'i' } },
      { legalName: { $regex: query.search, $options: 'i' } },
      { registrationNumber: { $regex: query.search, $options: 'i' } },
    ];
  }

  const [items, total] = await Promise.all([
    Society.find(filter).sort({ [sortBy]: sortOrder }).skip(skip).limit(limit),
    Society.countDocuments(filter),
  ]);

  if (isSingleSocietyMode()) {
    const primary = items[0] || null;
    return {
      items: primary ? [toSocietyDto(primary)] : [],
      pagination: {
        page: 1,
        limit: 1,
        total: primary ? 1 : 0,
        totalPages: primary ? 1 : 0,
      },
    };
  }

  return {
    items: items.map(toSocietyDto),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

async function getSocietyById({ scope, id }) {
  const filter = buildSocietyScopeFilter(scope);
  filter._id = id;

  const society = await Society.findOne(filter);
  if (!society) return null;
  return toSocietyDto(society);
}

async function updateSociety({ scope, actorId, id, payload }) {
  try {
    const mapped = mapLegacyFields(payload);
    const filter = buildSocietyScopeFilter(scope);
    filter._id = id;

    const updated = await Society.findOneAndUpdate(filter, mapped, {
      new: true,
      runValidators: true,
    });

    if (!updated) return null;

    await writeAuditLog({
      actorId,
      societyId: updated._id,
      entity: 'Society',
      entityId: updated._id,
      action: 'UPDATE',
      metadata: { changedFields: Object.keys(mapped) },
    });

    return toSocietyDto(updated);
  } catch (error) {
    if (error.code === 11000) {
      const duplicateField = Object.keys(error.keyPattern || {})[0] || 'field';
      const e = new Error(`${duplicateField} already exists.`);
      e.statusCode = 409;
      throw e;
    }
    throw error;
  }
}

async function deleteSociety({ scope, actorId, id }) {
  const filter = buildSocietyScopeFilter(scope);
  filter._id = id;

  const society = await Society.findOneAndUpdate(
    filter,
    {
      isDeleted: true,
      status: 'Archived',
      deletedAt: new Date(),
      deletedBy: actorId,
    },
    { new: true }
  );

  if (!society) return null;

  await writeAuditLog({
    actorId,
    societyId: society._id,
    entity: 'Society',
    entityId: society._id,
    action: 'SOFT_DELETE',
  });

  return toSocietyDto(society);
}

async function getSocietySettings({ scope, societyId }) {
  if (!scope.isSuperAdmin && scope.societyId && String(scope.societyId) !== String(societyId)) return null;

  const settings = await SocietySettings.findOneAndUpdate(
    { societyId },
    { $setOnInsert: { societyId } },
    { upsert: true, new: true }
  );
  return settings;
}

async function updateSocietySettings({ scope, actorId, societyId, payload }) {
  if (!scope.isSuperAdmin && scope.societyId && String(scope.societyId) !== String(societyId)) return null;

  const updated = await SocietySettings.findOneAndUpdate(
    { societyId },
    payload,
    { new: true, upsert: true, runValidators: true }
  );

  await writeAuditLog({
    actorId,
    societyId,
    entity: 'SocietySettings',
    entityId: updated._id,
    action: 'UPDATE',
    metadata: { changedFields: Object.keys(payload) },
  });

  return updated;
}

async function getSocietyOverview({ scope, societyId }) {
  if (!scope.isSuperAdmin && scope.societyId && String(scope.societyId) !== String(societyId)) return null;

  const societyObjectId = new mongoose.Types.ObjectId(societyId);

  const [residentAgg, unitAgg, financeAgg, requestAgg, visitorAgg] = await Promise.all([
    Resident.aggregate([
      { $match: { societyId: societyObjectId } },
      { $count: 'totalResidents' },
    ]),
    Unit.aggregate([
      { $match: { societyId: societyObjectId, isDeleted: false } },
      {
        $group: {
          _id: null,
          totalUnits: { $sum: 1 },
          occupiedUnits: {
            $sum: { $cond: [{ $eq: ['$occupancyStatus', 'Occupied'] }, 1, 0] },
          },
        },
      },
    ]),
    MaintenanceBill.aggregate([
      { $match: { societyId: societyObjectId } },
      {
        $group: {
          _id: null,
          totalMonthlyRevenue: {
            $sum: {
              $cond: [
                { $eq: ['$status', 'Paid'] },
                { $add: [{ $ifNull: ['$amount', 0] }, { $ifNull: ['$lateFee', 0] }] },
                0,
              ],
            },
          },
          outstandingBalance: {
            $sum: {
              $cond: [
                { $in: ['$status', ['Unpaid', 'Overdue']] },
                { $add: [{ $ifNull: ['$amount', 0] }, { $ifNull: ['$lateFee', 0] }] },
                0,
              ],
            },
          },
          totalBills: { $sum: 1 },
          overdueBills: {
            $sum: { $cond: [{ $eq: ['$status', 'Overdue'] }, 1, 0] },
          },
        },
      },
    ]),
    ServiceRequest.aggregate([
      {
        $match: {
          societyId: societyObjectId,
          status: { $in: ['Pending', 'Assigned', 'InProgress'] },
        },
      },
      { $count: 'activeServiceRequests' },
    ]),
    Visitor.aggregate([
      {
        $match: {
          societyId: societyObjectId,
          status: 'Entered',
        },
      },
      { $count: 'activeVisitors' },
    ]),
  ]);

  const totalResidents = residentAgg[0]?.totalResidents || 0;
  const totalUnits = unitAgg[0]?.totalUnits || 0;
  const occupiedUnits = unitAgg[0]?.occupiedUnits || 0;
  const occupancyRate = totalUnits ? Number(((occupiedUnits / totalUnits) * 100).toFixed(2)) : 0;
  const totalMonthlyRevenue = Number((financeAgg[0]?.totalMonthlyRevenue || 0).toFixed(2));
  const outstandingBalance = Number((financeAgg[0]?.outstandingBalance || 0).toFixed(2));
  const activeServiceRequests = requestAgg[0]?.activeServiceRequests || 0;
  const activeVisitors = visitorAgg[0]?.activeVisitors || 0;

  const totalBills = financeAgg[0]?.totalBills || 0;
  const overdueBills = financeAgg[0]?.overdueBills || 0;
  const overduePercentage = totalBills ? overdueBills / totalBills : 0;
  const financialHealthScore = Math.max(0, Math.min(100, Math.round(100 - overduePercentage * 100)));

  return {
    totalResidents,
    totalUnits,
    occupancyRate,
    totalMonthlyRevenue,
    outstandingBalance,
    activeServiceRequests,
    activeVisitors,
    financialHealthScore,
  };
}

module.exports = {
  createSociety,
  listSocieties,
  getSocietyById,
  updateSociety,
  deleteSociety,
  getSocietySettings,
  updateSocietySettings,
  getSocietyOverview,
};
