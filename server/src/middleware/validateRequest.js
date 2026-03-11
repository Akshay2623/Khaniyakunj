const { validationResult } = require('express-validator');

function validateRequest(req, res, next) {
  const result = validationResult(req);
  if (result.isEmpty()) return next();

  return res.status(422).json({
    success: false,
    message: 'Validation failed.',
    data: {
      errors: result.array().map((item) => ({
        field: item.path,
        message: item.msg,
      })),
    },
  });
}

module.exports = validateRequest;
