const http = require('http');
const app = require('./app');
const env = require('./config/env');
const sequelize = require('./config/database');
const { ensureDatabaseExists } = require('./config/database');
const corsConfig = require('./config/cors');
const setupEmailSocket = require('./sockets/email.socket');
const { startCleanupJob } = require('./services/background-cleanup.service');

const server = http.createServer(app);

if (!env.isVercel) {
  const startLocalServer = async () => {
    try {
      await ensureDatabaseExists();
      await sequelize.authenticate();
      await sequelize.sync({ alter: true });

      startCleanupJob();
      setupEmailSocket(server, corsConfig.allowedOrigins || corsConfig.origin);

      server.listen(env.port, () => {
        console.log(`Server is running on port ${env.port}`);
      });
    } catch (error) {
      console.error('Unable to start server:', error);
    }
  };

  startLocalServer();
}

module.exports = app;
