const asyncHandler = require('../utils/asyncHandler');
const {
  createSociety,
  listSocieties,
  getSocietyById,
  updateSociety,
  deleteSociety,
  getSocietySettings,
  updateSocietySettings,
  getSocietyOverview,
} = require('../services/societyService');
const { successResponse, errorResponse } = require('../utils/response');

const createSocietyHandler = asyncHandler(async (req, res) => {
  const created = await createSociety({
    scope: req.scope,
    actorId: req.user._id,
    payload: req.body,
  });
  return successResponse(res, {
    statusCode: 201,
    message: 'Society created successfully.',
    data: created,
  });
});

const listSocietiesHandler = asyncHandler(async (req, res) => {
  const result = await listSocieties({
    scope: req.scope,
    query: req.query,
  });
  return successResponse(res, {
    message: 'Societies fetched successfully.',
    data: result.items,
    meta: { pagination: result.pagination },
  });
});

const getSocietyByIdHandler = asyncHandler(async (req, res) => {
  const society = await getSocietyById({
    scope: req.scope,
    id: req.params.id,
  });
  if (!society) {
    return errorResponse(res, { statusCode: 404, message: 'Society not found.' });
  }
  return successResponse(res, {
    message: 'Society fetched successfully.',
    data: society,
  });
});

const updateSocietyHandler = asyncHandler(async (req, res) => {
  const updated = await updateSociety({
    scope: req.scope,
    actorId: req.user._id,
    id: req.params.id,
    payload: req.body,
  });
  if (!updated) {
    return errorResponse(res, { statusCode: 404, message: 'Society not found.' });
  }
  return successResponse(res, {
    message: 'Society updated successfully.',
    data: updated,
  });
});

const deleteSocietyHandler = asyncHandler(async (req, res) => {
  const deleted = await deleteSociety({
    scope: req.scope,
    actorId: req.user._id,
    id: req.params.id,
  });
  if (!deleted) {
    return errorResponse(res, { statusCode: 404, message: 'Society not found.' });
  }
  return successResponse(res, {
    message: 'Society archived successfully.',
    data: deleted,
  });
});

const getSocietySettingsHandler = asyncHandler(async (req, res) => {
  const settings = await getSocietySettings({
    scope: req.scope,
    societyId: req.params.id,
  });
  if (!settings) {
    return errorResponse(res, { statusCode: 403, message: 'Forbidden.' });
  }
  return successResponse(res, {
    message: 'Society settings fetched successfully.',
    data: settings,
  });
});

const updateSocietySettingsHandler = asyncHandler(async (req, res) => {
  const settings = await updateSocietySettings({
    scope: req.scope,
    actorId: req.user._id,
    societyId: req.params.id,
    payload: req.body,
  });
  if (!settings) {
    return errorResponse(res, { statusCode: 403, message: 'Forbidden.' });
  }
  return successResponse(res, {
    message: 'Society settings updated successfully.',
    data: settings,
  });
});

const getSocietyOverviewHandler = asyncHandler(async (req, res) => {
  const overview = await getSocietyOverview({
    scope: req.scope,
    societyId: req.params.id,
  });
  if (!overview) {
    return errorResponse(res, { statusCode: 403, message: 'Forbidden.' });
  }
  return successResponse(res, {
    message: 'Society overview fetched successfully.',
    data: overview,
  });
});

module.exports = {
  createSociety: createSocietyHandler,
  getSocieties: listSocietiesHandler,
  getSocietyById: getSocietyByIdHandler,
  updateSociety: updateSocietyHandler,
  deleteSociety: deleteSocietyHandler,
  getSocietySettings: getSocietySettingsHandler,
  updateSocietySettings: updateSocietySettingsHandler,
  getSocietyOverview: getSocietyOverviewHandler,
};
