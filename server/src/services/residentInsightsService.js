const MaintenanceBill = require('../models/MaintenanceBill');
const ServiceRequest = require('../models/ServiceRequest');

async function generateResidentInsights(userId) {
  const now = new Date();

  const [latestPaidBill, unresolvedRequestsCount, paidStats] = await Promise.all([
    MaintenanceBill.findOne({ residentId: userId, status: 'Paid', paidAt: { $ne: null } })
      .sort({ paidAt: -1 })
      .select('paidAt dueDate month')
      .lean(),
    ServiceRequest.countDocuments({
      residentId: userId,
      status: { $in: ['Pending', 'Assigned', 'InProgress'] },
    }),
    MaintenanceBill.aggregate([
      { $match: { residentId: userId } },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          paid: {
            $sum: {
              $cond: [{ $eq: ['$status', 'Paid'] }, 1, 0],
            },
          },
        },
      },
    ]),
  ]);

  const insights = [];

  if (latestPaidBill?.paidAt && latestPaidBill?.dueDate) {
    const diffMs = new Date(latestPaidBill.dueDate).getTime() - new Date(latestPaidBill.paidAt).getTime();
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays > 0) {
      insights.push(`You paid maintenance ${diffDays} day${diffDays > 1 ? 's' : ''} earlier than due date. Great job!`);
    } else if (diffDays < 0) {
      insights.push(`Your last payment was ${Math.abs(diffDays)} day${Math.abs(diffDays) > 1 ? 's' : ''} after due date. Try paying a little earlier.`);
    } else {
      insights.push('You paid right on the due date. Nice discipline!');
    }
  }

  if (unresolvedRequestsCount > 0) {
    insights.push(`You have ${unresolvedRequestsCount} unresolved service request${unresolvedRequestsCount > 1 ? 's' : ''}.`);
  } else {
    insights.push('All your service requests are resolved. Excellent upkeep!');
  }

  const stats = paidStats[0] || { total: 0, paid: 0 };
  const consistency = stats.total ? (stats.paid / stats.total) * 100 : 0;
  if (consistency >= 90) {
    insights.push('Your payment consistency is Excellent.');
  } else if (consistency >= 70) {
    insights.push('Your payment consistency is Good. Keep the momentum.');
  } else if (stats.total > 0) {
    insights.push('Your payment consistency needs attention. Consider reminders before due dates.');
  }

  if (!insights.length) {
    insights.push('No enough activity yet for personalized insights. Keep using the dashboard.');
  }

  return insights;
}

module.exports = {
  generateResidentInsights,
};
