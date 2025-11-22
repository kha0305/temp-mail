const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const TempEmail = sequelize.define('TempEmail', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  address: {
    type: DataTypes.STRING(255),
    unique: true,
    allowNull: false
  },
  password: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  token: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  account_id: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  created_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    allowNull: false
  },
  expires_at: {
    type: DataTypes.DATE,
    allowNull: false
  },
  message_count: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    allowNull: false
  },
  provider: {
    type: DataTypes.STRING(50),
    defaultValue: 'mailtm',
    allowNull: false
  },
  mailbox_id: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  username: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  domain: {
    type: DataTypes.STRING(255),
    allowNull: true
  }
}, {
  tableName: 'temp_emails',
  timestamps: false
});

const EmailHistory = sequelize.define('EmailHistory', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  address: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  password: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  token: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  account_id: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  created_at: {
    type: DataTypes.DATE,
    allowNull: false
  },
  expired_at: {
    type: DataTypes.DATE,
    allowNull: false
  },
  message_count: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    allowNull: false
  }
}, {
  tableName: 'email_history',
  timestamps: false
});

const SavedEmail = sequelize.define('SavedEmail', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  email_address: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  message_id: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  subject: {
    type: DataTypes.STRING(500),
    allowNull: true
  },
  from_address: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  from_name: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  html: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  text: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  created_at: {
    type: DataTypes.DATE,
    allowNull: false
  },
  saved_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    allowNull: false
  }
}, {
  tableName: 'saved_emails',
  timestamps: false
});

module.exports = {
  sequelize,
  TempEmail,
  EmailHistory,
  SavedEmail
};
