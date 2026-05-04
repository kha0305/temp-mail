const express = require('express');

const router = express.Router();

[
  require('./root/get-api-status.route'),
  require('./root/sync-database.route'),
  require('./domains/get-domains.route'),
  require('./emails/create-email.route'),
  require('./emails/login-email.route'),
  require('./emails/list-emails.route'),
  require('./emails/get-email.route'),
  require('./emails/get-email-messages.route'),
  require('./emails/refresh-email.route'),
  require('./emails/get-email-message-detail.route'),
  require('./emails/extend-email.route'),
  require('./emails/delete-email.route'),
  require('./emails/save-email-message.route'),
  require('./emails/save-email.route'),
  require('./history/list-history.route'),
  require('./history/export-history.route'),
  require('./history/get-history-messages.route'),
  require('./history/get-history-message-detail.route'),
  require('./history/delete-history.route'),
  require('./saved/list-saved-emails.route'),
  require('./saved/get-saved-email-detail.route'),
  require('./saved/delete-saved-emails.route'),
].forEach((route) => {
  router.use(route);
});

module.exports = router;
