const mongoose = require('mongoose');
const Visitor = require('../models/Visitor');
const ResidentActivity = require('../models/ResidentActivity');
const Unit = require('../models/Unit');
const User = require('../models/User');
const Resident = require('../models/Resident');
const { getResidentDndState, isEmergencyVisitorRequest } = require('../services/dndService');
const { resolveSingleSocietyId } = require('../services/singleSocietyService');

function createQrApprovalCode() {
  return `VIS-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

async function scopedSocietyId(req, requestedSocietyId = null) {
  const resolved = await resolveSingleSocietyId({
    user: req.user,
    requestedSocietyId: requestedSocietyId || req.query?.societyId || req.body?.societyId || null,
  });
  if (resolved && req.user && !req.user.societyId) req.user.societyId = resolved;
  return resolved || null;
}

function normalizePhone(phone) {
  return String(phone || '').replace(/\s+/g, '').trim();
}

function toStartOfDay(dateValue = new Date()) {
  const date = new Date(dateValue);
  date.setHours(0, 0, 0, 0);
  return date;
}

function toEndOfDay(dateValue = new Date()) {
  const date = new Date(dateValue);
  date.setHours(23, 59, 59, 999);
  return date;
}

async function preApproveVisitor(req, res) {
  try {
    const { visitorName, phone, purpose = '' } = req.body;
    if (!visitorName || !phone) {
      return res.status(400).json({ message: 'visitorName and phone are required.' });
    }

    const societyId = await scopedSocietyId(req);
    if (!societyId) {
      return res.status(400).json({ message: 'Resident is not mapped to a society.' });
    }

    const visitor = await Visitor.create({
      visitorName,
      phone: normalizePhone(phone),
      purpose,
      residentId: req.user._id,
      societyId,
      status: 'Approved',
      approvedByResident: true,
      approvedBy: req.user._id,
      qrApprovalCode: createQrApprovalCode(),
      requestedEntryTime: new Date(),
    });

    await ResidentActivity.create({
      residentId: req.user._id,
      societyId,
      activityType: 'VISITOR_APPROVED',
      title: 'Visitor approved',
      description: `${visitorName} has been pre-approved.`,
      metadata: { visitorId: visitor._id, purpose: visitor.purpose, qrApprovalCode: visitor.qrApprovalCode },
    });

    return res.status(201).json(visitor);
  } catch {
    return res.status(400).json({ message: 'Failed to pre-approve visitor.' });
  }
}

async function createVisitorRequest(req, res) {
  try {
    const societyId = await scopedSocietyId(req);
    if (!societyId) {
      return res.status(400).json({ success: false, message: 'Guard is not mapped to a society.', data: null });
    }

    const {
      visitorName,
      phone,
      purpose = '',
      visitingUnit = null,
      residentId = null,
      requestedEntryTime = null,
      vehicleNumber = '',
      photoUrl = '',
      isEmergency = false,
    } = req.body;

    if (!visitorName || !phone || !purpose) {
      return res.status(400).json({
        success: false,
        message: 'visitorName, phone and purpose are required.',
        data: null,
      });
    }

    let finalResidentId = residentId || null;
    let finalUnitId = visitingUnit || null;

    // Accept both User._id and Resident._id from UI payload and normalize to User._id.
    if (finalResidentId) {
      const directUser = await User.findById(finalResidentId).select('_id');
      if (!directUser) {
        const residentRecord = await Resident.findById(finalResidentId).select('userId');
        if (residentRecord?.userId) {
          finalResidentId = residentRecord.userId;
        }
      }
    }

    if (!finalResidentId && finalUnitId) {
      const unit = await Unit.findOne({ _id: finalUnitId, societyId }).select('assignedResidentId tenantId ownerId');
      if (unit) {
        finalResidentId = unit.assignedResidentId || unit.tenantId || unit.ownerId || null;
      }

      // Fallback for legacy unit mapping: infer user by flat number via Resident collection.
      if (!finalResidentId && unit) {
        const fullUnit = await Unit.findById(finalUnitId).select('unitNumber');
        const residentRecord = await Resident.findOne({
          societyId,
          flatNumber: fullUnit?.unitNumber || '',
        }).select('userId');
        if (residentRecord?.userId) {
          finalResidentId = residentRecord.userId;
        }
      }
    }

    if (!finalResidentId) {
      return res.status(400).json({
        success: false,
        message: 'Resident mapping is required. Select a flat or tenant for approval.',
        data: null,
      });
    }

    const emergencyRequest = Boolean(isEmergency) || isEmergencyVisitorRequest({ purpose, visitorName });
    const dndState = await getResidentDndState(finalResidentId);

    const visitor = await Visitor.create({
      visitorName,
      phone: normalizePhone(phone),
      purpose,
      visitingUnit: finalUnitId,
      residentId: finalResidentId,
      societyId,
      requestedEntryTime: requestedEntryTime ? new Date(requestedEntryTime) : new Date(),
      vehicleNumber,
      photoUrl,
      status: dndState.enabled && !emergencyRequest ? 'Rejected' : 'Pending',
      approvedByResident: false,
      createdByGuard: req.user._id,
      rejectionReason: dndState.enabled && !emergencyRequest
        ? 'Resident has enabled Do Not Disturb mode. Visitor entry is currently restricted.'
        : '',
      isEmergency: emergencyRequest,
    });

    if (dndState.enabled && !emergencyRequest) {
      return res.status(403).json({
        success: false,
        message: 'Resident has enabled Do Not Disturb mode. Visitor entry is currently restricted.',
        data: visitor,
      });
    }

    return res.status(201).json({
      success: true,
      message: 'Visitor request sent to tenant for approval.',
      data: visitor,
    });
  } catch {
    return res.status(400).json({ success: false, message: 'Failed to create visitor request.', data: null });
  }
}

async function getTenantVisitorRequests(req, res) {
  try {
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
    const skip = (page - 1) * limit;

    const linkedResidentIds = [req.user._id];
    if (req.user.residentId) linkedResidentIds.push(req.user.residentId);
    const filter = { residentId: { $in: linkedResidentIds } };
    if (req.query.status) {
      filter.status = req.query.status;
    }

    const [visitors, total] = await Promise.all([
      Visitor.find(filter)
        .populate('visitingUnit', 'unitNumber')
        .populate('createdByGuard', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Visitor.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      message: 'Visitor requests fetched.',
      data: visitors,
      meta: {
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch {
    return res.status(500).json({ success: false, message: 'Failed to fetch visitor requests.', data: null });
  }
}

async function approveVisitorRequest(req, res) {
  try {
    const { id } = req.params;
    const societyId = await scopedSocietyId(req);
    const linkedResidentIds = [req.user._id];
    if (req.user.residentId) linkedResidentIds.push(req.user.residentId);
    const filter = { _id: id, residentId: { $in: linkedResidentIds } };
    if (societyId) filter.societyId = societyId;

    const visitor = await Visitor.findOne(filter);
    if (!visitor) {
      return res.status(404).json({ success: false, message: 'Visitor request not found.', data: null });
    }

    visitor.status = 'Approved';
    visitor.approvedByResident = true;
    visitor.approvedBy = req.user._id;
    if (req.body?.isEmergency) visitor.isEmergency = true;
    visitor.qrApprovalCode = visitor.qrApprovalCode || createQrApprovalCode();
    visitor.rejectionReason = '';
    await visitor.save();

    return res.status(200).json({
      success: true,
      message: 'Visitor approved successfully.',
      data: visitor,
    });
  } catch {
    return res.status(400).json({ success: false, message: 'Failed to approve visitor request.', data: null });
  }
}

async function markVisitorEmergency(req, res) {
  try {
    const { id } = req.params;
    const societyId = await scopedSocietyId(req);
    const role = String(req.user?.role || '').toLowerCase();
    const linkedResidentIds = [req.user._id];
    if (req.user.residentId) linkedResidentIds.push(req.user.residentId);

    const filter = { _id: id };
    if (societyId) filter.societyId = societyId;
    if (['tenant', 'owner'].includes(role)) {
      filter.residentId = { $in: linkedResidentIds };
    }

    const visitor = await Visitor.findOne(filter);
    if (!visitor) {
      return res.status(404).json({ success: false, message: 'Visitor request not found.', data: null });
    }

    visitor.isEmergency = true;
    if (visitor.status === 'Pending') {
      visitor.status = 'Approved';
      visitor.approvedByResident = true;
      visitor.approvedBy = req.user._id;
      visitor.rejectionReason = '';
      visitor.qrApprovalCode = visitor.qrApprovalCode || createQrApprovalCode();
    }
    await visitor.save();

    return res.status(200).json({
      success: true,
      message: 'Visitor marked as emergency.',
      data: visitor,
    });
  } catch {
    return res.status(400).json({ success: false, message: 'Failed to mark emergency visitor.', data: null });
  }
}

async function rejectVisitorRequest(req, res) {
  try {
    const { id } = req.params;
    const { reason = '' } = req.body;
    const societyId = await scopedSocietyId(req);
    const linkedResidentIds = [req.user._id];
    if (req.user.residentId) linkedResidentIds.push(req.user.residentId);
    const filter = { _id: id, residentId: { $in: linkedResidentIds } };
    if (societyId) filter.societyId = societyId;

    const visitor = await Visitor.findOne(filter);
    if (!visitor) {
      return res.status(404).json({ success: false, message: 'Visitor request not found.', data: null });
    }

    visitor.status = 'Rejected';
    visitor.approvedByResident = false;
    visitor.approvedBy = req.user._id;
    visitor.rejectionReason = reason;
    await visitor.save();

    return res.status(200).json({
      success: true,
      message: 'Visitor rejected. Guard has been notified in guard panel.',
      data: visitor,
    });
  } catch {
    return res.status(400).json({ success: false, message: 'Failed to reject visitor request.', data: null });
  }
}

async function markEntry(req, res) {
  try {
    const { id } = req.params;
    const societyId = await scopedSocietyId(req);
    const filter = { _id: id };
    if (societyId) filter.societyId = societyId;

    const visitor = await Visitor.findOne(filter);
    if (!visitor) {
      return res.status(404).json({ message: 'Visitor not found.' });
    }
    if (visitor.status === 'Rejected') {
      return res.status(400).json({ message: 'Entry denied: visitor was rejected by tenant.' });
    }
    if (!['Approved', 'Expected', 'Pending', 'Entered'].includes(visitor.status)) {
      return res.status(400).json({ message: 'Visitor is not eligible for entry.' });
    }

    visitor.status = 'Entered';
    visitor.entryTime = visitor.entryTime || new Date();
    await visitor.save();
    return res.status(200).json(visitor);
  } catch {
    return res.status(400).json({ message: 'Failed to mark visitor entry.' });
  }
}

async function markExit(req, res) {
  try {
    const { id } = req.params;
    const societyId = await scopedSocietyId(req);
    const filter = { _id: id };
    if (societyId) filter.societyId = societyId;

    const visitor = await Visitor.findOne(filter);
    if (!visitor) {
      return res.status(404).json({ message: 'Visitor not found.' });
    }
    if (visitor.status === 'Exited') {
      return res.status(400).json({ message: 'Visitor already exited.' });
    }

    visitor.entryTime = visitor.entryTime || new Date();
    visitor.status = 'Exited';
    visitor.exitTime = new Date();
    await visitor.save();
    return res.status(200).json(visitor);
  } catch {
    return res.status(400).json({ message: 'Failed to mark visitor exit.' });
  }
}

async function getTodayVisitors(req, res) {
  try {
    const societyId = await scopedSocietyId(req);
    if (!societyId) {
      return res.status(400).json({ message: 'Security user is not mapped to a society.' });
    }

    const visitors = await Visitor.find({
      societyId,
      createdAt: { $gte: toStartOfDay(), $lte: toEndOfDay() },
    })
      .populate('residentId', 'name email')
      .populate('visitingUnit', 'unitNumber')
      .sort({ createdAt: -1 });

    return res.status(200).json(visitors);
  } catch {
    return res.status(500).json({ message: 'Failed to fetch today visitors.' });
  }
}

async function getVisitorLogs(req, res) {
  try {
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
    const skip = (page - 1) * limit;

    const filter = {};
    const scoped = await scopedSocietyId(req);
    if (scoped) {
      filter.societyId = scoped;
    } else if (req.query.societyId) {
      filter.societyId = req.query.societyId;
    }

    if (req.query.status) {
      filter.status = req.query.status;
    }
    if (req.query.dateFrom || req.query.dateTo) {
      filter.createdAt = {};
      if (req.query.dateFrom) filter.createdAt.$gte = toStartOfDay(req.query.dateFrom);
      if (req.query.dateTo) filter.createdAt.$lte = toEndOfDay(req.query.dateTo);
    }
    if (req.query.name) {
      filter.visitorName = { $regex: req.query.name.trim(), $options: 'i' };
    }

    if (req.query.flat) {
      const units = await Unit.find({
        societyId: filter.societyId,
        unitNumber: { $regex: req.query.flat.trim(), $options: 'i' },
      }).select('_id');
      filter.visitingUnit = { $in: units.map((item) => item._id) };
    }

    const [visitors, total] = await Promise.all([
      Visitor.find(filter)
        .populate('residentId', 'name email')
        .populate('approvedBy', 'name email role')
        .populate('createdByGuard', 'name email')
        .populate('visitingUnit', 'unitNumber')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Visitor.countDocuments(filter),
    ]);

    return res.status(200).json({
      data: visitors,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch {
    return res.status(500).json({ message: 'Failed to fetch visitor logs.' });
  }
}

async function getVisitorAnalytics(req, res) {
  try {
    const societyId = await scopedSocietyId(req, req.query.societyId || null);
    if (!societyId) {
      return res.status(400).json({ success: false, message: 'societyId is required.', data: null });
    }

    const start = toStartOfDay();
    start.setDate(start.getDate() - 6);

    const matchBase = { societyId: new mongoose.Types.ObjectId(societyId) };
    const todayMatch = { ...matchBase, createdAt: { $gte: toStartOfDay(), $lte: toEndOfDay() } };
    const weekMatch = { ...matchBase, createdAt: { $gte: start, $lte: toEndOfDay() } };

    const [dailyCounts, statusBreakdown, pendingApprovals] = await Promise.all([
      Visitor.aggregate([
        { $match: weekMatch },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      Visitor.aggregate([
        { $match: todayMatch },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      Visitor.countDocuments({ ...matchBase, status: 'Pending' }),
    ]);

    return res.status(200).json({
      success: true,
      message: 'Visitor analytics fetched.',
      data: {
        pendingApprovals,
        dailyCounts,
        statusBreakdown,
      },
    });
  } catch {
    return res.status(500).json({ success: false, message: 'Failed to fetch visitor analytics.', data: null });
  }
}

async function getResidentVisitors(req, res) {
  try {
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
    const skip = (page - 1) * limit;

    const linkedResidentIds = [req.user._id];
    if (req.user.residentId) linkedResidentIds.push(req.user.residentId);

    const [visitors, total] = await Promise.all([
      Visitor.find({ residentId: { $in: linkedResidentIds } })
        .populate('visitingUnit', 'unitNumber')
        .populate('createdByGuard', 'name email')
        .select(
          'visitorName phone purpose vehicleNumber photoUrl requestedEntryTime entryTime exitTime status qrApprovalCode createdAt rejectionReason createdByGuard visitingUnit'
        )
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Visitor.countDocuments({ residentId: { $in: linkedResidentIds } }),
    ]);

    return res.status(200).json({
      success: true,
      message: 'Resident visitors fetched successfully.',
      data: visitors,
      meta: {
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch {
    return res.status(500).json({ success: false, message: 'Failed to fetch resident visitors.', data: null });
  }
}

module.exports = {
  preApproveVisitor,
  createVisitorRequest,
  getTenantVisitorRequests,
  approveVisitorRequest,
  rejectVisitorRequest,
  markVisitorEmergency,
  markEntry,
  markExit,
  getTodayVisitors,
  getVisitorLogs,
  getVisitorAnalytics,
  getResidentVisitors,
};
