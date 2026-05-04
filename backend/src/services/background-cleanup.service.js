const { CLEANUP_INTERVAL_MS } = require('../constants/app.constants');
const mailboxService = require('./mailbox.service');

const startCleanupJob = () => {
  return setInterval(async () => {
    try {
      await mailboxService.cleanupExpiredMailboxes();
    } catch (error) {
      console.error(`Background cleanup error: ${error.message}`);
    }
  }, CLEANUP_INTERVAL_MS);
};

module.exports = {
  startCleanupJob,
};
