const mongoose = require('mongoose');
const Society = require('../models/Society');
const MaintenanceBill = require('../models/MaintenanceBill');
const Resident = require('../models/Resident');
const Unit = require('../models/Unit');
const Visitor = require('../models/Visitor');
const Staff = require('../models/Staff');
const StaffEntryLog = require('../models/StaffEntryLog');
const DeliveryEntry = require('../models/DeliveryEntry');
const ServiceRequest = require('../models/ServiceRequest');

function inr(value) {
  return `₹${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfWeek() {
  const d = startOfToday();
  d.setDate(d.getDate() - 6);
  return d;
}

function startOfMonth() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function startOfYear() {
  const d = new Date();
  return new Date(d.getFullYear(), 0, 1);
}

async function resolveSocietyId({ actor, requestedSocietyId }) {
  if (actor?.societyId) return actor.societyId;
  if (requestedSocietyId && mongoose.Types.ObjectId.isValid(String(requestedSocietyId))) return requestedSocietyId;
  const fallback = await Society.findOne({ isDeleted: { $ne: true } }).sort({ createdAt: 1 }).select('_id');
  return fallback?._id || null;
}

async function answerAiQuestion({ actor, question, requestedSocietyId = null }) {
  const q = String(question || '').trim();
  if (!q) {
    return { answer: 'Please type a question.', intent: 'empty', rows: [] };
  }
  const lower = q.toLowerCase();
  const societyId = await resolveSocietyId({ actor, requestedSocietyId });
  if (!societyId) {
    return { answer: 'No society context found for this admin account.', intent: 'scope_missing', rows: [] };
  }

  const maintenanceBase = { societyId };
  const visitorBase = { societyId };
  const staffBase = { societyId };
  const deliveryBase = { societyId };
  const serviceBase = { societyId };

  const asksRevenue = lower.includes('revenue') || lower.includes('maintenance collected') || lower.includes('collected');
  const asksPendingDues = lower.includes('pending dues') || lower.includes('unpaid') || lower.includes('due');
  const asksResidents = lower.includes('resident');
  const asksVisitors = lower.includes('visitor');
  const asksStaff = lower.includes('staff') || lower.includes('maid') || lower.includes('domestic');
  const asksDeliveries = lower.includes('deliver') || lower.includes('swiggy') || lower.includes('zomato') || lower.includes('amazon');
  const asksService = lower.includes('service request') || lower.includes('complaint') || lower.includes('open request') || lower.includes('resolved');
  const asksFlats = lower.includes('flat');

  if (asksRevenue) {
    if (lower.includes('year')) {
      const total = await MaintenanceBill.aggregate([
        { $match: { ...maintenanceBase, status: 'Paid', paidAt: { $gte: startOfYear() } } },
        { $group: { _id: null, value: { $sum: { $add: ['$amount', '$lateFee'] } }, count: { $sum: 1 } } },
      ]);
      const value = total[0]?.value || 0;
      const count = total[0]?.count || 0;
      return { answer: `This year, total maintenance collected is ${inr(value)} across ${count} paid bills.`, intent: 'maintenance_year', rows: total };
    }
    if (lower.includes('month') || lower.includes('this month')) {
      const total = await MaintenanceBill.aggregate([
        { $match: { ...maintenanceBase, status: 'Paid', paidAt: { $gte: startOfMonth() } } },
        { $group: { _id: null, value: { $sum: { $add: ['$amount', '$lateFee'] } }, count: { $sum: 1 } } },
      ]);
      const value = total[0]?.value || 0;
      const count = total[0]?.count || 0;
      return { answer: `This month, maintenance collected is ${inr(value)} from ${count} paid bills.`, intent: 'maintenance_month', rows: total };
    }
    const total = await MaintenanceBill.aggregate([
      { $match: { ...maintenanceBase, status: 'Paid' } },
      { $group: { _id: null, value: { $sum: { $add: ['$amount', '$lateFee'] } }, count: { $sum: 1 } } },
    ]);
    return { answer: `Total collected maintenance revenue is ${inr(total[0]?.value || 0)} across ${total[0]?.count || 0} paid bills.`, intent: 'maintenance_total', rows: total };
  }

  if (asksPendingDues) {
    const pending = await MaintenanceBill.find({ ...maintenanceBase, status: { $in: ['Unpaid', 'Overdue'] } })
      .populate('residentId', 'name')
      .sort({ dueDate: 1 })
      .limit(50)
      .lean();
    if (!pending.length) {
      return { answer: 'No pending maintenance dues found.', intent: 'dues_none', rows: [] };
    }
    const total = pending.reduce((sum, row) => sum + Number(row.amount || 0) + Number(row.lateFee || 0), 0);
    if (lower.includes('highest')) {
      const byResident = new Map();
      pending.forEach((row) => {
        const key = String(row.residentId?._id || row.residentId || 'unknown');
        byResident.set(key, (byResident.get(key) || 0) + Number(row.amount || 0) + Number(row.lateFee || 0));
      });
      const [winnerId, winnerAmount] = [...byResident.entries()].sort((a, b) => b[1] - a[1])[0];
      const winnerRow = pending.find((row) => String(row.residentId?._id || row.residentId || '') === winnerId);
      return {
        answer: `Highest pending dues are ${inr(winnerAmount)} for ${winnerRow?.residentId?.name || 'a resident'}.`,
        intent: 'dues_highest',
        rows: pending,
      };
    }
    if (asksFlats) {
      const residentIds = [...new Set(pending.map((row) => String(row.residentId?._id || row.residentId)).filter(Boolean))];
      const residents = await Resident.find({ societyId, userId: { $in: residentIds } }).select('userId flatNumber').lean();
      const flatByUser = new Map(residents.map((row) => [String(row.userId), row.flatNumber]));
      const lines = pending
        .slice(0, 8)
        .map((row) => `${flatByUser.get(String(row.residentId?._id || row.residentId)) || '-'} (${inr(Number(row.amount || 0) + Number(row.lateFee || 0))})`);
      return {
        answer: `Flats with unpaid dues include: ${lines.join(', ')}${pending.length > 8 ? ' ...' : ''}. Total pending is ${inr(total)}.`,
        intent: 'dues_flats',
        rows: pending,
      };
    }
    return { answer: `Pending maintenance dues are ${inr(total)} across ${pending.length} unpaid/overdue bills.`, intent: 'dues_pending', rows: pending };
  }

  if (asksResidents) {
    if (lower.includes('list')) {
      const rows = await Resident.find({ societyId }).select('name flatNumber occupancyType').sort({ flatNumber: 1 }).limit(30).lean();
      const names = rows.map((row) => `${row.name} (${row.flatNumber})`);
      return { answer: rows.length ? `Resident list: ${names.join(', ')}.` : 'No residents found.', intent: 'residents_list', rows };
    }
    const total = await Resident.countDocuments({ societyId });
    return { answer: `Total residents in this society: ${total}.`, intent: 'residents_total', rows: [{ total }] };
  }

  if (asksFlats && (lower.includes('without resident') || lower.includes('vacant'))) {
    const vacant = await Unit.find({
      societyId,
      $or: [{ ownerId: null, tenantId: null }, { occupancyStatus: 'Vacant' }],
    }).select('unitNumber').sort({ unitNumber: 1 }).limit(50).lean();
    const values = vacant.map((item) => item.unitNumber);
    return {
      answer: values.length ? `Flats without residents: ${values.slice(0, 12).join(', ')}${values.length > 12 ? ' ...' : ''}.` : 'No vacant flats found.',
      intent: 'flats_vacant',
      rows: vacant,
    };
  }

  if (asksVisitors) {
    if (lower.includes('today')) {
      const count = await Visitor.countDocuments({ ...visitorBase, createdAt: { $gte: startOfToday() } });
      return { answer: `Visitors entered/requested today: ${count}.`, intent: 'visitors_today', rows: [{ count }] };
    }
    if (lower.includes('week')) {
      const count = await Visitor.countDocuments({ ...visitorBase, createdAt: { $gte: startOfWeek() } });
      return { answer: `Visitors in the last 7 days: ${count}.`, intent: 'visitors_week', rows: [{ count }] };
    }
    const rows = await Visitor.find(visitorBase).sort({ createdAt: -1 }).limit(10).select('visitorName purpose status createdAt').lean();
    return { answer: rows.length ? `Recent visitors: ${rows.map((row) => `${row.visitorName} (${row.status})`).join(', ')}.` : 'No visitor logs found.', intent: 'visitors_logs', rows };
  }

  if (asksStaff) {
    const [total, activeEntries] = await Promise.all([
      Staff.countDocuments(staffBase),
      StaffEntryLog.countDocuments({ ...staffBase, exitTime: null }),
    ]);
    return { answer: `Total domestic staff registered: ${total}. Active staff entries right now: ${activeEntries}.`, intent: 'staff_stats', rows: [{ total, activeEntries }] };
  }

  if (asksDeliveries) {
    if (lower.includes('today')) {
      const count = await DeliveryEntry.countDocuments({ ...deliveryBase, createdAt: { $gte: startOfToday() } });
      return { answer: `Deliveries logged today: ${count}.`, intent: 'deliveries_today', rows: [{ count }] };
    }
    const rows = await DeliveryEntry.find(deliveryBase).sort({ createdAt: -1 }).limit(10).select('deliveryType flatNumber status entryTime').lean();
    return { answer: rows.length ? `Recent deliveries: ${rows.map((row) => `${row.deliveryType} (${row.flatNumber}, ${row.status})`).join(', ')}.` : 'No delivery logs found.', intent: 'deliveries_logs', rows };
  }

  if (asksService) {
    const [openCount, resolvedCount] = await Promise.all([
      ServiceRequest.countDocuments({ ...serviceBase, status: { $in: ['Pending', 'Assigned', 'InProgress'] } }),
      ServiceRequest.countDocuments({ ...serviceBase, status: 'Completed' }),
    ]);
    return {
      answer: `Open service requests: ${openCount}. Resolved service requests: ${resolvedCount}.`,
      intent: 'service_stats',
      rows: [{ openCount, resolvedCount }],
    };
  }

  return {
    answer: 'I can help with revenue, pending dues, residents, visitors, domestic staff, deliveries, and service requests. Try: "How much maintenance was collected this month?"',
    intent: 'fallback',
    rows: [],
  };
}

module.exports = {
  answerAiQuestion,
};
