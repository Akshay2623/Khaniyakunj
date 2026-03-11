const asyncHandler = require('../utils/asyncHandler');
const { successResponse } = require('../utils/response');
const {
  createLifecycleUser,
  updateLifecycleUser,
  deleteLifecycleUser,
  deactivateUser,
  moveOutUser,
  changeUserRole,
  getUserActivityTimeline,
  listUsers,
  resendUserInvite,
} = require('../services/userOnboardingService');

const createUser = asyncHandler(async (req, res) => {
  const created = await createLifecycleUser({
    actor: req.user,
    payload: req.body,
  });

  return successResponse(res, {
    statusCode: 201,
    message: 'User onboarded successfully.',
    data: created,
  });
});

module.exports = {
  listUsers: asyncHandler(async (req, res) => {
    const result = await listUsers({
      actor: req.user,
      query: req.query,
    });
    return successResponse(res, {
      message: 'Users fetched successfully.',
      data: result.items,
      meta: { pagination: result.pagination },
    });
  }),
  createUser,
  updateUser: asyncHandler(async (req, res) => {
    // Never trigger invite/email during profile updates.
    const { sendInvite, password, ...safePayload } = req.body || {};
    const updated = await updateLifecycleUser({
      actor: req.user,
      userId: req.params.id,
      payload: safePayload,
    });
    return successResponse(res, {
      message: 'User updated successfully.',
      data: updated,
    });
  }),
  deleteUser: asyncHandler(async (req, res) => {
    const deleted = await deleteLifecycleUser({
      actor: req.user,
      userId: req.params.id,
    });
    return successResponse(res, {
      message: 'User deleted successfully.',
      data: deleted,
    });
  }),
  deactivateUser: asyncHandler(async (req, res) => {
    const updated = await deactivateUser({
      actor: req.user,
      userId: req.params.id,
    });
    return successResponse(res, {
      message: 'User deactivated successfully.',
      data: updated,
    });
  }),
  moveOutUser: asyncHandler(async (req, res) => {
    const updated = await moveOutUser({
      actor: req.user,
      userId: req.params.id,
    });
    return successResponse(res, {
      message: 'User moved out successfully.',
      data: updated,
    });
  }),
  changeUserRole: asyncHandler(async (req, res) => {
    const updated = await changeUserRole({
      actor: req.user,
      userId: req.params.id,
      role: req.body.role,
    });
    return successResponse(res, {
      message: 'User role updated successfully.',
      data: updated,
    });
  }),
  getUserActivities: asyncHandler(async (req, res) => {
    const timeline = await getUserActivityTimeline({
      actor: req.user,
      userId: req.params.id,
      page: req.query.page,
      limit: req.query.limit,
    });
    return successResponse(res, {
      message: 'User activity timeline fetched successfully.',
      data: timeline.items,
      meta: { pagination: timeline.pagination },
    });
  }),
  resendInvite: asyncHandler(async (req, res) => {
    const result = await resendUserInvite({
      actor: req.user,
      userId: req.params.id,
    });
    return successResponse(res, {
      message: 'Invite resent successfully.',
      data: result,
    });
  }),
};
