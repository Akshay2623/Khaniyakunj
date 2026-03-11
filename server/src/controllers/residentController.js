const Resident = require('../models/Resident');
const Society = require('../models/Society');
const User = require('../models/User');
const Unit = require('../models/Unit');
const { ROLES } = require('../constants/roles');
const MaintenanceBill = require('../models/MaintenanceBill');
const ServiceRequest = require('../models/ServiceRequest');
const Notice = require('../models/Notice');
const Visitor = require('../models/Visitor');
const mongoose = require('mongoose');
const ResidentActivity = require('../models/ResidentActivity');
const { generateResidentInsights } = require('../services/residentInsightsService');
const { getResidentDndState, resolveDndExpiryFromTimer } = require('../services/dndService');
const { generateTemporaryPassword, createUserInviteRecord, dispatchUserInvite } = require('../services/inviteService');
const { createLifecycleUser, updateLifecycleUser } = require('../services/userOnboardingService');

async function getResidents(req, res) {
  try {
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(req.query.limit) || 10, 1), 100);
    const skip = (page - 1) * limit;
    const search = (req.query.search || '').trim();
    const { societyId } = req.query;

    const query = {};

    if (req.user.societyId) {
      query.societyId = req.user.societyId;
    } else if (societyId) {
      query.societyId = societyId;
    }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { flatNumber: { $regex: search, $options: 'i' } },
      ];
    }

    const [residents, total] = await Promise.all([
      Resident.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Resident.countDocuments(query),
    ]);

    const userIds = residents.map((row) => row.userId).filter(Boolean);
    const linkedUsers = await User.find({ _id: { $in: userIds } }).select('_id role unitId').lean();
    const userMap = new Map(linkedUsers.map((row) => [String(row._id), row]));

    const residentUserIds = userIds.filter((id) => mongoose.Types.ObjectId.isValid(String(id))).map((id) => new mongoose.Types.ObjectId(String(id)));
    const units = await Unit.find({
      societyId: query.societyId || req.user.societyId,
      isDeleted: { $ne: true },
      $or: [
        { assignedResidentId: { $in: residentUserIds } },
        { tenantId: { $in: residentUserIds } },
        { ownerId: { $in: residentUserIds } },
      ],
    })
      .select('_id unitNumber flatNumber wing assignedResidentId tenantId ownerId')
      .lean();

    const unitByUserId = new Map();
    for (const unit of units) {
      const linkedId = unit.assignedResidentId || unit.tenantId || unit.ownerId;
      if (linkedId) {
        unitByUserId.set(String(linkedId), unit);
      }
    }

    const enriched = residents.map((resident) => {
      const row = resident.toObject();
      const linkedUser = row.userId ? userMap.get(String(row.userId)) : null;
      const linkedUnit = row.userId ? unitByUserId.get(String(row.userId)) : null;
      return {
        ...row,
        linkedRole: linkedUser?.role || null,
        unitId: linkedUnit?._id || linkedUser?.unitId || null,
        assignedUnit: linkedUnit
          ? {
              _id: linkedUnit._id,
              unitNumber: linkedUnit.unitNumber || linkedUnit.flatNumber || '',
              wing: linkedUnit.wing || '',
            }
          : null,
      };
    });

    return res.status(200).json({
      data: enriched,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch residents.' });
  }
}

async function createResident(req, res) {
  try {
    const { societyId, name, email, phone, flatNumber, block, occupancyType, unitId } = req.body;

    const resolvedSocietyId = req.user.societyId || societyId;
    if (!resolvedSocietyId) {
      return res.status(400).json({ message: 'societyId is required.' });
    }

    const societyExists = await Society.exists({ _id: resolvedSocietyId });
    if (!societyExists) {
      return res.status(404).json({ message: 'Society not found.' });
    }

    // New production flow: resident + unit assignment in a single onboarding step.
    if (unitId) {
      const normalizedRole = String(req.body.role || '').trim().toLowerCase() === 'tenant' || String(occupancyType || '').toLowerCase() === 'tenant'
        ? ROLES.TENANT
        : ROLES.RESIDENT;
      const created = await createLifecycleUser({
        actor: req.user,
        payload: {
          name: String(name || '').trim(),
          email: String(email || '').trim().toLowerCase(),
          phone: String(phone || '').trim(),
          role: normalizedRole,
          societyId: resolvedSocietyId,
          unitId,
          status: 'Active',
          sendInvite: true,
        },
      });

      const createdResident = await Resident.findOne({ userId: created.id, societyId: resolvedSocietyId }).lean();
      const assignedUnit = await Unit.findById(unitId).select('_id unitNumber flatNumber wing').lean();
      return res.status(201).json({
        ...(createdResident || {
          name: created.name,
          email: created.email,
          phone: created.phone,
          societyId: created.societyId,
          userId: created.id,
          flatNumber: assignedUnit?.unitNumber || assignedUnit?.flatNumber || '',
          block: assignedUnit?.wing || '',
          occupancyType: normalizedRole === ROLES.TENANT ? 'tenant' : 'owner',
        }),
        assignedUnit,
        account: {
          userId: created.id,
          email: created.email,
          role: created.role,
          temporaryPassword: created.temporaryPassword,
          credentialsSent: String(created?.invite?.status || '').toUpperCase() === 'SENT',
        },
        message: `Resident created and assigned to ${assignedUnit?.unitNumber || assignedUnit?.flatNumber || 'selected unit'} successfully.`,
      });
    }

    // Backward-compatible legacy resident-only flow (without unit inventory).
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const resident = await Resident.create({
      societyId: resolvedSocietyId,
      name,
      email: normalizedEmail,
      phone,
      flatNumber,
      block,
      occupancyType: String(occupancyType || '').toLowerCase(),
      createdBy: req.user._id,
    });

    let linkedUser = await User.findOne({ email: normalizedEmail, isDeleted: { $ne: true } });
    let tempPassword = '';
    let inviteMessage = '';

    if (linkedUser) {
      linkedUser.name = resident.name;
      linkedUser.phone = resident.phone;
      linkedUser.role = ROLES.RESIDENT;
      linkedUser.societyId = resident.societyId;
      linkedUser.residentId = resident._id;
      linkedUser.status = 'Active';
      linkedUser.isActive = true;
      await linkedUser.save();
    } else {
      tempPassword = generateTemporaryPassword();
      linkedUser = await User.create({
        name: resident.name,
        email: normalizedEmail,
        phone: resident.phone,
        password: tempPassword,
        role: ROLES.RESIDENT,
        societyId: resident.societyId,
        residentId: resident._id,
        createdBy: req.user._id,
        mustChangePassword: true,
        temporaryPasswordIssuedAt: new Date(),
        status: 'Active',
        isActive: true,
      });

      const invite = await createUserInviteRecord({
        user: linkedUser,
        temporaryPassword: tempPassword,
      });

      try {
        await dispatchUserInvite({ user: linkedUser, invite });
        inviteMessage = ' Login credentials sent to resident email.';
      } catch (inviteError) {
        inviteMessage = ` Resident created, but email delivery failed: ${inviteError.message}`;
      }
    }

    resident.userId = linkedUser._id;
    await resident.save();

    return res.status(201).json({
      ...resident.toObject(),
      account: {
        userId: linkedUser._id,
        email: linkedUser.email,
        role: linkedUser.role,
        credentialsSent: Boolean(inviteMessage && inviteMessage.includes('sent')),
        ...(tempPassword ? { temporaryPassword: tempPassword } : {}),
      },
      message: `Resident account created successfully.${inviteMessage}`,
    });
  } catch (error) {
    if (error.code === 11000) {
      if (error.keyPattern && error.keyPattern.email) {
        return res.status(409).json({ message: 'Resident email already exists.' });
      }
      return res.status(409).json({ message: 'Flat number already exists in this society.' });
    }
    return res.status(400).json({ message: 'Invalid resident data.' });
  }
}

async function getResidentById(req, res) {
  try {
    const { id } = req.params;
    const resident = await Resident.findById(id);

    if (!resident) {
      return res.status(404).json({ message: 'Resident not found.' });
    }

    if (req.user.role === ROLES.RESIDENT && String(resident.userId) !== String(req.user._id)) {
      return res.status(403).json({ message: 'Forbidden: you can only view your own profile.' });
    }

    return res.status(200).json(resident);
  } catch (error) {
    return res.status(400).json({ message: 'Invalid resident id.' });
  }
}

async function updateResident(req, res) {
  try {
    const { id } = req.params;
    const { societyId, name, email, flatNumber, block, phone, occupancyType, unitId } = req.body;
    const resolvedSocietyId = req.user.societyId || societyId;

    if (!resolvedSocietyId) {
      return res.status(400).json({ message: 'societyId is required.' });
    }

    let resident = await Resident.findById(id);

    if (!resident) {
      return res.status(404).json({ message: 'Resident not found.' });
    }

    if (resident.userId && unitId !== undefined) {
      await updateLifecycleUser({
        actor: req.user,
        userId: resident.userId,
        payload: {
          name,
          email,
          phone,
          societyId: resolvedSocietyId,
          unitId: unitId || null,
        },
      });

      const selectedUnit = unitId
        ? await Unit.findById(unitId).select('unitNumber wing')
        : null;
      resident.societyId = resolvedSocietyId;
      if (name !== undefined) resident.name = name;
      if (email !== undefined) resident.email = String(email || '').trim().toLowerCase();
      if (phone !== undefined) resident.phone = phone;
      if (selectedUnit) {
        resident.flatNumber = selectedUnit.unitNumber || selectedUnit.flatNumber || resident.flatNumber;
        resident.block = selectedUnit.wing || resident.block;
      } else {
        if (flatNumber !== undefined) resident.flatNumber = flatNumber;
        if (block !== undefined) resident.block = block;
      }
      if (occupancyType !== undefined) resident.occupancyType = String(occupancyType || '').toLowerCase();
      await resident.save();
      return res.status(200).json(resident);
    }

    resident = await Resident.findByIdAndUpdate(
      id,
      {
        societyId: resolvedSocietyId,
        name,
        email,
        flatNumber,
        block,
        phone,
        occupancyType: String(occupancyType || '').toLowerCase(),
      },
      { new: true, runValidators: true }
    );

    if (resident.userId) {
      await User.findByIdAndUpdate(resident.userId, {
        name: resident.name,
        email: resident.email,
        societyId: resident.societyId,
      });
    }

    return res.status(200).json(resident);
  } catch (error) {
    if (error.code === 11000) {
      if (error.keyPattern && error.keyPattern.email) {
        return res.status(409).json({ message: 'Resident email already exists.' });
      }
      return res.status(409).json({ message: 'Flat number already exists in this society.' });
    }
    return res.status(400).json({ message: 'Invalid resident update data.' });
  }
}

async function deleteResident(req, res) {
  try {
    const { id } = req.params;
    const resident = await Resident.findByIdAndDelete(id);

    if (!resident) {
      return res.status(404).json({ message: 'Resident not found.' });
    }

    if (resident.userId) {
      await User.findByIdAndDelete(resident.userId);
    }

    return res.status(200).json({ message: 'Resident deleted successfully.' });
  } catch (error) {
    return res.status(400).json({ message: 'Failed to delete resident.' });
  }
}

async function getMyResidentProfile(req, res) {
  try {
    const resident = await Resident.findOne({ userId: req.user._id }).populate(
      'societyId',
      'name address'
    ).populate('userId', 'phone emergencyContact profileImageUrl languagePreference timezone notificationPreferences uiPreferences');
    if (!resident) {
      return res.status(404).json({ message: 'Resident profile not found.' });
    }

    return res.status(200).json(resident);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch resident profile.' });
  }
}

function getLastSixMonthKeys() {
  const values = [];
  const now = new Date();
  now.setDate(1);
  for (let idx = 5; idx >= 0; idx -= 1) {
    const point = new Date(now.getFullYear(), now.getMonth() - idx, 1);
    const key = `${point.getFullYear()}-${String(point.getMonth() + 1).padStart(2, '0')}`;
    const label = point.toLocaleString('en-US', { month: 'short' });
    values.push({ key, label });
  }
  return values;
}

async function getResidentDashboard(req, res) {
  try {
    const residentId = req.user._id;
    const linkedResidentIds = [req.user._id];
    if (req.user.residentId) linkedResidentIds.push(req.user.residentId);
    const scopeSocietyId = req.user.societyId;
    const today = new Date();
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const nextMonthStart = new Date(today.getFullYear(), today.getMonth() + 1, 1);

    const residentProfile = await Resident.findOne({ userId: residentId }).select('societyId').lean();
    const societyId = scopeSocietyId || residentProfile?.societyId;
    const dndState = await getResidentDndState(residentId);

    const baseBillFilter = { residentId };
    if (societyId) baseBillFilter.societyId = societyId;

    const [
      dueSummary,
      nextDueBill,
      pendingServiceRequests,
      upcomingEvents,
      visitorCountThisMonth,
      paymentSummary,
      lastPayment,
    ] = await Promise.all([
      MaintenanceBill.aggregate([
        { $match: { ...baseBillFilter, status: { $in: ['Unpaid', 'Overdue'] } } },
        {
          $group: {
            _id: null,
            total: { $sum: { $add: ['$amount', '$lateFee'] } },
          },
        },
      ]),
      MaintenanceBill.findOne({
        ...baseBillFilter,
        status: { $in: ['Unpaid', 'Overdue'] },
      })
        .sort({ dueDate: 1 })
        .select('dueDate')
        .lean(),
      ServiceRequest.countDocuments({
        residentId,
        ...(societyId ? { societyId } : {}),
        status: { $in: ['Pending', 'Assigned', 'InProgress'] },
      }),
      Notice.find({
        ...(societyId ? { societyId } : {}),
      })
        .sort({ isPinned: -1, createdAt: -1 })
        .limit(5)
        .select('title description isPinned createdAt')
        .lean(),
      Visitor.countDocuments({
        residentId: { $in: linkedResidentIds },
        ...(societyId ? { societyId } : {}),
        createdAt: { $gte: monthStart, $lt: nextMonthStart },
      }),
      MaintenanceBill.aggregate([
        { $match: baseBillFilter },
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
      MaintenanceBill.findOne({
        ...baseBillFilter,
        status: 'Paid',
        paidAt: { $ne: null },
      })
        .sort({ paidAt: -1 })
        .select('paidAt')
        .lean(),
    ]);

    const paymentRateSource = paymentSummary[0] || { total: 0, paid: 0 };
    const paymentCompletionRate =
      paymentRateSource.total > 0
        ? Number(((paymentRateSource.paid / paymentRateSource.total) * 100).toFixed(2))
        : 0;

    // Amenity module may not exist in all deployments; keep this dynamic and safe.
    let amenityBookingsCount = 0;
    try {
      const hasAmenityCollection = mongoose.connection.db
        .listCollections({ name: 'amenitybookings' })
        .toArray()
        .then((collections) => collections.length > 0);
      if (await hasAmenityCollection) {
        amenityBookingsCount = await mongoose.connection.db.collection('amenitybookings').countDocuments({
          residentId: new mongoose.Types.ObjectId(residentId),
          ...(societyId ? { societyId: new mongoose.Types.ObjectId(societyId) } : {}),
          createdAt: { $gte: monthStart, $lt: nextMonthStart },
        });
      }
    } catch {
      amenityBookingsCount = 0;
    }

    const statusIndicator =
      nextDueBill && new Date(nextDueBill.dueDate) < today ? 'Overdue' : dueSummary.length ? 'Due' : 'Paid';

    const insights = await generateResidentInsights(residentId);

    return res.status(200).json({
      success: true,
      message: 'Resident dashboard fetched successfully.',
      data: {
        totalMaintenanceDue: Number((dueSummary[0]?.total || 0).toFixed(2)),
        nextDueDate: nextDueBill?.dueDate || null,
        pendingServiceRequests,
        upcomingEvents: upcomingEvents.map((event) => ({
          id: event._id,
          title: event.title,
          description: event.description,
          isPinned: event.isPinned,
          date: event.createdAt,
        })),
        visitorCountThisMonth,
        amenityBookingsCount,
        paymentCompletionRate,
        lastPaymentDate: lastPayment?.paidAt || null,
        statusIndicator,
        insights,
        dnd: {
          enabled: dndState.enabled,
          expiryTime: dndState.expiryTime,
        },
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to fetch resident dashboard.', data: null });
  }
}

async function updateResidentDnd(req, res) {
  try {
    const resident = await Resident.findOne({ userId: req.user._id });
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Resident user not found.', data: null });
    }

    const enabled = Boolean(req.body.enabled);
    const timer = String(req.body.timer || 'manual');
    const expiry = enabled ? resolveDndExpiryFromTimer(timer) : null;

    user.dndEnabled = enabled;
    user.dndExpiryTime = expiry;
    await user.save();

    if (resident) {
      resident.dndEnabled = enabled;
      resident.dndExpiryTime = expiry;
      await resident.save();
    }

    try {
      await ResidentActivity.create({
        residentId: req.user._id,
        societyId: req.user.societyId || resident?.societyId || user.societyId || null,
        activityType: 'PRIVACY_DND_UPDATED',
        title: 'Do Not Disturb updated',
        description: enabled ? 'Resident enabled Do Not Disturb mode.' : 'Resident disabled Do Not Disturb mode.',
        metadata: {
          dndEnabled: user.dndEnabled,
          dndExpiryTime: user.dndExpiryTime,
          timer,
        },
      });
    } catch {
      // Activity logging should not block DND preference updates.
    }

    return res.status(200).json({
      success: true,
      message: user.dndEnabled
        ? 'Do Not Disturb mode enabled. Guards will not send visitor or delivery requests during this time.'
        : 'Do Not Disturb mode disabled.',
      data: {
        enabled: user.dndEnabled,
        expiryTime: user.dndExpiryTime,
      },
    });
  } catch {
    return res.status(400).json({ success: false, message: 'Failed to update Do Not Disturb mode.', data: null });
  }
}

async function getResidentFinancialAnalytics(req, res) {
  try {
    const residentId = req.user._id;
    const role = req.user.role;
    const monthKeys = getLastSixMonthKeys();
    const keySet = monthKeys.map((month) => month.key);
    const labelSet = monthKeys.map((month) => month.label);

    const baseMatch = {
      residentId: new mongoose.Types.ObjectId(residentId),
      month: { $in: keySet },
    };

    const [paidByMonth, outstandingByMonth, paymentMethods] = await Promise.all([
      MaintenanceBill.aggregate([
        { $match: { ...baseMatch, status: 'Paid' } },
        {
          $group: {
            _id: '$month',
            total: { $sum: { $add: ['$amount', '$lateFee'] } },
          },
        },
      ]),
      MaintenanceBill.aggregate([
        { $match: { ...baseMatch, status: { $ne: 'Paid' } } },
        {
          $group: {
            _id: '$month',
            total: { $sum: { $add: ['$amount', '$lateFee'] } },
          },
        },
      ]),
      MaintenanceBill.aggregate([
        {
          $match: {
            residentId: new mongoose.Types.ObjectId(residentId),
            status: 'Paid',
          },
        },
        {
          $group: {
            _id: { $ifNull: ['$paymentMethod', 'Unknown'] },
            value: { $sum: 1 },
          },
        },
      ]),
    ]);

    const paidMap = new Map(paidByMonth.map((item) => [item._id, item.total]));
    const dueMap = new Map(outstandingByMonth.map((item) => [item._id, item.total]));
    const paidSeries = keySet.map((key) => Number((paidMap.get(key) || 0).toFixed(2)));
    const dueSeries = keySet.map((key) => Number((dueMap.get(key) || 0).toFixed(2)));

    const paymentMethodLabels = paymentMethods.map((row) => row._id || 'Unknown');
    const paymentMethodValues = paymentMethods.map((row) => row.value);

    // Owners get additional expense distribution view.
    let expenseDistribution = null;
    if (role === ROLES.OWNER) {
      const [expense] = await MaintenanceBill.aggregate([
        { $match: { residentId: new mongoose.Types.ObjectId(residentId) } },
        {
          $group: {
            _id: null,
            maintenanceBase: { $sum: '$amount' },
            lateFees: { $sum: '$lateFee' },
            outstanding: {
              $sum: {
                $cond: [{ $ne: ['$status', 'Paid'] }, { $add: ['$amount', '$lateFee'] }, 0],
              },
            },
          },
        },
      ]);

      expenseDistribution = {
        labels: ['Maintenance', 'Late Fees', 'Outstanding'],
        datasets: [
          {
            label: 'Expense Distribution',
            data: [
              Number((expense?.maintenanceBase || 0).toFixed(2)),
              Number((expense?.lateFees || 0).toFixed(2)),
              Number((expense?.outstanding || 0).toFixed(2)),
            ],
          },
        ],
      };
    }

    return res.status(200).json({
      success: true,
      message: 'Resident financial analytics fetched successfully.',
      data: {
        monthlyPayments: {
          labels: labelSet,
          datasets: [{ label: 'Payments', data: paidSeries }],
        },
        outstandingBalanceTrend: {
          labels: labelSet,
          datasets: [{ label: 'Outstanding', data: dueSeries }],
        },
        paymentMethodBreakdown: {
          labels: paymentMethodLabels.length ? paymentMethodLabels : ['No Payments'],
          datasets: [{ label: 'Payment Methods', data: paymentMethodValues.length ? paymentMethodValues : [0] }],
        },
        expenseDistribution,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to fetch financial analytics.', data: null });
  }
}

async function getResidentActivity(req, res) {
  try {
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(req.query.limit) || 10, 1), 50);
    const skip = (page - 1) * limit;

    const [activities, total] = await Promise.all([
      ResidentActivity.find({ residentId: req.user._id })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      ResidentActivity.countDocuments({ residentId: req.user._id }),
    ]);

    return res.status(200).json({
      success: true,
      message: 'Resident activity fetched successfully.',
      data: activities,
      meta: {
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to fetch resident activity.', data: null });
  }
}

async function updateResidentProfile(req, res) {
  try {
    const allowedPayload = {
      phone: req.body.phone,
      emergencyContact: req.body.emergencyContact,
      profileImageUrl: req.body.profileImageUrl,
      languagePreference: req.body.languagePreference,
      timezone: req.body.timezone,
      notificationPreferences: req.body.notificationPreferences,
      uiPreferences: req.body.uiPreferences,
    };

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Resident user not found.', data: null });
    }

    Object.entries(allowedPayload).forEach(([key, value]) => {
      if (value !== undefined) user[key] = value;
    });

    if (req.body.currentPassword && req.body.newPassword) {
      const validPassword = await user.comparePassword(req.body.currentPassword);
      if (!validPassword) {
        return res.status(401).json({ success: false, message: 'Current password is incorrect.', data: null });
      }
      user.password = req.body.newPassword;
      user.mustChangePassword = false;
      user.temporaryPasswordIssuedAt = null;
    }

    await user.save();

    await ResidentActivity.create({
      residentId: user._id,
      societyId: user.societyId || null,
      activityType: 'PROFILE_UPDATED',
      title: 'Profile updated',
      description: 'Resident updated profile or preferences.',
      metadata: {
        updatedFields: Object.keys(allowedPayload).filter((key) => allowedPayload[key] !== undefined),
        passwordChanged: Boolean(req.body.currentPassword && req.body.newPassword),
      },
    });

    return res.status(200).json({
      success: true,
      message: 'Profile updated successfully.',
      data: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        emergencyContact: user.emergencyContact,
        profileImageUrl: user.profileImageUrl,
        languagePreference: user.languagePreference,
        timezone: user.timezone,
        notificationPreferences: user.notificationPreferences,
        uiPreferences: user.uiPreferences,
      },
    });
  } catch (error) {
    return res.status(400).json({ success: false, message: 'Failed to update profile.', data: null });
  }
}

module.exports = {
  getResidents,
  createResident,
  getResidentById,
  updateResident,
  deleteResident,
  getMyResidentProfile,
  getResidentDashboard,
  getResidentFinancialAnalytics,
  getResidentActivity,
  updateResidentProfile,
  updateResidentDnd,
};
