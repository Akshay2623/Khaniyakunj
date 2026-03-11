function successResponse(res, { message = '', data = null, statusCode = 200, meta = undefined } = {}) {
  const payload = {
    success: true,
    message,
    data,
  };

  if (meta !== undefined) payload.meta = meta;
  return res.status(statusCode).json(payload);
}

function errorResponse(res, { message = 'Request failed.', statusCode = 400, data = null } = {}) {
  return res.status(statusCode).json({
    success: false,
    message,
    data,
  });
}

module.exports = {
  successResponse,
  errorResponse,
};
