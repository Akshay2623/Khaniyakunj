const mongoose = require('mongoose');
const Visitor = require('../models/Visitor');
const Unit = require('../models/Unit');
const VehicleLog = require('../models/VehicleLog');
const Delivery = require('../models/Delivery');
const DeliveryEntry = require('../models/DeliveryEntry');
const EmergencyAlert = require('../models/EmergencyAlert');
const Society = require('../models/Society');
const BlacklistVisitor = require('../models/BlacklistVisitor');
const WatchlistVisitor = require('../models/WatchlistVisitor');
const User = require('../models/User');
const Resident = require('../models/Resident');
const Staff = require('../models/Staff');
const { ROLES, normalizeRole } = require('../constants/roles');
const { createNotificationsForUsers } = require('../services/notificationService');
const { sendOtpSms } = require('../services/smsService');
const { getResidentDndState, isEmergencyDeliveryRequest } = require('../services/dndService');
const { resolveSingleSocietyId, ensureUserSocietyMapping } = require('../services/singleSocietyService');

async function getSocietyIdFromUser(req) {
  const resolved = await resolveSingleSocietyId({
    user: req.user,
    requestedSocietyId: req.query?.societyId || req.body?.societyId || null,
  });
  if (resolved && req.user) {
    if (!req.user.societyId) {
      req.user.societyId = resolved;
    }
    await ensureUserSocietyMapping(req.user);
  }
  return resolved || null;
}

async function getSingleSocietyId() {
  const rows = await Society.find({ isDeleted: { $ne: true } })
    .sort({ createdAt: 1 })
    .select('_id')
    .limit(2);
  return rows.length === 1 ? rows[0]._id : null;
}

function todayRange() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

function randomQrToken() {
  return `QR-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10).toUpperCase()}`;
}

function randomOtp4() {
  return String(Math.floor(1000 + Math.random() * 9000));
}

function normalizePhone(phone) {
  return String(phone || '').replace(/\s+/g, '').trim();
}

function isLateNightEntry(date = new Date()) {
  const hour = date.getHours();
  return hour >= 22 || hour < 6;
}

function buildDateFilter(query, field = 'createdAt') {
  const filter = {};
  if (query.dateFrom || query.dateTo) {
    filter[field] = {};
    if (query.dateFrom) filter[field].$gte = new Date(query.dateFrom);
    if (query.dateTo) {
      const end = new Date(query.dateTo);
      end.setHours(23, 59, 59, 999);
      filter[field].$lte = end;
    }
  }
  return filter;
}

function getPagination(query, defaults = { page: 1, limit: 20, max: 100 }) {
  const page = Math.max(Number(query.page) || defaults.page, 1);
  const limit = Math.min(Math.max(Number(query.limit) || defaults.limit, 1), defaults.max);
  return { page, limit, skip: (page - 1) * limit };
}

function getNormalizedActorRole(user) {
  return normalizeRole(user?.role || '');
}

function canResolveEmergency(user) {
  const role = getNormalizedActorRole(user);
  return role === ROLES.ADMIN || role === ROLES.SUPER_ADMIN || role === ROLES.GUARD;
}

async function autoResolveStaleEmergencies({ societyId = null } = {}) {
  const hours = Math.max(Number(process.env.EMERGENCY_AUTO_RESOLVE_HOURS || 24), 1);
  const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
  const filter = {
    status: { $in: ['ACTIVE', null] },
    createdAt: { $lt: cutoff },
  };
  if (societyId) filter.societyId = societyId;
  await EmergencyAlert.updateMany(filter, {
    $set: {
      status: 'RESOLVED',
      resolvedAt: new Date(),
    },
  });
}

async function resolveResidentFromUnit(unitId) {
  if (!unitId) return null;
  const unit = await Unit.findById(unitId).select('assignedResidentId tenantId ownerId societyId');
  if (!unit) return null;
  return {
    unit,
    residentId: unit.assignedResidentId || unit.tenantId || unit.ownerId || null,
  };
}

async function resolveResidentByFlatNumber(societyId, flatNumber) {
  const normalizedFlat = String(flatNumber || '').trim();
  if (!normalizedFlat) return null;

  const escapedFlat = normalizedFlat.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const matchedUnit = await Unit.findOne({
    societyId,
    unitNumber: { $regex: `^${escapedFlat}$`, $options: 'i' },
    isDeleted: { $ne: true },
  }).select('unitNumber assignedResidentId tenantId ownerId');
  if (matchedUnit) {
    const residentId = matchedUnit.assignedResidentId || matchedUnit.tenantId || matchedUnit.ownerId || null;
    if (residentId) {
      const resident = await User.findOne({
        _id: residentId,
        societyId,
        isDeleted: { $ne: true },
      }).select('name phone email');
      if (resident) {
        return { resident, unit: matchedUnit };
      }
    }
  }

  // Fallback 1: Resident master table (used by many panels).
  const residentRecord = await Resident.findOne({
    societyId,
    flatNumber: { $regex: `^${escapedFlat}$`, $options: 'i' },
  })
    .select('flatNumber name phone email userId')
    .lean();

  if (residentRecord) {
    let residentUser = null;
    if (residentRecord.userId) {
      residentUser = await User.findOne({
        _id: residentRecord.userId,
        societyId,
        isDeleted: { $ne: true },
      }).select('name phone email');
    }
    if (!residentUser && residentRecord.email) {
      residentUser = await User.findOne({
        societyId,
        email: String(residentRecord.email).trim().toLowerCase(),
        isDeleted: { $ne: true },
      }).select('name phone email');
    }
    if (residentUser) {
      return {
        resident: residentUser,
        unit: { unitNumber: residentRecord.flatNumber || normalizedFlat },
      };
    }
  }

  // Fallback 2: Domestic staff mapping (houseNumber -> residentId).
  const staffRecord = await Staff.findOne({
    societyId,
    houseNumber: { $regex: `^${escapedFlat}$`, $options: 'i' },
    status: { $ne: 'inactive' },
  })
    .sort({ createdAt: -1 })
    .select('houseNumber residentId')
    .lean();

  if (staffRecord?.residentId) {
    const resident = await User.findOne({
      _id: staffRecord.residentId,
      societyId,
      isDeleted: { $ne: true },
    }).select('name phone email');
    if (resident) {
      return {
        resident,
        unit: { unitNumber: staffRecord.houseNumber || normalizedFlat },
      };
    }
  }

  return null;
}

async function visitorEntry(req, res) {
  try {
    const societyId = await getSocietyIdFromUser(req);
    if (!societyId) {
      return res.status(400).json({ success: false, message: 'Guard is not mapped to a society.', data: null });
    }

    const {
      visitorName,
      phone,
      purpose = '',
      visitingUnit = null,
      residentId = null,
      approvedByResident = false,
      status: requestedStatus = '',
    } = req.body;
    if (!visitorName || !phone) {
      return res.status(400).json({ success: false, message: 'visitorName and phone are required.', data: null });
    }
    const normalizedPhone = normalizePhone(phone);

    const [blacklisted, watchlisted] = await Promise.all([
      BlacklistVisitor.findOne({ societyId, phone: normalizedPhone }).select('reason name phone').lean(),
      WatchlistVisitor.findOne({ societyId, phone: normalizedPhone }).select('notes name phone').lean(),
    ]);

    if (blacklisted) {
      return res.status(403).json({
        success: false,
        message: `Entry blocked: visitor is blacklisted. Reason: ${blacklisted.reason}`,
        data: { blacklisted: true, record: blacklisted },
      });
    }

    let resolvedResidentId = residentId || null;
    let resolvedUnitId = visitingUnit || null;
    if (!resolvedResidentId && resolvedUnitId) {
      const resolved = await resolveResidentFromUnit(resolvedUnitId);
      resolvedResidentId = resolved?.residentId || null;
    }

    const entryAt = new Date();
    const resolvedStatus = requestedStatus === 'Pending' ? 'Pending' : 'Entered';

    const visitor = await Visitor.create({
      visitorName,
      phone: normalizedPhone,
      purpose,
      visitingUnit: resolvedUnitId,
      residentId: resolvedResidentId,
      societyId,
      entryTime: entryAt,
      status: resolvedStatus,
      approvedByResident: Boolean(approvedByResident),
      createdByGuard: req.user._id,
      approvedBy: resolvedResidentId || null,
      qrCodeToken: randomQrToken(),
      qrApprovalCode: randomQrToken(),
      lateNightEntry: isLateNightEntry(entryAt),
      watchlistMatched: Boolean(watchlisted),
      watchlistNotes: watchlisted?.notes || '',
    });

    return res.status(201).json({
      success: true,
      message: watchlisted ? 'Visitor entry created. Watchlist alert triggered.' : 'Visitor entry created.',
      data: {
        visitor,
        watchlistAlert: Boolean(watchlisted),
        watchlistRecord: watchlisted || null,
      },
    });
  } catch (error) {
    return res.status(400).json({ success: false, message: 'Failed to create visitor entry.', data: null });
  }
}

async function visitorExit(req, res) {
  try {
    const societyId = await getSocietyIdFromUser(req);
    if (!societyId) {
      return res.status(400).json({ success: false, message: 'Guard is not mapped to a society.', data: null });
    }

    const { visitorId } = req.body;
    if (!visitorId) {
      return res.status(400).json({ success: false, message: 'visitorId is required.', data: null });
    }

    const visitor = await Visitor.findOne({ _id: visitorId, societyId });
    if (!visitor) {
      return res.status(404).json({ success: false, message: 'Visitor not found.', data: null });
    }

    visitor.status = 'Exited';
    visitor.exitTime = new Date();
    if (!visitor.entryTime) visitor.entryTime = new Date();
    await visitor.save();

    return res.status(200).json({ success: true, message: 'Visitor exit marked.', data: visitor });
  } catch (error) {
    return res.status(400).json({ success: false, message: 'Failed to mark visitor exit.', data: null });
  }
}

async function todayVisitors(req, res) {
  try {
    const societyId = await getSocietyIdFromUser(req);
    if (!societyId) {
      return res.status(400).json({ success: false, message: 'Guard is not mapped to a society.', data: null });
    }
    const { start, end } = todayRange();
    const visitors = await Visitor.find({
      societyId,
      createdAt: { $gte: start, $lte: end },
    })
      .populate('residentId', 'name email')
      .populate('visitingUnit', 'unitNumber')
      .sort({ createdAt: -1 });

    return res.status(200).json({ success: true, message: 'Today visitors fetched.', data: visitors });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to fetch today visitors.', data: null });
  }
}

async function allVisitors(req, res) {
  try {
    const filter = {};
    if (req.user.societyId) filter.societyId = req.user.societyId;
    if (req.query.societyId) filter.societyId = req.query.societyId;
    Object.assign(filter, buildDateFilter(req.query));
    const { page, limit, skip } = getPagination(req.query, { page: 1, limit: 20, max: 100 });

    const [visitors, total] = await Promise.all([
      Visitor.find(filter)
        .populate('residentId', 'name email')
        .populate('visitingUnit', 'unitNumber')
        .populate('createdByGuard', 'name')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Visitor.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      message: 'All visitors fetched.',
      data: visitors,
      meta: { pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to fetch visitor logs.', data: null });
  }
}

async function visitorReport(req, res) {
  try {
    const match = {};
    if (req.user.societyId) match.societyId = new mongoose.Types.ObjectId(req.user.societyId);
    if (req.query.societyId) match.societyId = new mongoose.Types.ObjectId(req.query.societyId);

    const [statusBreakdown, dailyTrend] = await Promise.all([
      Visitor.aggregate([
        { $match: match },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      Visitor.aggregate([
        { $match: match },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: -1 } },
        { $limit: 7 },
      ]),
    ]);

    return res.status(200).json({
      success: true,
      message: 'Visitor report generated.',
      data: { statusBreakdown, dailyTrend: dailyTrend.reverse() },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to generate visitor report.', data: null });
  }
}

async function myVisitors(req, res) {
  try {
    const linkedResidentIds = [req.user._id];
    if (req.user.residentId) linkedResidentIds.push(req.user.residentId);
    const filter = { residentId: { $in: linkedResidentIds }, ...buildDateFilter(req.query) };
    const { page, limit, skip } = getPagination(req.query, { page: 1, limit: 20, max: 100 });
    const [visitors, total] = await Promise.all([
      Visitor.find(filter)
        .populate('visitingUnit', 'unitNumber')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Visitor.countDocuments(filter),
    ]);
    return res.status(200).json({
      success: true,
      message: 'My visitors fetched.',
      data: visitors,
      meta: { pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to fetch my visitors.', data: null });
  }
}

async function vehicleEntry(req, res) {
  try {
    const societyId = await getSocietyIdFromUser(req);
    if (!societyId) {
      return res.status(400).json({ success: false, message: 'Guard is not mapped to a society.', data: null });
    }
    const { vehicleNumber, vehicleType, driverName, purpose = '', visitingUnit = null } = req.body;
    if (!vehicleNumber || !vehicleType || !driverName) {
      return res.status(400).json({ success: false, message: 'vehicleNumber, vehicleType and driverName are required.', data: null });
    }
    const entry = await VehicleLog.create({
      vehicleNumber,
      vehicleType,
      driverName,
      purpose,
      visitingUnit,
      societyId,
      entryTime: new Date(),
      createdByGuard: req.user._id,
    });
    return res.status(201).json({ success: true, message: 'Vehicle entry created.', data: entry });
  } catch (error) {
    return res.status(400).json({ success: false, message: 'Failed to create vehicle entry.', data: null });
  }
}

async function vehicleExit(req, res) {
  try {
    const societyId = await getSocietyIdFromUser(req);
    const { vehicleLogId } = req.body;
    if (!societyId || !vehicleLogId) {
      return res.status(400).json({ success: false, message: 'vehicleLogId is required.', data: null });
    }
    const entry = await VehicleLog.findOne({ _id: vehicleLogId, societyId });
    if (!entry) {
      return res.status(404).json({ success: false, message: 'Vehicle log not found.', data: null });
    }
    entry.exitTime = new Date();
    await entry.save();
    return res.status(200).json({ success: true, message: 'Vehicle exit marked.', data: entry });
  } catch (error) {
    return res.status(400).json({ success: false, message: 'Failed to mark vehicle exit.', data: null });
  }
}

async function vehicleLogs(req, res) {
  try {
    const filter = {};
    if (req.user.societyId) filter.societyId = req.user.societyId;
    if (req.query.societyId) filter.societyId = req.query.societyId;
    Object.assign(filter, buildDateFilter(req.query));
    const { page, limit, skip } = getPagination(req.query, { page: 1, limit: 20, max: 100 });

    const [logs, total] = await Promise.all([
      VehicleLog.find(filter)
        .populate('visitingUnit', 'unitNumber')
        .populate('createdByGuard', 'name')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      VehicleLog.countDocuments(filter),
    ]);
    return res.status(200).json({
      success: true,
      message: 'Vehicle logs fetched.',
      data: logs,
      meta: { pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to fetch vehicle logs.', data: null });
  }
}

async function packageReceived(req, res) {
  try {
    const societyId = await getSocietyIdFromUser(req);
    if (!societyId) {
      return res.status(400).json({ success: false, message: 'Guard is not mapped to a society.', data: null });
    }
    const { courierCompany, packageType, residentId = null, unitId = null } = req.body;
    if (!courierCompany || !packageType) {
      return res.status(400).json({ success: false, message: 'courierCompany and packageType are required.', data: null });
    }

    let resolvedResidentId = residentId;
    let resolvedUnitId = unitId;
    if (!resolvedResidentId && resolvedUnitId) {
      const resolved = await resolveResidentFromUnit(resolvedUnitId);
      resolvedResidentId = resolved?.residentId || null;
    }
    const delivery = await Delivery.create({
      courierCompany,
      packageType,
      residentId: resolvedResidentId || null,
      unitId: resolvedUnitId || null,
      societyId,
      receivedByGuard: req.user._id,
      receivedTime: new Date(),
      status: 'Received',
    });
    return res.status(201).json({ success: true, message: 'Package received logged.', data: delivery });
  } catch (error) {
    return res.status(400).json({ success: false, message: 'Failed to log package received.', data: null });
  }
}

async function receivedPackagesForGuard(req, res) {
  try {
    const societyId = await getSocietyIdFromUser(req);
    if (!societyId) {
      return res.status(400).json({ success: false, message: 'Guard is not mapped to a society.', data: null });
    }
    const filter = { societyId, status: 'Received', ...buildDateFilter(req.query) };
    const { page, limit, skip } = getPagination(req.query, { page: 1, limit: 20, max: 100 });
    const [packages, total] = await Promise.all([
      Delivery.find(filter)
        .populate('residentId', 'name email')
        .populate('unitId', 'unitNumber')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Delivery.countDocuments(filter),
    ]);
    return res.status(200).json({
      success: true,
      message: 'Received packages fetched.',
      data: packages,
      meta: { pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } },
    });
  } catch {
    return res.status(500).json({ success: false, message: 'Failed to fetch received packages.', data: null });
  }
}

async function packageDelivered(req, res) {
  try {
    const societyId = await getSocietyIdFromUser(req);
    const { deliveryId } = req.body;
    if (!societyId || !deliveryId) {
      return res.status(400).json({ success: false, message: 'deliveryId is required.', data: null });
    }
    const delivery = await Delivery.findOne({ _id: deliveryId, societyId });
    if (!delivery) {
      return res.status(404).json({ success: false, message: 'Delivery log not found.', data: null });
    }
    delivery.status = 'Delivered';
    delivery.deliveredTime = new Date();
    await delivery.save();
    return res.status(200).json({ success: true, message: 'Package marked as delivered.', data: delivery });
  } catch (error) {
    return res.status(400).json({ success: false, message: 'Failed to mark package delivered.', data: null });
  }
}

async function myPackages(req, res) {
  try {
    const filter = { residentId: req.user._id, ...buildDateFilter(req.query) };
    const { page, limit, skip } = getPagination(req.query, { page: 1, limit: 20, max: 100 });
    const [packages, total] = await Promise.all([
      Delivery.find(filter)
        .populate('unitId', 'unitNumber')
        .populate('receivedByGuard', 'name')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Delivery.countDocuments(filter),
    ]);
    return res.status(200).json({
      success: true,
      message: 'My packages fetched.',
      data: packages,
      meta: { pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to fetch packages.', data: null });
  }
}

async function allPackages(req, res) {
  try {
    const filter = {};
    if (req.user.societyId) filter.societyId = req.user.societyId;
    if (req.query.societyId) filter.societyId = req.query.societyId;
    Object.assign(filter, buildDateFilter(req.query));
    const { page, limit, skip } = getPagination(req.query, { page: 1, limit: 20, max: 100 });

    const [packages, total] = await Promise.all([
      Delivery.find(filter)
        .populate('residentId', 'name email')
        .populate('unitId', 'unitNumber')
        .populate('receivedByGuard', 'name')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Delivery.countDocuments(filter),
    ]);
    return res.status(200).json({
      success: true,
      message: 'All packages fetched.',
      data: packages,
      meta: { pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to fetch all packages.', data: null });
  }
}

async function deliveryResidentLookup(req, res) {
  try {
    const societyId = await getSocietyIdFromUser(req);
    if (!societyId) {
      return res.status(400).json({ success: false, message: 'Guard is not mapped to a society.', data: null });
    }
    const flatNumber = String(req.query.flatNumber || '').trim();
    if (!flatNumber) {
      return res.status(400).json({ success: false, message: 'flatNumber is required.', data: null });
    }

    const resolved = await resolveResidentByFlatNumber(societyId, flatNumber);
    if (!resolved) {
      return res.status(404).json({ success: false, message: 'Resident not found for this flat number.', data: null });
    }

    return res.status(200).json({
      success: true,
      message: 'Resident resolved successfully.',
      data: {
        residentId: resolved.resident._id,
        residentName: resolved.resident.name,
        residentPhone: resolved.resident.phone || '',
        flatNumber: resolved.unit.unitNumber,
      },
    });
  } catch {
    return res.status(500).json({ success: false, message: 'Failed to resolve resident.', data: null });
  }
}

async function sendDeliveryOtp(req, res) {
  try {
    const societyId = await getSocietyIdFromUser(req);
    if (!societyId) {
      return res.status(400).json({ success: false, message: 'Guard is not mapped to a society.', data: null });
    }
    const {
      deliveryType,
      deliveryPersonName,
      phone,
      flatNumber,
      isEmergency = false,
    } = req.body;
    if (!deliveryType || !deliveryPersonName || !phone || !flatNumber) {
      return res.status(400).json({ success: false, message: 'deliveryType, deliveryPersonName, phone and flatNumber are required.', data: null });
    }

    const resolved = await resolveResidentByFlatNumber(societyId, flatNumber);
    if (!resolved) {
      return res.status(404).json({ success: false, message: 'Resident not found for this flat number.', data: null });
    }

    const emergencyRequest = Boolean(isEmergency) || isEmergencyDeliveryRequest({ deliveryType, deliveryPersonName });
    const dndState = await getResidentDndState(resolved.resident._id);
    if (dndState.enabled && !emergencyRequest) {
      return res.status(403).json({
        success: false,
        message: 'Resident has enabled Do Not Disturb mode. Delivery approval is currently restricted.',
        data: null,
      });
    }

    const otp = randomOtp4();
    const otpExpiresAt = new Date(Date.now() + 5 * 60 * 1000);
    const entry = await DeliveryEntry.create({
      deliveryPersonName: String(deliveryPersonName).trim(),
      phone: normalizePhone(phone),
      deliveryType: String(deliveryType).trim(),
      flatNumber: String(flatNumber).trim(),
      residentId: resolved.resident._id,
      otp,
      otpExpiresAt,
      otpVerifiedAt: null,
      status: 'Pending',
      guardId: req.user._id,
      societyId,
    });

    const smsText = `Your delivery is waiting at the society gate. Share this OTP with the guard to allow entry: ${otp}`;
    let delivered = false;
    try {
      await sendOtpSms({ phone: resolved.resident.phone, otp });
      delivered = true;
    } catch {
      // Fallback for local testing.
      // eslint-disable-next-line no-console
      console.log(`[DeliveryOTP] phone=${resolved.resident.phone} otp=${otp}`);
    }

    return res.status(201).json({
      success: true,
      message: 'OTP generated successfully.',
      data: {
        deliveryEntryId: entry._id,
        residentId: resolved.resident._id,
        residentName: resolved.resident.name,
        residentPhone: resolved.resident.phone || '',
        otpExpiresAt,
        devOtp: delivered || process.env.NODE_ENV === 'production' ? undefined : otp,
      },
    });
  } catch {
    return res.status(400).json({ success: false, message: 'Failed to send delivery OTP.', data: null });
  }
}

async function verifyDeliveryOtp(req, res) {
  try {
    const societyId = await getSocietyIdFromUser(req);
    if (!societyId) {
      return res.status(400).json({ success: false, message: 'Guard is not mapped to a society.', data: null });
    }
    const { deliveryEntryId, otp } = req.body;
    if (!deliveryEntryId || !otp) {
      return res.status(400).json({ success: false, message: 'deliveryEntryId and otp are required.', data: null });
    }

    const entry = await DeliveryEntry.findOne({
      _id: deliveryEntryId,
      societyId,
      guardId: req.user._id,
    });
    if (!entry) {
      return res.status(404).json({ success: false, message: 'Delivery request not found.', data: null });
    }
    if (entry.status === 'Entered' || entry.status === 'Exited') {
      return res.status(400).json({ success: false, message: 'Entry already processed for this delivery.', data: null });
    }
    if (!entry.otpExpiresAt || new Date(entry.otpExpiresAt).getTime() < Date.now()) {
      return res.status(400).json({ success: false, message: 'OTP expired. Please resend OTP.', data: null });
    }
    if (String(entry.otp) !== String(otp).trim()) {
      return res.status(400).json({ success: false, message: 'Invalid OTP.', data: null });
    }

    entry.status = 'Approved';
    entry.otpVerifiedAt = new Date();
    await entry.save();

    return res.status(200).json({ success: true, message: 'OTP verified successfully.', data: entry });
  } catch {
    return res.status(400).json({ success: false, message: 'Failed to verify OTP.', data: null });
  }
}

async function allowDeliveryEntry(req, res) {
  try {
    const societyId = await getSocietyIdFromUser(req);
    if (!societyId) {
      return res.status(400).json({ success: false, message: 'Guard is not mapped to a society.', data: null });
    }
    const { deliveryEntryId } = req.body;
    if (!deliveryEntryId) {
      return res.status(400).json({ success: false, message: 'deliveryEntryId is required.', data: null });
    }

    const entry = await DeliveryEntry.findOne({
      _id: deliveryEntryId,
      societyId,
      guardId: req.user._id,
    });
    if (!entry) {
      return res.status(404).json({ success: false, message: 'Delivery request not found.', data: null });
    }
    if (entry.status !== 'Approved') {
      return res.status(403).json({ success: false, message: 'OTP must be verified before allowing entry.', data: null });
    }

    entry.status = 'Entered';
    entry.entryTime = new Date();
    await entry.save();

    await createNotificationsForUsers({
      userIds: [String(entry.residentId)],
      societyId,
      type: 'delivery_entry',
      title: 'Delivery Entry Approved',
      message: `Your ${entry.deliveryType} delivery has entered the society at ${entry.entryTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`,
      link: '/app/visitor-management',
      payload: {
        deliveryEntryId: entry._id,
      },
    });

    return res.status(200).json({ success: true, message: 'Delivery entry allowed.', data: entry });
  } catch {
    return res.status(400).json({ success: false, message: 'Failed to allow delivery entry.', data: null });
  }
}

async function deliveryExit(req, res) {
  try {
    const societyId = await getSocietyIdFromUser(req);
    const { id } = req.params;
    if (!societyId || !id) {
      return res.status(400).json({ success: false, message: 'delivery entry id is required.', data: null });
    }

    const entry = await DeliveryEntry.findOne({
      _id: id,
      societyId,
      guardId: req.user._id,
    });
    if (!entry) {
      return res.status(404).json({ success: false, message: 'Delivery entry not found.', data: null });
    }
    if (entry.status !== 'Entered') {
      return res.status(400).json({ success: false, message: 'Only entered deliveries can be exited.', data: null });
    }

    entry.status = 'Exited';
    entry.exitTime = new Date();
    await entry.save();

    return res.status(200).json({ success: true, message: 'Delivery exit marked.', data: entry });
  } catch {
    return res.status(400).json({ success: false, message: 'Failed to mark delivery exit.', data: null });
  }
}

async function guardDeliveryHistory(req, res) {
  try {
    const societyId = await getSocietyIdFromUser(req);
    if (!societyId) {
      return res.status(400).json({ success: false, message: 'Guard is not mapped to a society.', data: null });
    }

    const filter = { societyId };
    if (req.query.flatNumber) filter.flatNumber = String(req.query.flatNumber).trim();
    if (req.query.status) filter.status = String(req.query.status).trim();

    const rows = await DeliveryEntry.find(filter)
      .populate('residentId', 'name phone')
      .populate('guardId', 'name')
      .sort({ createdAt: -1 })
      .limit(150);

    return res.status(200).json({ success: true, message: 'Delivery history fetched.', data: rows });
  } catch {
    return res.status(500).json({ success: false, message: 'Failed to fetch delivery history.', data: null });
  }
}

async function emergencyAlert(req, res) {
  try {
    const actorRole = getNormalizedActorRole(req.user);
    const allowedRoles = [ROLES.GUARD, ROLES.ADMIN, ROLES.SUPER_ADMIN, ROLES.COMMITTEE, ROLES.TENANT, ROLES.OWNER, ROLES.RESIDENT];
    if (!allowedRoles.includes(actorRole)) {
      return res.status(403).json({ success: false, message: 'Forbidden: insufficient role permissions.', data: null });
    }

    const societyId = await getSocietyIdFromUser(req);
    if (!societyId) {
      return res.status(400).json({ success: false, message: 'User is not mapped to a society.', data: null });
    }
    const { alertType, description, location } = req.body;
    if (!alertType || !description || !location) {
      return res.status(400).json({ success: false, message: 'alertType, description and location are required.', data: null });
    }
    const alert = await EmergencyAlert.create({
      alertType,
      description: String(description || '').trim(),
      location: String(location || '').trim(),
      societyId,
      reportedByUser: req.user._id,
      reportedByGuard: actorRole === ROLES.GUARD ? req.user._id : null,
    });

    const role = String(getNormalizedActorRole(req.user) || '').toUpperCase();
    const operationalRoles = [
      ROLES.ADMIN,
      ROLES.SUPER_ADMIN,
      ROLES.GUARD,
      'ADMIN',
      'SUPER_ADMIN',
      'GUARD',
      'SECURITY_GUARD',
      'society_admin',
      'security',
      'security_guard',
      'guard_user',
    ];
    const recipients = await User.find({
      societyId,
      _id: { $ne: req.user._id },
      isDeleted: { $ne: true },
      role: { $in: operationalRoles },
      $or: [{ status: 'Active' }, { status: { $exists: false } }, { isActive: true }],
    }).select('_id');

    await createNotificationsForUsers({
      userIds: recipients.map((row) => String(row._id)),
      societyId,
      type: 'emergency_alert',
      title: `${alertType} Emergency Alert`,
      message: `${role} ${req.user.name || 'User'} raised an emergency at ${alert.location}.`,
      link: '/app/visitor-management',
      payload: {
        emergencyAlertId: alert._id,
        alertType: alert.alertType,
        location: alert.location,
        description: alert.description,
        reportedByUser: req.user._id,
      },
    });

    return res.status(201).json({ success: true, message: 'Emergency alert created.', data: alert });
  } catch (error) {
    return res.status(400).json({ success: false, message: 'Failed to create emergency alert.', data: null });
  }
}

async function emergencyAlerts(req, res) {
  try {
    const actorRole = getNormalizedActorRole(req.user);
    const allowedRoles = [ROLES.GUARD, ROLES.ADMIN, ROLES.SUPER_ADMIN, ROLES.COMMITTEE, ROLES.TENANT, ROLES.OWNER, ROLES.RESIDENT];
    if (!allowedRoles.includes(actorRole)) {
      return res.status(403).json({ success: false, message: 'Forbidden: insufficient role permissions.', data: null });
    }

    const filter = {};
    const societyId = await getSocietyIdFromUser(req);
    if (societyId) filter.societyId = societyId;
    
    const includeResolved = String(req.query.includeResolved || '').toLowerCase() === 'true';
    if (!includeResolved) {
      await autoResolveStaleEmergencies({ societyId: filter.societyId || null });
    }
    if (!includeResolved) {
      filter.$or = [{ status: { $exists: false } }, { status: 'ACTIVE' }];
    }
    const forceMine = actorRole === ROLES.TENANT || actorRole === ROLES.OWNER || actorRole === ROLES.RESIDENT;
    if (forceMine || String(req.query.mine || '') === 'true') {
      const mineFilter = [{ reportedByUser: req.user._id }, { reportedByGuard: req.user._id }];
      if (filter.$or) {
        filter.$and = [{ $or: filter.$or }, { $or: mineFilter }];
        delete filter.$or;
      } else {
        filter.$or = mineFilter;
      }
    }
    const alerts = await EmergencyAlert.find(filter)
      .populate('reportedByUser', 'name email role')
      .populate('reportedByGuard', 'name email role')
      .sort({ createdAt: -1 });
    return res.status(200).json({ success: true, message: 'Emergency alerts fetched.', data: alerts });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to fetch emergency alerts.', data: null });
  }
}

async function resolveEmergencyAlert(req, res) {
  try {
    if (!canResolveEmergency(req.user)) {
      return res.status(403).json({ success: false, message: 'Forbidden: insufficient role permissions.', data: null });
    }
    const societyId = (await getSocietyIdFromUser(req)) || req.query.societyId || req.body.societyId || null;
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ success: false, message: 'Emergency alert id is required.', data: null });
    }

    let alert = await EmergencyAlert.findById(id);
    if (!alert) {
      return res.status(404).json({ success: false, message: 'Emergency alert not found.', data: null });
    }

    // In single-society mode, do not hard fail on legacy mapping mismatches.
    if (societyId && alert.societyId && String(alert.societyId) !== String(societyId)) {
      const singleSocietyId = await getSingleSocietyId();
      if (!singleSocietyId) {
        return res.status(403).json({ success: false, message: 'Forbidden: emergency belongs to another society.', data: null });
      }
    }
    if (alert.status === 'RESOLVED') {
      return res.status(200).json({ success: true, message: 'Emergency already resolved.', data: alert });
    }

    // Backward-compatible resolve update:
    // use atomic update (not doc.save) so legacy/partial rows don't fail strict validation.
    const resolvedAt = new Date();
    await EmergencyAlert.updateOne(
      { _id: alert._id },
      {
        $set: {
          status: 'RESOLVED',
          resolvedAt,
          resolvedBy: req.user._id,
          reportedByUser: alert.reportedByUser || alert.reportedByGuard || req.user._id,
        },
      }
    );

    const notificationSocietyId = alert.societyId || societyId;

    try {
      const operationalRoles = [
        ROLES.ADMIN,
        ROLES.SUPER_ADMIN,
        ROLES.GUARD,
        'ADMIN',
        'SUPER_ADMIN',
        'GUARD',
        'SECURITY_GUARD',
        'society_admin',
        'security',
        'security_guard',
        'guard_user',
      ];
      const recipients = await User.find({
        societyId: notificationSocietyId,
        isDeleted: { $ne: true },
        role: { $in: operationalRoles },
        $or: [{ status: 'Active' }, { status: { $exists: false } }, { isActive: true }],
      }).select('_id');

      const recipientIds = new Set(recipients.map((row) => String(row._id)));
      if (alert.reportedByUser) recipientIds.add(String(alert.reportedByUser));

      await createNotificationsForUsers({
        userIds: Array.from(recipientIds),
        societyId: notificationSocietyId,
        type: 'emergency_resolved',
        title: `${alert.alertType} Emergency Resolved`,
        message: `Emergency at ${alert.location} has been marked resolved.`,
        link: '/app/dashboard',
        payload: {
          emergencyAlertId: alert._id,
          status: alert.status,
          location: alert.location,
        },
      });
    } catch {
      // Keep resolve flow successful even if notification write/stream fails.
    }

    const populated = await EmergencyAlert.findById(alert._id)
      .populate('reportedByUser', 'name email role')
      .populate('reportedByGuard', 'name email role')
      .populate('resolvedBy', 'name email role');

    return res.status(200).json({ success: true, message: 'Emergency resolved successfully.', data: populated });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error?.message || 'Failed to resolve emergency alert.',
      data: null,
    });
  }
}

async function myEmergencyAlerts(req, res) {
  try {
    const actorRole = getNormalizedActorRole(req.user);
    const allowedRoles = [ROLES.GUARD, ROLES.ADMIN, ROLES.SUPER_ADMIN, ROLES.COMMITTEE, ROLES.TENANT, ROLES.OWNER, ROLES.RESIDENT];
    if (!allowedRoles.includes(actorRole)) {
      return res.status(403).json({ success: false, message: 'Forbidden: insufficient role permissions.', data: null });
    }

    const societyId = await getSocietyIdFromUser(req);
    const filter = {
      $or: [{ reportedByUser: req.user._id }, { reportedByGuard: req.user._id }],
    };
    if (societyId) filter.societyId = societyId;

    const alerts = await EmergencyAlert.find(filter)
      .sort({ createdAt: -1 })
      .limit(10);
    return res.status(200).json({ success: true, message: 'Emergency alerts fetched.', data: alerts });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to fetch emergency alerts.', data: null });
  }
}

async function dailyReport(req, res) {
  try {
    const societyId = req.user.societyId || req.query.societyId || null;
    if (!societyId) {
      return res.status(400).json({ success: false, message: 'societyId is required.', data: null });
    }
    const { start, end } = todayRange();
    const match = { societyId: new mongoose.Types.ObjectId(societyId), createdAt: { $gte: start, $lte: end } };

    const [visitorStats, vehicleStats, deliveryStats] = await Promise.all([
      Visitor.aggregate([
        { $match: match },
        {
          $group: {
            _id: null,
            totalVisitorsToday: { $sum: 1 },
            lateNightVisitors: { $sum: { $cond: ['$lateNightEntry', 1, 0] } },
            currentlyInsideVisitors: {
              $sum: { $cond: [{ $in: ['$status', ['Entered', 'Approved', 'Pending']] }, 1, 0] },
            },
          },
        },
      ]),
      VehicleLog.aggregate([
        { $match: match },
        { $group: { _id: null, totalVehiclesToday: { $sum: 1 } } },
      ]),
      Delivery.aggregate([
        { $match: match },
        { $group: { _id: null, totalDeliveriesToday: { $sum: 1 } } },
      ]),
    ]);

    return res.status(200).json({
      success: true,
      message: 'Daily security report fetched.',
      data: {
        totalVisitorsToday: visitorStats[0]?.totalVisitorsToday || 0,
        totalVehiclesToday: vehicleStats[0]?.totalVehiclesToday || 0,
        totalDeliveriesToday: deliveryStats[0]?.totalDeliveriesToday || 0,
        lateNightVisitors: visitorStats[0]?.lateNightVisitors || 0,
        currentlyInsideVisitors: visitorStats[0]?.currentlyInsideVisitors || 0,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to fetch daily report.', data: null });
  }
}

async function listBlacklist(req, res) {
  try {
    const societyId = req.user.societyId || req.query.societyId || null;
    if (!societyId) {
      return res.status(400).json({ success: false, message: 'societyId is required.', data: null });
    }
    const records = await BlacklistVisitor.find({ societyId }).sort({ createdAt: -1 });
    return res.status(200).json({ success: true, message: 'Blacklist fetched.', data: records });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to fetch blacklist.', data: null });
  }
}

async function addBlacklist(req, res) {
  try {
    const societyId = req.user.societyId || req.body.societyId || null;
    if (!societyId) {
      return res.status(400).json({ success: false, message: 'societyId is required.', data: null });
    }
    const { name, phone, reason } = req.body;
    if (!name || !phone || !reason) {
      return res.status(400).json({ success: false, message: 'name, phone and reason are required.', data: null });
    }
    const record = await BlacklistVisitor.findOneAndUpdate(
      { societyId, phone: normalizePhone(phone) },
      { $set: { name, phone: normalizePhone(phone), reason, addedByAdmin: req.user._id } },
      { upsert: true, new: true }
    );
    return res.status(201).json({ success: true, message: 'Blacklist visitor added.', data: record });
  } catch (error) {
    return res.status(400).json({ success: false, message: 'Failed to add blacklist visitor.', data: null });
  }
}

async function deleteBlacklist(req, res) {
  try {
    const societyId = req.user.societyId || req.query.societyId || null;
    const { id } = req.params;
    const deleted = await BlacklistVisitor.findOneAndDelete({ _id: id, ...(societyId ? { societyId } : {}) });
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Blacklist record not found.', data: null });
    }
    return res.status(200).json({ success: true, message: 'Blacklist visitor removed.', data: deleted });
  } catch (error) {
    return res.status(400).json({ success: false, message: 'Failed to remove blacklist visitor.', data: null });
  }
}

async function listWatchlist(req, res) {
  try {
    const societyId = req.user.societyId || req.query.societyId || null;
    if (!societyId) {
      return res.status(400).json({ success: false, message: 'societyId is required.', data: null });
    }
    const records = await WatchlistVisitor.find({ societyId }).sort({ createdAt: -1 });
    return res.status(200).json({ success: true, message: 'Watchlist fetched.', data: records });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to fetch watchlist.', data: null });
  }
}

async function addWatchlist(req, res) {
  try {
    const societyId = req.user.societyId || req.body.societyId || null;
    if (!societyId) {
      return res.status(400).json({ success: false, message: 'societyId is required.', data: null });
    }
    const { name, phone, notes = '' } = req.body;
    if (!name || !phone) {
      return res.status(400).json({ success: false, message: 'name and phone are required.', data: null });
    }
    const record = await WatchlistVisitor.findOneAndUpdate(
      { societyId, phone: normalizePhone(phone) },
      { $set: { name, phone: normalizePhone(phone), notes, addedByAdmin: req.user._id } },
      { upsert: true, new: true }
    );
    return res.status(201).json({ success: true, message: 'Watchlist visitor added.', data: record });
  } catch (error) {
    return res.status(400).json({ success: false, message: 'Failed to add watchlist visitor.', data: null });
  }
}

async function deleteWatchlist(req, res) {
  try {
    const societyId = req.user.societyId || req.query.societyId || null;
    const { id } = req.params;
    const deleted = await WatchlistVisitor.findOneAndDelete({ _id: id, ...(societyId ? { societyId } : {}) });
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Watchlist record not found.', data: null });
    }
    return res.status(200).json({ success: true, message: 'Watchlist visitor removed.', data: deleted });
  } catch (error) {
    return res.status(400).json({ success: false, message: 'Failed to remove watchlist visitor.', data: null });
  }
}

async function guardUnits(req, res) {
  try {
    const societyId = await getSocietyIdFromUser(req);
    if (!societyId) {
      return res.status(400).json({ success: false, message: 'Guard is not mapped to a society.', data: null });
    }
    const units = await Unit.find({
      societyId,
      isDeleted: { $ne: true },
      status: 'OCCUPIED',
    })
      .select('unitNumber flatNumber wing status occupancyStatus assignedResidentId tenantId ownerId')
      .sort({ unitNumber: 1 });
    return res.status(200).json({ success: true, message: 'Units fetched.', data: units });
  } catch {
    return res.status(500).json({ success: false, message: 'Failed to fetch units.', data: null });
  }
}

async function guardResidents(req, res) {
  try {
    const societyId = await getSocietyIdFromUser(req);
    if (!societyId) {
      return res.status(400).json({ success: false, message: 'Guard is not mapped to a society.', data: null });
    }
    const residents = await User.find({
      societyId,
      role: { $in: ['tenant', 'owner', 'resident'] },
      isDeleted: { $ne: true },
    })
      .select('name email')
      .sort({ name: 1 });
    return res.status(200).json({ success: true, message: 'Residents fetched.', data: residents });
  } catch {
    return res.status(500).json({ success: false, message: 'Failed to fetch residents.', data: null });
  }
}

module.exports = {
  visitorEntry,
  visitorExit,
  todayVisitors,
  allVisitors,
  visitorReport,
  myVisitors,
  vehicleEntry,
  vehicleExit,
  vehicleLogs,
  packageReceived,
  packageDelivered,
  receivedPackagesForGuard,
  myPackages,
  allPackages,
  emergencyAlert,
  emergencyAlerts,
  resolveEmergencyAlert,
  myEmergencyAlerts,
  dailyReport,
  listBlacklist,
  addBlacklist,
  deleteBlacklist,
  listWatchlist,
  addWatchlist,
  deleteWatchlist,
  guardUnits,
  guardResidents,
  deliveryResidentLookup,
  sendDeliveryOtp,
  verifyDeliveryOtp,
  allowDeliveryEntry,
  deliveryExit,
  guardDeliveryHistory,
};

