const env = require('../config/env');
const rateLimit = require('express-rate-limit');

if (env.nodeEnv !== 'production') {
  module.exports = (req, res, next) => next();
  return;
}

const apiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});

module.exports = apiRateLimiter;
