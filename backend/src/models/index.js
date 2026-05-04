const sequelize = require('../config/database');
const TempEmail = require('./temp-email.model');
const EmailHistory = require('./email-history.model');
const SavedEmail = require('./saved-email.model');

module.exports = {
  sequelize,
  TempEmail,
  EmailHistory,
  SavedEmail,
};
