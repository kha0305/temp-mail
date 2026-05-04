const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const SavedEmail = sequelize.define(
  'SavedEmail',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    email_address: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    message_id: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    subject: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    from_address: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    from_name: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    html: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    text: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    saved_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      allowNull: false,
    },
  },
  {
    tableName: 'saved_emails',
    timestamps: false,
  },
);

module.exports = SavedEmail;
