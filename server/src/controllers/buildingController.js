const asyncHandler = require('../utils/asyncHandler');
const Building = require('../models/Building');
const { successResponse } = require('../utils/response');

const listBuildings = asyncHandler(async (req, res) => {
  const filter = { isDeleted: { $ne: true } };
  const scopeSocietyId = req.user.societyId || null;
  const requestedSocietyId = req.query.societyId || null;

  if (scopeSocietyId) {
    filter.societyId = scopeSocietyId;
  } else if (requestedSocietyId) {
    filter.societyId = requestedSocietyId;
  }

  const items = await Building.find(filter).sort({ createdAt: -1 });
  return successResponse(res, {
    message: 'Buildings fetched successfully.',
    data: items,
  });
});

module.exports = {
  listBuildings,
};
