const mongoose = require('mongoose');
const Resident = require('../models/Resident');
const Society = require('../models/Society');
const ServiceRequest = require('../models/ServiceRequest');
const MaintenanceBill = require('../models/MaintenanceBill');
const { autoMarkOverdue } = require('./maintenanceController');

function getScopeFilter(req) {
  if (req.user.societyId) {
    return { societyId: new mongoose.Types.ObjectId(req.user.societyId) };
  }

  if (req.query.societyId) {
    return { societyId: new mongoose.Types.ObjectId(req.query.societyId) };
  }

  return {};
}

function getCurrentMonthKey() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

function getLastSixMonthKeys() {
  const months = [];
  const now = new Date();
  now.setDate(1);

  for (let i = 5; i >= 0; i -= 1) {
    const dt = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const year = dt.getFullYear();
    const month = String(dt.getMonth() + 1).padStart(2, '0');
    months.push(`${year}-${month}`);
  }

  return months;
}

async function getDashboardStats(req, res) {
  try {
    const scopeFilter = getScopeFilter(req);

    const billOverdueFilter = req.user.societyId
      ? { societyId: req.user.societyId }
      : req.query.societyId
      ? { societyId: req.query.societyId }
      : {};
    await autoMarkOverdue(billOverdueFilter);

    const monthKey = req.query.month || getCurrentMonthKey();
    const lastSixMonths = getLastSixMonthKeys();
    const trendStart = new Date();
    trendStart.setMonth(trendStart.getMonth() - 5);
    trendStart.setDate(1);
    trendStart.setHours(0, 0, 0, 0);

    const [
      residentCountAgg,
      totalFlatsAgg,
      pendingComplaintsAgg,
      overdueBillsAgg,
      monthlyRevenueAgg,
      complaintDistributionAgg,
      serviceTrendAgg,
    ] = await Promise.all([
      Resident.aggregate([
        { $match: scopeFilter },
        { $count: 'totalResidents' },
      ]),
      Society.aggregate([
        { $match: scopeFilter },
        { $group: { _id: null, totalFlats: { $sum: '$totalFlats' } } },
      ]),
      ServiceRequest.aggregate([
        { $match: { ...scopeFilter, status: 'Pending' } },
        { $count: 'pendingComplaints' },
      ]),
      MaintenanceBill.aggregate([
        { $match: { ...scopeFilter, status: 'Overdue' } },
        { $count: 'overdueBills' },
      ]),
      MaintenanceBill.aggregate([
        { $match: { ...scopeFilter, status: 'Paid', month: monthKey } },
        {
          $group: {
            _id: null,
            paidAmount: { $sum: '$amount' },
            lateFeeCollected: { $sum: '$lateFee' },
            billCount: { $sum: 1 },
          },
        },
        {
          $project: {
            _id: 0,
            paidAmount: 1,
            lateFeeCollected: 1,
            totalRevenue: { $add: ['$paidAmount', '$lateFeeCollected'] },
            billCount: 1,
          },
        },
      ]),
      ServiceRequest.aggregate([
        { $match: scopeFilter },
        { $group: { _id: '$category', count: { $sum: 1 } } },
        { $project: { _id: 0, category: '$_id', count: 1 } },
        { $sort: { category: 1 } },
      ]),
      ServiceRequest.aggregate([
        {
          $match: {
            ...scopeFilter,
            createdAt: { $gte: trendStart },
          },
        },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
            total: { $sum: 1 },
            completed: {
              $sum: {
                $cond: [{ $eq: ['$status', 'Completed'] }, 1, 0],
              },
            },
          },
        },
        { $project: { _id: 0, month: '$_id', total: 1, completed: 1 } },
        { $sort: { month: 1 } },
      ]),
    ]);

    const trendMap = new Map(serviceTrendAgg.map((item) => [item.month, item]));
    const serviceRequestTrend = lastSixMonths.map((month) => {
      const row = trendMap.get(month);
      return {
        month,
        total: row ? row.total : 0,
        completed: row ? row.completed : 0,
      };
    });

    return res.status(200).json({
      totals: {
        totalResidents: residentCountAgg[0]?.totalResidents || 0,
        totalFlats: totalFlatsAgg[0]?.totalFlats || 0,
        pendingComplaints: pendingComplaintsAgg[0]?.pendingComplaints || 0,
        overdueBills: overdueBillsAgg[0]?.overdueBills || 0,
      },
      monthlyRevenue: {
        month: monthKey,
        paidAmount: monthlyRevenueAgg[0]?.paidAmount || 0,
        lateFeeCollected: monthlyRevenueAgg[0]?.lateFeeCollected || 0,
        totalRevenue: monthlyRevenueAgg[0]?.totalRevenue || 0,
        billCount: monthlyRevenueAgg[0]?.billCount || 0,
      },
      complaintDistributionByCategory: complaintDistributionAgg,
      serviceRequestTrend,
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch dashboard statistics.' });
  }
}

module.exports = {
  getDashboardStats,
};