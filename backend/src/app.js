const express = require('express');
const cors = require('cors');
const sequelize = require('./config/database');
const env = require('./config/env');
const corsConfig = require('./config/cors');
const apiRateLimiter = require('./middlewares/api-rate-limiter');
const errorHandler = require('./middlewares/error-handler');
const notFoundHandler = require('./middlewares/not-found-handler');
const apiRoutes = require('./routes');

const app = express();

app.set('trust proxy', env.trustProxy);
app.use(express.json());
app.use(cors(corsConfig));

app.get('/', async (req, res) => {
  let dbStatus = 'unknown';

  try {
    await sequelize.authenticate();
    dbStatus = 'connected';
  } catch (error) {
    dbStatus = `error: ${error.message}`;
  }

  res.json({
    status: 'ok',
    message: 'Temp Mail Backend is running',
    environment: env.isVercel ? 'vercel' : 'local',
    db_status: dbStatus,
    timestamp: new Date().toISOString(),
  });
});

app.use('/api', apiRateLimiter, apiRoutes);
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
