require('dotenv').config();

const parseOrigins = (value) => {
  if (!value || value === '*') {
    return '*';
  }

  return value
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
};

const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 8001),
  isVercel: process.env.VERCEL === '1',
  trustProxy: 1,
  corsOrigins: parseOrigins(process.env.CORS_ORIGINS || '*'),
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '190705',
    name: process.env.DB_NAME || 'temp_mail',
    ssl: process.env.DB_SSL === 'true',
  },
};

module.exports = env;
