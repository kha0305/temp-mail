const express = require('express');
const asyncHandler = require('../../middlewares/async-handler');
const sequelize = require('../../config/database');
const env = require('../../config/env');
const AppError = require('../../utils/app-error');

const router = express.Router();

router.get(
  '/sync-db',
  asyncHandler(async (req, res) => {
    if (env.nodeEnv === 'production' || env.isVercel) {
      throw new AppError('Database sync is disabled in production', 403);
    }

    await sequelize.sync({ alter: true });
    res.json({ status: 'success', message: 'Database synced successfully' });
  }),
);

module.exports = router;
