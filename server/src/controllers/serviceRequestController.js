const ServiceRequest = require('../models/ServiceRequest');
const User = require('../models/User');
const ResidentActivity = require('../models/ResidentActivity');
const { ROLES, normalizeRole } = require('../constants/roles');
const { resolveSingleSocietyId, ensureUserSocietyMapping } = require('../services/singleSocietyService');
const { createNotificationsForUsers } = require('../services/notificationService');

const CATEGORY_OPTIONS = ['Electrician', 'Plumber', 'Lift', 'Water', 'Cleaning', 'Security'];
const PRIORITY_OPTIONS = ['Low', 'Medium', 'High'];
const STATUS_OPTIONS = ['Pending', 'InProgress', 'Resolved'];

function toRequestStatus(value) {
  const normalized = String(value || '')
    .trim()
    .toLowerCase();
  if (!normalized) return '';
  if (normalized === 'completed') return 'Resolved';
  if (normalized === 'assigned') return 'InProgress';
  if (normalized === 'inprogress' || normalized === 'in_progress') return 'InProgress';
  if (normalized === 'resolved') return 'Resolved';
  if (normalized === 'pending') return 'Pending';
  return '';
}

function toStorageStatus(value) {
  return toRequestStatus(value) || 'Pending';
}

function toTimelineStatus(value) {
  const mapped = toRequestStatus(value);
  if (mapped === 'InProgress') return 'InProgress';
  if (mapped === 'Resolved') return 'Completed';
  return 'Submitted';
}

function normalizeRequestRow(row) {
  if (!row || typeof row !== 'object') return row;
  const raw = row.toObject ? row.toObject() : row;
  return {
    ...raw,
    status: toStorageStatus(raw.status),
    assignedRole: String(raw.assignedRole || 'guard').toLowerCase(),
    createdByRole: String(raw.createdByRole || 'tenant').toLowerCase(),
  };
}

async function addResidentActivity({ residentId, societyId, activityType, title, description = '', metadata = {} }) {
  try {
    await ResidentActivity.create({
      residentId,
      societyId,
      activityType,
      title,
      description,
      metadata,
    });
  } catch {
    // Do not block main transaction for activity log failures.
  }
}

async function resolveRequestSocietyId(req) {
  const resolved = await resolveSingleSocietyId({
    user: req.user,
    requestedSocietyId: req.query?.societyId || req.body?.societyId || null,
  });
  if (resolved && req.user) {
    if (!req.user.societyId) req.user.societyId = resolved;
    await ensureUserSocietyMapping(req.user);
  }
  return resolved || null;
}

async function notifyCreateRequest({ request, actorId }) {
  if (!request?.societyId) return;
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
    societyId: request.societyId,
    isDeleted: { $ne: true },
    role: { $in: operationalRoles },
    _id: { $ne: actorId },
  }).select('_id');
  const userIds = recipients.map((row) => row._id);
  if (!userIds.length) return;

  await createNotificationsForUsers({
    userIds,
    societyId: request.societyId,
    type: 'service_request',
    title: 'New Service Request',
    message: `${request.title} (${request.category}) was created.`,
    link: '/app/service-requests',
    payload: {
      serviceRequestId: request._id,
      status: request.status,
      priority: request.priority,
    },
  });
}

async function notifyStatusUpdate({ request, changedBy }) {
  if (!request?.createdBy) return;
  if (String(request.createdBy) === String(changedBy)) return;

  await createNotificationsForUsers({
    userIds: [request.createdBy],
    societyId: request.societyId || null,
    type: 'service_request_status',
    title: 'Service Request Updated',
    message: `Your request "${request.title}" is now ${toStorageStatus(request.status)}.`,
    link: '/app/service-requests',
    payload: {
      serviceRequestId: request._id,
      status: toStorageStatus(request.status),
    },
  });
}

function buildRoleScopedFilter(req, includeStatusCategory = true, resolvedSocietyId = null) {
  const role = normalizeRole(req.user?.role);
  const filter = {};

  if (resolvedSocietyId || req.user?.societyId) {
    filter.societyId = resolvedSocietyId || req.user.societyId;
  }

  if (role === ROLES.ADMIN || role === ROLES.SUPER_ADMIN) {
    // Full access in society.
  } else if (role === ROLES.GUARD) {
    filter.$or = [
      { assignedRole: { $in: ['guard', 'GUARD', 'Guard'] } },
      { assignedRole: { $exists: false } },
      { assignedRole: null },
      { assignedRole: '' },
    ];
  } else if ([ROLES.COMMITTEE, ROLES.TENANT, ROLES.OWNER, ROLES.RESIDENT].includes(role)) {
    filter.createdBy = req.user._id;
  } else {
    filter.createdBy = req.user._id;
  }

  if (includeStatusCategory) {
    const mappedStatus = toRequestStatus(req.query?.status || '');
    if (mappedStatus) filter.status = mappedStatus;
    if (req.query?.category) filter.category = String(req.query.category);
  }
  return filter;
}

async function createComplaint(req, res) {
  try {
    const actorRole = normalizeRole(req.user?.role);
    const canCreate = [ROLES.ADMIN, ROLES.SUPER_ADMIN, ROLES.COMMITTEE, ROLES.TENANT, ROLES.OWNER, ROLES.RESIDENT].includes(actorRole);
    if (!canCreate) {
      return res.status(403).json({ message: 'Forbidden: insufficient role permissions.' });
    }

    const {
      title,
      description,
      category,
      priority = 'Medium',
      imageUrl = '',
      preferredVisitTime = null,
    } = req.body || {};

    if (!String(title || '').trim() || !String(description || '').trim() || !String(category || '').trim()) {
      return res.status(400).json({ message: 'title, description and category are required.' });
    }
    if (!CATEGORY_OPTIONS.includes(category)) {
      return res.status(400).json({ message: `category must be one of: ${CATEGORY_OPTIONS.join(', ')}.` });
    }
    if (!PRIORITY_OPTIONS.includes(priority)) {
      return res.status(400).json({ message: 'priority must be one of Low, Medium, High.' });
    }

    const resolvedSocietyId = await resolveRequestSocietyId(req);
    if (!resolvedSocietyId) {
      return res.status(400).json({ message: 'Unable to resolve society context.' });
    }

    const request = await ServiceRequest.create({
      title: String(title).trim(),
      description: String(description).trim(),
      imageUrl: String(imageUrl || '').trim(),
      category,
      priority,
      preferredVisitTime: preferredVisitTime ? new Date(preferredVisitTime) : null,
      residentId: req.user._id,
      societyId: resolvedSocietyId,
      status: 'Pending',
      assignedRole: 'guard',
      createdBy: req.user._id,
      createdByRole: normalizeRole(req.user.role || ''),
      lastUpdatedBy: req.user._id,
      statusTimeline: [
        {
          status: 'Submitted',
          changedAt: new Date(),
          changedBy: req.user._id,
          note: 'Service request submitted.',
        },
      ],
    });

    await addResidentActivity({
      residentId: req.user._id,
      societyId: resolvedSocietyId,
      activityType: 'COMPLAINT_SUBMITTED',
      title: 'Service request submitted',
      description: request.title,
      metadata: { serviceRequestId: request._id, category: request.category, priority: request.priority },
    });

    await notifyCreateRequest({ request, actorId: req.user._id });

    return res.status(201).json(normalizeRequestRow(request));
  } catch {
    return res.status(400).json({ message: 'Failed to create complaint.' });
  }
}

async function getMyComplaints(req, res) {
  try {
    if (!req.user?._id) {
      return res.status(401).json({ message: 'Unauthorized.' });
    }
    const filter = { createdBy: req.user._id };
    const mappedStatus = toRequestStatus(req.query?.status || '');
    if (mappedStatus) filter.status = mappedStatus;
    if (req.query.category) filter.category = req.query.category;

    const complaints = await ServiceRequest.find(filter)
      .populate('assignedTo', 'name email role')
      .sort({ createdAt: -1 });

    return res.status(200).json(complaints.map(normalizeRequestRow));
  } catch {
    return res.status(500).json({ message: 'Failed to fetch complaints.' });
  }
}

async function getAllComplaints(req, res) {
  try {
    const actorRole = normalizeRole(req.user?.role);
    const allowedRoles = [ROLES.ADMIN, ROLES.SUPER_ADMIN, ROLES.COMMITTEE, ROLES.GUARD, ROLES.TENANT, ROLES.OWNER, ROLES.RESIDENT];
    if (!allowedRoles.includes(actorRole)) {
      return res.status(403).json({ message: 'Forbidden: insufficient role permissions.' });
    }

    const resolvedSocietyId = await resolveRequestSocietyId(req);
    const filter = buildRoleScopedFilter(req, true, resolvedSocietyId);
    const complaints = await ServiceRequest.find(filter)
      .populate('residentId', 'name email')
      .populate('createdBy', 'name email role')
      .populate('assignedTo', 'name email role')
      .sort({ createdAt: -1 });

    return res.status(200).json(complaints.map(normalizeRequestRow));
  } catch {
    return res.status(500).json({ message: 'Failed to fetch service requests.' });
  }
}

async function assignServiceProvider(req, res) {
  try {
    const { id } = req.params;
    const { serviceProviderId } = req.body;

    if (!serviceProviderId) {
      return res.status(400).json({ message: 'serviceProviderId is required.' });
    }

    const provider = await User.findById(serviceProviderId);
    if (!provider || ![ROLES.COMMITTEE, ROLES.GUARD, ROLES.ADMIN, ROLES.SUPER_ADMIN].includes(normalizeRole(provider.role))) {
      return res.status(400).json({ message: 'Invalid assignee. Allowed roles: committee, guard, admin.' });
    }

    const request = await ServiceRequest.findById(id);
    if (!request) {
      return res.status(404).json({ message: 'Complaint not found.' });
    }

    if (req.user.societyId && String(req.user.societyId) !== String(request.societyId)) {
      return res.status(403).json({ message: 'Forbidden: complaint belongs to another society.' });
    }

    request.assignedTo = serviceProviderId;
    request.assignedRole = normalizeRole(provider.role) === ROLES.GUARD ? 'guard' : 'admin';
    request.lastUpdatedBy = req.user._id;
    request.status = request.status === 'Pending' ? 'InProgress' : request.status;
    request.statusTimeline.push({
      status: 'Assigned',
      changedAt: new Date(),
      changedBy: req.user._id,
      note: 'Service provider assigned.',
    });
    await request.save();

    return res.status(200).json(normalizeRequestRow(request));
  } catch {
    return res.status(400).json({ message: 'Failed to assign service provider.' });
  }
}

async function changePriority(req, res) {
  try {
    const { id } = req.params;
    const { priority } = req.body;

    if (!PRIORITY_OPTIONS.includes(priority)) {
      return res.status(400).json({ message: 'priority must be one of Low, Medium, High.' });
    }

    const filter = { _id: id };
    if (req.user.societyId) filter.societyId = req.user.societyId;
    const request = await ServiceRequest.findOne(filter);
    if (!request) {
      return res.status(404).json({ message: 'Complaint not found.' });
    }

    request.priority = priority;
    request.lastUpdatedBy = req.user._id;
    await request.save();

    return res.status(200).json(normalizeRequestRow(request));
  } catch {
    return res.status(400).json({ message: 'Failed to update complaint priority.' });
  }
}

async function getPendingComplaintsCount(req, res) {
  try {
    const actorRole = normalizeRole(req.user?.role);
    const allowedRoles = [ROLES.ADMIN, ROLES.SUPER_ADMIN, ROLES.COMMITTEE, ROLES.GUARD, ROLES.TENANT, ROLES.OWNER, ROLES.RESIDENT];
    if (!allowedRoles.includes(actorRole)) {
      return res.status(403).json({ message: 'Forbidden: insufficient role permissions.' });
    }

    const resolvedSocietyId = await resolveRequestSocietyId(req);
    const filter = buildRoleScopedFilter(req, false, resolvedSocietyId);
    filter.status = 'Pending';
    const count = await ServiceRequest.countDocuments(filter);
    return res.status(200).json({ pendingCount: count });
  } catch {
    return res.status(500).json({ message: 'Failed to count pending complaints.' });
  }
}

async function getAssignableUsers(req, res) {
  try {
    const filter = {
      isDeleted: { $ne: true },
      status: 'Active',
      role: { $in: [ROLES.ADMIN, ROLES.COMMITTEE, ROLES.GUARD] },
    };

    if (req.user.societyId) {
      filter.societyId = req.user.societyId;
    }

    const users = await User.find(filter).select('name email role').sort({ role: 1, name: 1 });
    return res.status(200).json(users);
  } catch {
    return res.status(500).json({ message: 'Failed to fetch assignable users.' });
  }
}

async function getAssignedComplaints(req, res) {
  try {
    const resolvedSocietyId = await resolveRequestSocietyId(req);
    const role = normalizeRole(req.user.role);
    const filter = {
      $or: [
        { assignedRole: { $in: ['guard', 'GUARD', 'Guard'] } },
        { assignedRole: { $exists: false } },
        { assignedRole: null },
        { assignedRole: '' },
      ],
    };
    if (resolvedSocietyId || req.user.societyId) filter.societyId = resolvedSocietyId || req.user.societyId;
    if (role !== ROLES.GUARD && role !== ROLES.ADMIN && role !== ROLES.SUPER_ADMIN) {
      filter.createdBy = req.user._id;
    }
    const mappedStatus = toRequestStatus(req.query?.status || '');
    if (mappedStatus) filter.status = mappedStatus;
    if (req.query.category) filter.category = req.query.category;

    const requests = await ServiceRequest.find(filter)
      .populate('residentId', 'name email')
      .populate('createdBy', 'name email role')
      .sort({ createdAt: -1 });

    return res.status(200).json(requests.map(normalizeRequestRow));
  } catch {
    return res.status(500).json({ message: 'Failed to fetch assigned complaints.' });
  }
}

async function updateAssignedStatus(req, res) {
  try {
    const { id } = req.params;
    const nextStatus = toRequestStatus(req.body?.status || '');

    if (!STATUS_OPTIONS.includes(nextStatus)) {
      return res.status(400).json({ message: 'Invalid status update.' });
    }

    const role = normalizeRole(req.user.role);
    if (![ROLES.ADMIN, ROLES.SUPER_ADMIN, ROLES.GUARD].includes(role)) {
      return res.status(403).json({ message: 'Forbidden: only admin or guard can update status.' });
    }

    const resolvedSocietyId = await resolveRequestSocietyId(req);
    const filter = { _id: id };
    if (resolvedSocietyId || req.user.societyId) {
      filter.societyId = resolvedSocietyId || req.user.societyId;
    }
    if (role === ROLES.GUARD) {
      filter.$or = [
        { assignedRole: { $in: ['guard', 'GUARD', 'Guard'] } },
        { assignedRole: { $exists: false } },
        { assignedRole: null },
        { assignedRole: '' },
      ];
    }

    const request = await ServiceRequest.findOne(filter);
    if (!request) {
      return res.status(404).json({ message: 'Service request not found.' });
    }

    const currentStatus = toStorageStatus(request.status);
    const allowedTransitions = {
      Pending: ['InProgress', 'Resolved'],
      InProgress: ['Resolved'],
      Resolved: [],
    };
    if (nextStatus !== currentStatus) {
      const allowedNext = allowedTransitions[currentStatus] || [];
      if (!allowedNext.includes(nextStatus)) {
        return res.status(400).json({
          message: `Invalid status transition from ${currentStatus} to ${nextStatus}.`,
        });
      }
    }

    request.status = nextStatus;
    request.lastUpdatedBy = req.user._id;
    request.completedAt = nextStatus === 'Resolved' ? new Date() : null;
    request.statusTimeline.push({
      status: toTimelineStatus(nextStatus),
      changedAt: new Date(),
      changedBy: req.user._id,
      note: `Status changed to ${nextStatus}.`,
    });
    await request.save();

    await notifyStatusUpdate({ request, changedBy: req.user._id });

    return res.status(200).json(normalizeRequestRow(request));
  } catch {
    return res.status(400).json({ message: 'Failed to update complaint status.' });
  }
}

async function getResidentServiceHistory(req, res) {
  try {
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(req.query.limit) || 10, 1), 50);
    const skip = (page - 1) * limit;

    const [requests, total] = await Promise.all([
      ServiceRequest.find({ createdBy: req.user._id })
        .select('title category priority status createdAt preferredVisitTime statusTimeline')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      ServiceRequest.countDocuments({ createdBy: req.user._id }),
    ]);

    const data = requests.map((request) => ({
      id: request._id,
      title: request.title,
      category: request.category,
      priority: request.priority,
      status: toStorageStatus(request.status),
      createdAt: request.createdAt,
      preferredVisitTime: request.preferredVisitTime,
      timeline: request.statusTimeline || [],
    }));

    return res.status(200).json({
      success: true,
      message: 'Resident service history fetched successfully.',
      data,
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
    return res.status(500).json({ success: false, message: 'Failed to fetch resident service history.', data: null });
  }
}

module.exports = {
  createComplaint,
  getMyComplaints,
  getAllComplaints,
  getAssignableUsers,
  assignServiceProvider,
  changePriority,
  getPendingComplaintsCount,
  getAssignedComplaints,
  updateAssignedStatus,
  getResidentServiceHistory,
};
