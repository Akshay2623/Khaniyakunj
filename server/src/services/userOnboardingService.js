const mongoose = require('mongoose');
const User = require('../models/User');
const Society = require('../models/Society');
const Building = require('../models/Building');
const Unit = require('../models/Unit');
const BoardMember = require('../models/BoardMember');
const Resident = require('../models/Resident');
const MaintenanceProfile = require('../models/MaintenanceProfile');
const UserActivity = require('../models/UserActivity');
const { ROLES, normalizeRole } = require('../constants/roles');
const AuditLog = require('../models/AuditLog');
const {
  generateTemporaryPassword,
  createUserInviteRecord,
  dispatchUserInvite,
} = require('./inviteService');
const { resolveSingleSocietyId } = require('./singleSocietyService');

function canManageSociety({ actor, targetSocietyId }) {
  const role = normalizeRole(actor.role);
  if (role === ROLES.SUPER_ADMIN) return true;
  if (role !== ROLES.ADMIN) return false;
  if (!actor.societyId) return true;
  return String(actor.societyId) === String(targetSocietyId);
}

function toDto(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: normalizeRole(user.role),
    societyId: user.societyId,
    buildingId: user.buildingId,
    unitId: user.unitId,
    status: user.status,
    onboardingStatus: user.onboardingStatus,
    onboardingWorkflow: user.onboardingWorkflow,
    joinedAt: user.joinedAt,
    movedOutAt: user.movedOutAt,
    createdBy: user.createdBy,
  };
}

function nextMonthKey() {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function validatePhoneValue(phone) {
  const raw = String(phone || '').trim();
  if (!raw) return '';
  if (/[A-Za-z]/.test(raw)) return 'Phone number cannot contain alphabets.';
  const digits = raw.replace(/\D+/g, '');
  if (digits.length !== 10) return 'Phone number must be exactly 10 digits.';
  return '';
}

function isResidentialRole(role) {
  return [ROLES.RESIDENT, ROLES.TENANT, ROLES.OWNER].includes(normalizeRole(role));
}

async function logUserActivity({ session, userId, societyId, actorId, activityType, description, metadata = {} }) {
  await UserActivity.create(
    [
      {
        userId,
        societyId,
        actorId,
        activityType,
        description,
        metadata,
      },
    ],
    { session }
  );
}

async function createLifecycleUser({ actor, payload }) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const fallbackSocietyId = await resolveSingleSocietyId({ user: actor, requestedSocietyId: payload?.societyId || null });
    const targetSocietyId = payload?.societyId || fallbackSocietyId;
    if (!targetSocietyId) {
      const err = new Error('No active society found for user onboarding.');
      err.statusCode = 400;
      throw err;
    }

    const role = normalizeRole(payload.role);
    const normalizedEmail = payload.email.toLowerCase().trim();
    const phoneError = validatePhoneValue(payload.phone);
    if (phoneError) {
      const err = new Error(phoneError);
      err.statusCode = 400;
      throw err;
    }

    const society = await Society.findOne({
      _id: targetSocietyId,
      isDeleted: { $ne: true },
    }).session(session);
    if (!society) {
      const err = new Error('Society not found.');
      err.statusCode = 404;
      throw err;
    }

    if (!canManageSociety({ actor, targetSocietyId })) {
      const err = new Error('Forbidden: cannot manage users for this society.');
      err.statusCode = 403;
      throw err;
    }

    const existingEmail = await User.findOne({ email: normalizedEmail, isDeleted: { $ne: true } }).session(session);
    if (existingEmail) {
      const err = new Error('Email already exists.');
      err.statusCode = 409;
      throw err;
    }

    let building = null;
    let unit = null;

    if (payload.buildingId) {
      building = await Building.findOne({
        _id: payload.buildingId,
        societyId: targetSocietyId,
        isDeleted: { $ne: true },
      }).session(session);
      if (!building) {
        const err = new Error('Building not found in selected society.');
        err.statusCode = 400;
        throw err;
      }
    }

    if (payload.unitId) {
      unit = await Unit.findOne({
        _id: payload.unitId,
        societyId: targetSocietyId,
        isDeleted: { $ne: true },
      }).session(session);
      if (!unit) {
        const err = new Error('Unit not found in selected society.');
        err.statusCode = 400;
        throw err;
      }
      if (building && String(unit.buildingId) !== String(building._id)) {
        const err = new Error('Selected unit does not belong to selected building.');
        err.statusCode = 400;
        throw err;
      }

      // Prevent accidental overwrite of existing occupancy assignments.
      if (isResidentialRole(role) && (unit.assignedResidentId || unit.tenantId || unit.ownerId || unit.status === 'OCCUPIED')) {
        const err = new Error('This unit is already assigned to another resident.');
        err.statusCode = 409;
        throw err;
      }
    }

    if (isResidentialRole(role) && !unit) {
      const err = new Error('Unit assignment is required for resident onboarding.');
      err.statusCode = 400;
      throw err;
    }

    const status = payload.status || 'Active';
    const temporaryPassword = payload.password || generateTemporaryPassword();
    const sendInvite = payload.sendInvite !== false;
    const onboardingWorkflow = {
      profileCreated: true,
      unitAssigned: Boolean(payload.unitId),
      activated: status === 'Active',
    };

    const user = await User.create(
      [
        {
          name: payload.name.trim(),
          email: normalizedEmail,
          phone: payload.phone || '',
          languagePreference: payload.languagePreference || 'en-US',
          timezone: payload.timezone || society.timezone || 'UTC',
          password: temporaryPassword,
          role,
          societyId: targetSocietyId,
          buildingId: payload.buildingId || unit?.buildingId || null,
          unitId: payload.unitId || null,
          status,
          onboardingStatus: payload.onboardingStatus || 'Completed',
          onboardingWorkflow,
          joinedAt: payload.joinedAt || new Date(),
          movedOutAt: payload.movedOutAt || null,
          emergencyContact: payload.emergencyContact || '',
          profileImageUrl: payload.profileImageUrl || '',
          createdBy: actor._id,
          isActive: status === 'Active',
          mustChangePassword: true,
          temporaryPasswordIssuedAt: new Date(),
        },
      ],
      { session }
    ).then((docs) => docs[0]);

    await logUserActivity({
      session,
      userId: user._id,
      societyId: user.societyId,
      actorId: actor._id,
      activityType: 'USER_CREATED',
      description: 'User profile created.',
      metadata: { role: user.role },
    });

    // Automatic module impact: resident onboarding for resident/tenant/owner.
    if (isResidentialRole(role) && unit) {
      const blockName = building?.name || 'Block';
      const occupancyType = role === ROLES.OWNER ? 'owner' : 'tenant';
      let resident = await Resident.findOne({
        societyId: user.societyId,
        flatNumber: unit.unitNumber,
      }).session(session);

      if (resident && resident.userId && String(resident.userId) !== String(user._id)) {
        const err = new Error('Selected unit already mapped to another resident record. Move out existing resident first.');
        err.statusCode = 409;
        throw err;
      }

      if (!resident) {
        resident = await Resident.create(
          [
            {
              userId: user._id,
              societyId: user.societyId,
              name: user.name,
              email: user.email,
              flatNumber: unit.unitNumber,
              block: blockName,
              phone: user.phone || '0000000000',
              occupancyType,
              createdBy: actor._id,
            },
          ],
          { session }
        ).then((docs) => docs[0]);
      } else {
        resident.userId = user._id;
        resident.name = user.name;
        resident.email = user.email;
        resident.block = blockName;
        resident.phone = user.phone || resident.phone || '0000000000';
        resident.occupancyType = occupancyType;
        await resident.save({ session });
      }

      user.residentId = resident._id;
      await user.save({ session });

      await logUserActivity({
        session,
        userId: user._id,
        societyId: user.societyId,
        actorId: actor._id,
        activityType: 'UNIT_ASSIGNED',
        description: `Unit ${unit.unitNumber} assigned.`,
        metadata: { unitId: unit._id, buildingId: unit.buildingId },
      });
    }

    // Maintenance module impact.
    await MaintenanceProfile.updateOne(
      { userId: user._id },
      {
        $set: {
          societyId: user.societyId,
          billingEnabled: isResidentialRole(role),
          includedInNextCycle: isResidentialRole(role),
          profileStatus: status === 'Active' ? 'Active' : 'Inactive',
          nextBillingCycleMonth: nextMonthKey(),
        },
      },
      { upsert: true, session }
    );

    if (isResidentialRole(role) && unit) {
      const unitUpdate = {
        assignedResidentId: user._id,
        status: 'OCCUPIED',
        occupancyStatus: 'Occupied',
      };
      if (role === ROLES.TENANT) unitUpdate.tenantId = user._id;
      if (role === ROLES.OWNER) unitUpdate.ownerId = user._id;
      await Unit.updateOne(
        { _id: unit._id },
        {
          $set: unitUpdate,
        },
        { session }
      );
    }

    if (role === ROLES.COMMITTEE) {
      await BoardMember.create(
        [
          {
            name: user.name,
            designation: 'Board Member',
            email: user.email,
            phone: user.phone,
            societyId: user.societyId,
            termStartDate: new Date(),
            isActive: true,
          },
        ],
        { session }
      );
    }

    await AuditLog.create(
      [
        {
          actorId: actor._id,
          societyId: user.societyId,
          entity: 'User',
          entityId: user._id,
          action: 'USER_ONBOARDED',
          metadata: {
            role: user.role,
            buildingId: user.buildingId,
            unitId: user.unitId,
            onboardingStatus: user.onboardingStatus,
            moduleImpact: {
              maintenanceEnabled: isResidentialRole(role),
              canRaiseComplaints: isResidentialRole(role),
              canApproveVisitors: isResidentialRole(role),
              canMarkVisitorEntry: role === ROLES.GUARD,
            },
          },
        },
      ],
      { session }
    );

    let invite = null;
    if (sendInvite) {
      invite = await createUserInviteRecord({
        session,
        user,
        temporaryPassword,
        locale: user.languagePreference,
        timezone: user.timezone,
      });
    }

    await session.commitTransaction();
    session.endSession();

    if (invite) {
      try {
        invite = await dispatchUserInvite({ user, invite });
      } catch (error) {
        // Keep onboarding successful even if mail delivery fails.
      }
    }

    return {
      ...toDto(user),
      temporaryPassword,
      invite: invite
        ? {
            id: invite._id,
            status: invite.status,
            expiresAt: invite.expiresAt,
          }
        : null,
    };
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
}

async function deactivateUser({ actor, userId }) {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const user = await User.findOne({ _id: userId, isDeleted: { $ne: true } }).session(session);
    if (!user) {
      const err = new Error('User not found.');
      err.statusCode = 404;
      throw err;
    }

    if (!canManageSociety({ actor, targetSocietyId: user.societyId })) {
      const err = new Error('Forbidden.');
      err.statusCode = 403;
      throw err;
    }

    user.status = 'Inactive';
    user.isActive = false;
    user.onboardingWorkflow.activated = false;
    await user.save({ session });

    await MaintenanceProfile.updateOne(
      { userId: user._id },
      { $set: { profileStatus: 'Inactive' } },
      { session }
    );

    await logUserActivity({
      session,
      userId: user._id,
      societyId: user.societyId,
      actorId: actor._id,
      activityType: 'DEACTIVATED',
      description: 'User account deactivated.',
    });

    await AuditLog.create(
      [
        {
          actorId: actor._id,
          societyId: user.societyId,
          entity: 'User',
          entityId: user._id,
          action: 'USER_DEACTIVATED',
        },
      ],
      { session }
    );

    await session.commitTransaction();
    session.endSession();
    return toDto(user);
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
}

async function moveOutUser({ actor, userId }) {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const user = await User.findOne({ _id: userId, isDeleted: { $ne: true } }).session(session);
    if (!user) {
      const err = new Error('User not found.');
      err.statusCode = 404;
      throw err;
    }

    if (!canManageSociety({ actor, targetSocietyId: user.societyId })) {
      const err = new Error('Forbidden.');
      err.statusCode = 403;
      throw err;
    }

    user.movedOutAt = new Date();
    user.status = 'Inactive';
    user.isActive = false;
    user.onboardingWorkflow.activated = false;
    await user.save({ session });

    if (user.unitId) {
      const normalizedUserRole = normalizeRole(user.role);
      const update = { $set: { occupancyStatus: 'Vacant', status: 'VACANT', tenantId: null, ownerId: null, assignedResidentId: null } };
      if (normalizedUserRole === ROLES.TENANT) {
        update.$set.ownerId = null;
      }
      if (normalizedUserRole === ROLES.OWNER) {
        update.$set.tenantId = null;
      }
      await Unit.updateOne({ _id: user.unitId }, update, { session });
    }

    await MaintenanceProfile.updateOne(
      { userId: user._id },
      {
        $set: {
          billingEnabled: false,
          includedInNextCycle: false,
          profileStatus: 'Inactive',
        },
      },
      { session }
    );

    await logUserActivity({
      session,
      userId: user._id,
      societyId: user.societyId,
      actorId: actor._id,
      activityType: 'MOVED_OUT',
      description: 'User moved out; billing disabled and unit vacated.',
    });

    await AuditLog.create(
      [
        {
          actorId: actor._id,
          societyId: user.societyId,
          entity: 'User',
          entityId: user._id,
          action: 'USER_MOVED_OUT',
        },
      ],
      { session }
    );

    await session.commitTransaction();
    session.endSession();
    return toDto(user);
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
}

async function changeUserRole({ actor, userId, role }) {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const user = await User.findOne({ _id: userId, isDeleted: { $ne: true } }).session(session);
    if (!user) {
      const err = new Error('User not found.');
      err.statusCode = 404;
      throw err;
    }

    if (!canManageSociety({ actor, targetSocietyId: user.societyId })) {
      const err = new Error('Forbidden.');
      err.statusCode = 403;
      throw err;
    }

    const nextRole = normalizeRole(role);
    const prevRole = normalizeRole(user.role);

    if (prevRole === ROLES.TENANT && nextRole === ROLES.OWNER) {
      if (!user.unitId) {
        const err = new Error('Cannot upgrade to owner without unit assignment.');
        err.statusCode = 400;
        throw err;
      }

      await Unit.updateOne(
        { _id: user.unitId },
        { $set: { ownerId: user._id, tenantId: null, assignedResidentId: user._id, status: 'OCCUPIED', occupancyStatus: 'Occupied' } },
        { session }
      );

      user.role = nextRole;
      await user.save({ session });

      await Resident.updateOne(
        { userId: user._id },
        { $set: { occupancyType: 'owner' } },
        { session }
      );

      await logUserActivity({
        session,
        userId: user._id,
        societyId: user.societyId,
        actorId: actor._id,
        activityType: 'ROLE_CHANGED',
        description: 'Role upgraded from tenant to owner.',
        metadata: { from: prevRole, to: nextRole },
      });

      await AuditLog.create(
        [
          {
            actorId: actor._id,
            societyId: user.societyId,
            entity: 'User',
            entityId: user._id,
            action: 'USER_ROLE_CHANGED',
            metadata: { from: prevRole, to: nextRole },
          },
        ],
        { session }
      );

      await session.commitTransaction();
      session.endSession();
      return toDto(user);
    }

    const err = new Error('Only Tenant -> Owner upgrade is supported.');
    err.statusCode = 400;
    throw err;
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
}

async function getUserActivityTimeline({ actor, userId, page = 1, limit = 20 }) {
  const user = await User.findOne({ _id: userId, isDeleted: { $ne: true } }).select('societyId');
  if (!user) {
    const err = new Error('User not found.');
    err.statusCode = 404;
    throw err;
  }

  if (!canManageSociety({ actor, targetSocietyId: user.societyId })) {
    const err = new Error('Forbidden.');
    err.statusCode = 403;
    throw err;
  }

  const safePage = Math.max(Number(page) || 1, 1);
  const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);
  const skip = (safePage - 1) * safeLimit;

  const [items, total] = await Promise.all([
    UserActivity.find({ userId }).sort({ createdAt: -1 }).skip(skip).limit(safeLimit),
    UserActivity.countDocuments({ userId }),
  ]);

  return {
    items,
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      totalPages: Math.ceil(total / safeLimit),
    },
  };
}

async function listUsers({ actor, query = {} }) {
  const safePage = Math.max(Number(query.page) || 1, 1);
  const safeLimit = Math.min(Math.max(Number(query.limit) || 20, 1), 100);
  const skip = (safePage - 1) * safeLimit;

  const filter = { isDeleted: { $ne: true } };

  if (normalizeRole(actor.role) !== ROLES.SUPER_ADMIN) {
    if (actor.societyId) {
      filter.societyId = actor.societyId;
    }
  }

  if (query.societyId) {
    if (!canManageSociety({ actor, targetSocietyId: query.societyId })) {
      const err = new Error('Forbidden.');
      err.statusCode = 403;
      throw err;
    }
    filter.societyId = query.societyId;
  }

  if (query.role) filter.role = normalizeRole(query.role);
  if (query.status) filter.status = query.status;
  if (query.search) {
    filter.$or = [
      { name: { $regex: query.search, $options: 'i' } },
      { email: { $regex: query.search, $options: 'i' } },
      { phone: { $regex: query.search, $options: 'i' } },
    ];
  }

  const [items, total] = await Promise.all([
    User.find(filter)
      .select('-password')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(safeLimit),
    User.countDocuments(filter),
  ]);

  return {
    items: items.map(toDto),
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      totalPages: Math.ceil(total / safeLimit),
    },
  };
}

async function resendUserInvite({ actor, userId }) {
  const session = await mongoose.startSession();
  session.startTransaction();
  let user = null;
  let invite = null;
  let temporaryPassword = null;
  try {
    user = await User.findOne({ _id: userId, isDeleted: { $ne: true } }).session(session);
    if (!user) {
      const err = new Error('User not found.');
      err.statusCode = 404;
      throw err;
    }

    if (!canManageSociety({ actor, targetSocietyId: user.societyId })) {
      const err = new Error('Forbidden.');
      err.statusCode = 403;
      throw err;
    }

    temporaryPassword = generateTemporaryPassword();
    user.password = temporaryPassword;
    user.mustChangePassword = true;
    user.temporaryPasswordIssuedAt = new Date();
    user.status = 'Active';
    user.isActive = true;
    await user.save({ session });

    invite = await createUserInviteRecord({
      session,
      user,
      temporaryPassword,
      locale: user.languagePreference,
      timezone: user.timezone,
    });

    await AuditLog.create(
      [
        {
          actorId: actor._id,
          societyId: user.societyId,
          entity: 'UserInvite',
          entityId: invite._id,
          action: 'USER_INVITE_RESENT',
          metadata: { userId: user._id, email: user.email },
        },
      ],
      { session }
    );

    await logUserActivity({
      session,
      userId: user._id,
      societyId: user.societyId,
      actorId: actor._id,
      activityType: 'USER_CREATED',
      description: 'Invite resent and temporary password regenerated.',
      metadata: { inviteId: invite._id },
    });

    await session.commitTransaction();
    session.endSession();
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }

  try {
    invite = await dispatchUserInvite({ user, invite });
  } catch {
    // Keep resend API successful; invite status tracks failure.
  }

  return {
    user: toDto(user),
    invite: {
      id: invite._id,
      status: invite.status,
      expiresAt: invite.expiresAt,
    },
    temporaryPassword,
  };
}

async function updateLifecycleUser({ actor, userId, payload }) {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const user = await User.findOne({ _id: userId, isDeleted: { $ne: true } }).session(session);
    if (!user) {
      const err = new Error('User not found.');
      err.statusCode = 404;
      throw err;
    }

    if (!canManageSociety({ actor, targetSocietyId: user.societyId })) {
      const err = new Error('Forbidden.');
      err.statusCode = 403;
      throw err;
    }

    if (payload.name !== undefined) user.name = String(payload.name).trim();
    if (payload.phone !== undefined) {
      const phoneError = validatePhoneValue(payload.phone);
      if (phoneError) {
        const err = new Error(phoneError);
        err.statusCode = 400;
        throw err;
      }
      user.phone = String(payload.phone || '').trim();
    }

    if (payload.email !== undefined) {
      const normalizedEmail = String(payload.email).toLowerCase().trim();
      const existing = await User.findOne({
        _id: { $ne: user._id },
        email: normalizedEmail,
        isDeleted: { $ne: true },
      }).session(session);
      if (existing) {
        const err = new Error('Email already exists.');
        err.statusCode = 409;
        throw err;
      }
      user.email = normalizedEmail;
    }

    const nextSocietyId = payload.societyId || user.societyId;
    if (!canManageSociety({ actor, targetSocietyId: nextSocietyId })) {
      const err = new Error('Forbidden: cannot assign user to this society.');
      err.statusCode = 403;
      throw err;
    }

    if (payload.societyId) {
      const society = await Society.findOne({ _id: payload.societyId, isDeleted: { $ne: true } }).session(session);
      if (!society) {
        const err = new Error('Society not found.');
        err.statusCode = 404;
        throw err;
      }
      user.societyId = payload.societyId;
    }

    if (payload.buildingId !== undefined) {
      if (!payload.buildingId) {
        user.buildingId = null;
      } else {
        const building = await Building.findOne({
          _id: payload.buildingId,
          societyId: user.societyId,
          isDeleted: { $ne: true },
        }).session(session);
        if (!building) {
          const err = new Error('Building not found in selected society.');
          err.statusCode = 400;
          throw err;
        }
        user.buildingId = building._id;
      }
    }

    if (payload.unitId !== undefined) {
      if (!payload.unitId) {
        user.unitId = null;
      } else {
        const unit = await Unit.findOne({
          _id: payload.unitId,
          societyId: user.societyId,
          isDeleted: { $ne: true },
        }).session(session);
        if (!unit) {
          const err = new Error('Unit not found in selected society.');
          err.statusCode = 400;
          throw err;
        }
        if (user.buildingId && String(unit.buildingId) !== String(user.buildingId)) {
          const err = new Error('Selected unit does not belong to selected building.');
          err.statusCode = 400;
          throw err;
        }
        user.unitId = unit._id;
      }
    }

    if (payload.status !== undefined) {
      user.status = payload.status;
      user.isActive = payload.status === 'Active';
      user.onboardingWorkflow = {
        ...(user.onboardingWorkflow || {}),
        activated: payload.status === 'Active',
      };
    }

    await user.save({ session });

    await logUserActivity({
      session,
      userId: user._id,
      societyId: user.societyId,
      actorId: actor._id,
      activityType: 'PROFILE_UPDATED',
      description: 'User profile updated.',
      metadata: { changedFields: Object.keys(payload || {}) },
    });

    await AuditLog.create(
      [
        {
          actorId: actor._id,
          societyId: user.societyId,
          entity: 'User',
          entityId: user._id,
          action: 'USER_UPDATED',
          metadata: { changedFields: Object.keys(payload || {}) },
        },
      ],
      { session }
    );

    await session.commitTransaction();
    session.endSession();
    return toDto(user);
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
}

async function deleteLifecycleUser({ actor, userId }) {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const user = await User.findOne({ _id: userId, isDeleted: { $ne: true } }).session(session);
    if (!user) {
      const err = new Error('User not found.');
      err.statusCode = 404;
      throw err;
    }

    if (!canManageSociety({ actor, targetSocietyId: user.societyId })) {
      const err = new Error('Forbidden.');
      err.statusCode = 403;
      throw err;
    }

    const normalizedRole = normalizeRole(user.role);
    if (user.unitId) {
      const update = { $set: { occupancyStatus: 'Vacant', status: 'VACANT', tenantId: null, ownerId: null, assignedResidentId: null } };
      await Unit.updateOne({ _id: user.unitId }, update, { session });
    }

    await MaintenanceProfile.updateOne(
      { userId: user._id },
      { $set: { billingEnabled: false, includedInNextCycle: false, profileStatus: 'Inactive' } },
      { session }
    );

    user.isDeleted = true;
    user.status = 'Inactive';
    user.isActive = false;
    user.movedOutAt = user.movedOutAt || new Date();
    await user.save({ session });

    await logUserActivity({
      session,
      userId: user._id,
      societyId: user.societyId,
      actorId: actor._id,
      activityType: 'USER_DELETED',
      description: 'User deleted (soft delete).',
    });

    await AuditLog.create(
      [
        {
          actorId: actor._id,
          societyId: user.societyId,
          entity: 'User',
          entityId: user._id,
          action: 'USER_DELETED',
        },
      ],
      { session }
    );

    await session.commitTransaction();
    session.endSession();
    return { id: user._id };
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
}

module.exports = {
  createLifecycleUser,
  updateLifecycleUser,
  deleteLifecycleUser,
  deactivateUser,
  moveOutUser,
  changeUserRole,
  getUserActivityTimeline,
  listUsers,
  resendUserInvite,
};
