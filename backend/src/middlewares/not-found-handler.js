const AppError = require('../utils/app-error');

const notFoundHandler = (req, res, next) => {
  next(new AppError('Route not found', 404));
};

module.exports = notFoundHandler;
