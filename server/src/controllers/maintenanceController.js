const mongoose = require('mongoose');
const MaintenanceBill = require('../models/MaintenanceBill');
const User = require('../models/User');
const Unit = require('../models/Unit');
const ResidentActivity = require('../models/ResidentActivity');
const { ROLES } = require('../constants/roles');
const { resolveSingleSocietyId } = require('../services/singleSocietyService');

const LATE_FEE_RATE = 0.05;

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function parseMonth(month) {
  const monthRegex = /^\d{4}-(0[1-9]|1[0-2])$/;
  return monthRegex.test(String(month || '')) ? String(month) : null;
}

function parseMonthFromPayload({ month, billingYear, billingMonth }) {
  const fromMonth = parseMonth(month);
  if (fromMonth) return fromMonth;
  if (!billingYear || !billingMonth) return null;
  const y = Number(billingYear);
  const m = Number(billingMonth);
  if (!Number.isInteger(y) || !Number.isInteger(m) || m < 1 || m > 12) return null;
  return `${y}-${String(m).padStart(2, '0')}`;
}

async function resolveScopedSocietyId(req, requestedSocietyId = null) {
  const resolved = await resolveSingleSocietyId({
    user: req.user,
    requestedSocietyId: requestedSocietyId || req.query?.societyId || req.body?.societyId || null,
  });
  if (resolved && req.user && !req.user.societyId) req.user.societyId = resolved;
  return resolved || null;
}

function billSummary(rows = []) {
  const summary = {
    totalBills: rows.length,
    paidBills: 0,
    pendingBills: 0,
    overdueBills: 0,
    totalCollected: 0,
  };
  rows.forEach((bill) => {
    const status = String(bill.status || '').toLowerCase();
    const amount = Number(bill.amount || 0);
    const lateFee = Number(bill.lateFee || 0);
    if (status === 'paid') {
      summary.paidBills += 1;
      summary.totalCollected += amount + lateFee;
    } else if (status === 'overdue') {
      summary.overdueBills += 1;
    } else {
      summary.pendingBills += 1;
    }
  });
  summary.totalCollected = Number(summary.totalCollected.toFixed(2));
  return summary;
}

async function autoMarkOverdue(filter = {}) {
  const today = startOfToday();
  const overdueBills = await MaintenanceBill.find({
    ...filter,
    status: 'Unpaid',
    dueDate: { $lt: today },
  }).select('_id amount');

  if (!overdueBills.length) return;

  await MaintenanceBill.bulkWrite(
    overdueBills.map((bill) => ({
      updateOne: {
        filter: { _id: bill._id },
        update: {
          $set: {
            status: 'Overdue',
            lateFee: Number((Number(bill.amount || 0) * LATE_FEE_RATE).toFixed(2)),
          },
        },
      },
    }))
  );
}

async function generateMonthlyBillsBulk(req, res) {
  try {
    const { amount, dueDate } = req.body;
    const resolvedSocietyId = await resolveScopedSocietyId(req, req.body.societyId);
    if (!resolvedSocietyId) {
      return res.status(400).json({ message: 'societyId is required.' });
    }

    const parsedMonth = parseMonthFromPayload(req.body);
    if (!parsedMonth) {
      return res.status(400).json({ message: 'Billing month is required in YYYY-MM format.' });
    }

    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      return res.status(400).json({ message: 'amount must be greater than 0.' });
    }

    if (!dueDate) {
      return res.status(400).json({ message: 'dueDate is required.' });
    }
    const dueDateObj = new Date(dueDate);
    if (Number.isNaN(dueDateObj.getTime())) {
      return res.status(400).json({ message: 'dueDate is invalid.' });
    }

    const units = await Unit.find({
      societyId: resolvedSocietyId,
      isDeleted: { $ne: true },
      occupancyStatus: 'Occupied',
    }).select('unitNumber tenantId ownerId');

    if (!units.length) {
      return res.status(404).json({ message: 'No occupied flats found for bill generation.' });
    }

    const userIds = new Set();
    units.forEach((unit) => {
      if (unit.tenantId) userIds.add(String(unit.tenantId));
      else if (unit.ownerId) userIds.add(String(unit.ownerId));
    });
    const users = await User.find({
      _id: { $in: Array.from(userIds) },
      societyId: resolvedSocietyId,
      status: 'Active',
      isDeleted: { $ne: true },
      role: { $in: [ROLES.TENANT, ROLES.OWNER, ROLES.RESIDENT] },
    }).select('_id name email');
    const userMap = new Map(users.map((row) => [String(row._id), row]));

    const targetRows = units
      .map((unit) => {
        const residentId = unit.tenantId ? String(unit.tenantId) : unit.ownerId ? String(unit.ownerId) : '';
        const resident = userMap.get(residentId);
        if (!resident) return null;
        return {
          residentId: resident._id,
          flatNumber: String(unit.unitNumber || '').trim(),
          residentName: resident.name || '',
          residentEmail: resident.email || '',
        };
      })
      .filter(Boolean);

    const flatNumbers = targetRows.map((row) => row.flatNumber).filter(Boolean);
    const existingByFlat = await MaintenanceBill.find({
      societyId: resolvedSocietyId,
      month: parsedMonth,
      flatNumber: { $in: flatNumbers },
    }).select('_id flatNumber');
    const existingFlatSet = new Set(existingByFlat.map((row) => String(row.flatNumber || '').trim().toLowerCase()));

    const totalTargeted = targetRows.length;
    const now = new Date();
    let generatedCount = 0;
    let duplicateCount = 0;

    for (const row of targetRows) {
      const flatKey = String(row.flatNumber || '').trim().toLowerCase();
      if (flatKey && existingFlatSet.has(flatKey)) {
        duplicateCount += 1;
        continue;
      }

      // Backward compatibility: if older data does not have flatNumber, guard with resident+month check too.
      // eslint-disable-next-line no-await-in-loop
      const legacyExisting = await MaintenanceBill.findOne({
        societyId: resolvedSocietyId,
        month: parsedMonth,
        residentId: row.residentId,
      }).select('_id');
      if (legacyExisting) {
        duplicateCount += 1;
        continue;
      }

      // eslint-disable-next-line no-await-in-loop
      await MaintenanceBill.create({
        residentId: row.residentId,
        societyId: resolvedSocietyId,
        month: parsedMonth,
        flatNumber: row.flatNumber,
        residentName: row.residentName,
        residentEmail: row.residentEmail,
        amount: numericAmount,
        dueDate: dueDateObj,
        status: dueDateObj < startOfToday() ? 'Overdue' : 'Unpaid',
        lateFee: dueDateObj < startOfToday() ? Number((numericAmount * LATE_FEE_RATE).toFixed(2)) : 0,
        paidAt: null,
        generatedBy: req.user._id,
        createdAt: now,
        updatedAt: now,
      });
      generatedCount += 1;
      if (flatKey) existingFlatSet.add(flatKey);
    }

    const message =
      duplicateCount > 0
        ? 'Bills generated with duplicates skipped.'
        : 'Monthly bills generated successfully.';

    return res.status(201).json({
      message,
      month: parsedMonth,
      totalTargeted,
      generatedCount,
      duplicateCount,
      skippedCount: duplicateCount,
    });
  } catch {
    return res.status(500).json({ message: 'Failed to generate monthly bills in bulk.' });
  }
}

async function getAllBills(req, res) {
  try {
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
    const skip = (page - 1) * limit;

    const resolvedSocietyId = await resolveScopedSocietyId(req, req.query.societyId);
    const filter = {};
    if (resolvedSocietyId) filter.societyId = resolvedSocietyId;

    if (req.query.month) filter.month = String(req.query.month);
    if (req.query.year) filter.billingYear = Number(req.query.year);
    if (req.query.status) filter.status = req.query.status;
    if (req.query.flatNumber) filter.flatNumber = { $regex: String(req.query.flatNumber).trim(), $options: 'i' };

    const search = String(req.query.search || req.query.q || '').trim();
    if (search) {
      const searchRegex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      const matchingUsers = await User.find({
        ...(resolvedSocietyId ? { societyId: resolvedSocietyId } : {}),
        isDeleted: { $ne: true },
        $or: [{ name: { $regex: searchRegex } }, { email: { $regex: searchRegex } }],
      }).select('_id');
      const userIds = matchingUsers.map((row) => row._id);
      filter.$or = [
        { month: { $regex: searchRegex } },
        { status: { $regex: searchRegex } },
        { flatNumber: { $regex: searchRegex } },
        { residentName: { $regex: searchRegex } },
        { residentEmail: { $regex: searchRegex } },
        ...(userIds.length ? [{ residentId: { $in: userIds } }] : []),
      ];
    }

    await autoMarkOverdue(filter);

    const [bills, total, summaryRows] = await Promise.all([
      MaintenanceBill.find(filter)
        .populate('residentId', 'name email unitId')
        .populate('societyId', 'name')
        .sort({ dueDate: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit),
      MaintenanceBill.countDocuments(filter),
      MaintenanceBill.find(filter).select('status amount lateFee'),
    ]);

    const data = bills.map((bill) => {
      const residentName = bill.residentName || bill?.residentId?.name || '';
      const residentEmail = bill.residentEmail || bill?.residentId?.email || '';
      return {
        ...bill.toObject(),
        residentName,
        residentEmail,
        flatNumber: bill.flatNumber || '',
      };
    });

    return res.status(200).json({
      data,
      summary: billSummary(summaryRows),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch {
    return res.status(500).json({ message: 'Failed to fetch bills.' });
  }
}

async function getResidentBills(req, res) {
  try {
    await autoMarkOverdue({ residentId: req.user._id });

    const bills = await MaintenanceBill.find({ residentId: req.user._id })
      .populate('societyId', 'name')
      .sort({ dueDate: -1, createdAt: -1 });

    return res.status(200).json(bills);
  } catch {
    return res.status(500).json({ message: 'Failed to fetch resident bills.' });
  }
}

async function markBillAsPaid(req, res) {
  try {
    await autoMarkOverdue();

    const { id } = req.params;
    const bill = await MaintenanceBill.findById(id);

    if (!bill) {
      return res.status(404).json({ message: 'Bill not found.' });
    }

    const resolvedSocietyId = await resolveScopedSocietyId(req);
    if (resolvedSocietyId && String(resolvedSocietyId) !== String(bill.societyId)) {
      return res.status(403).json({ message: 'Forbidden: bill belongs to another society.' });
    }

    const isResidentRole = [ROLES.TENANT, ROLES.OWNER, ROLES.RESIDENT].includes(req.user.role);
    if (isResidentRole && String(bill.residentId) !== String(req.user._id)) {
      return res.status(403).json({ message: 'Forbidden: you can only pay your own bill.' });
    }

    if (bill.status === 'Paid') {
      return res.status(400).json({ message: 'Bill is already marked as paid.' });
    }

    bill.status = 'Paid';
    bill.paidAt = new Date();
    bill.paymentMethod = req.body?.paymentMethod || bill.paymentMethod || 'Online';
    await bill.save();

    await ResidentActivity.create({
      residentId: bill.residentId,
      societyId: bill.societyId,
      activityType: 'PAYMENT_MADE',
      title: 'Maintenance payment recorded',
      description: `Bill ${bill.month} marked as paid.`,
      metadata: {
        billId: bill._id,
        amount: Number(bill.amount || 0),
        lateFee: Number(bill.lateFee || 0),
        paymentMethod: bill.paymentMethod || 'Unknown',
      },
    }).catch(() => {});

    return res.status(200).json({
      message: 'Maintenance bill marked as paid successfully.',
      data: bill,
    });
  } catch {
    return res.status(400).json({ message: 'Failed to mark bill as paid.' });
  }
}

async function getMonthlyRevenueReport(req, res) {
  try {
    const year = Number(req.query.year) || new Date().getFullYear();
    const yearStart = `${year}-01`;
    const yearEnd = `${year}-12`;

    const resolvedSocietyId = await resolveScopedSocietyId(req, req.query.societyId);
    const match = {
      status: 'Paid',
      month: { $gte: yearStart, $lte: yearEnd },
    };
    if (resolvedSocietyId) {
      match.societyId = new mongoose.Types.ObjectId(resolvedSocietyId);
    }

    const report = await MaintenanceBill.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$month',
          paidAmount: { $sum: '$amount' },
          lateFeeCollected: { $sum: '$lateFee' },
          totalRevenue: { $sum: { $add: ['$amount', '$lateFee'] } },
          paidBills: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
      {
        $project: {
          _id: 0,
          month: '$_id',
          paidAmount: 1,
          lateFeeCollected: 1,
          totalRevenue: 1,
          paidBills: 1,
        },
      },
    ]);

    return res.status(200).json({ year, data: report });
  } catch {
    return res.status(500).json({ message: 'Failed to generate monthly revenue report.' });
  }
}

module.exports = {
  generateMonthlyBillsBulk,
  getAllBills,
  getResidentBills,
  markBillAsPaid,
  autoMarkOverdue,
  getMonthlyRevenueReport,
};
