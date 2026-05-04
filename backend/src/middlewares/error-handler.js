const AppError = require('../utils/app-error');

const errorHandler = (error, req, res, next) => {
  const normalizedError =
    error instanceof AppError
      ? error
      : new AppError(error.message || 'Internal server error', error.statusCode || 500);

  if (normalizedError.statusCode >= 500) {
    console.error(normalizedError);
  }

  res.status(normalizedError.statusCode).json({
    detail: normalizedError.message,
    ...(normalizedError.code ? { code: normalizedError.code } : {}),
    ...(normalizedError.details ? { details: normalizedError.details } : {}),
  });
};

module.exports = errorHandler;
