const env = require('./env');

const LOCAL_DEV_ORIGINS = ['http://localhost:3000', 'http://127.0.0.1:3000'];

const getAllowedOrigins = () => {
  if (env.corsOrigins === '*') {
    return LOCAL_DEV_ORIGINS;
  }

  if (Array.isArray(env.corsOrigins)) {
    return env.corsOrigins;
  }

  return [env.corsOrigins];
};

const allowedOrigins = getAllowedOrigins();

const isOriginAllowed = (origin) => {
  if (!origin) {
    return true;
  }

  if (env.corsOrigins === '*') {
    return true;
  }

  return allowedOrigins.includes(origin);
};

const resolveCorsOrigin = (origin, callback) => {
  if (isOriginAllowed(origin)) {
    callback(null, true);
    return;
  }

  callback(new Error(`Origin not allowed by CORS: ${origin}`));
};

const corsConfig = {
  origin: resolveCorsOrigin,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
};

module.exports = corsConfig;
module.exports.allowedOrigins = allowedOrigins;
module.exports.isOriginAllowed = isOriginAllowed;
