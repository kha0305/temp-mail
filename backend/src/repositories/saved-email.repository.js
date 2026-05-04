const { Op } = require('sequelize');
const { SavedEmail } = require('../models');

const create = (payload) => SavedEmail.create(payload);

const findAll = () =>
  SavedEmail.findAll({
    order: [['saved_at', 'DESC']],
  });

const findById = (id) => SavedEmail.findByPk(id);

const findByMessage = (emailAddress, messageId) =>
  SavedEmail.findOne({
    where: {
      email_address: emailAddress,
      message_id: messageId,
    },
  });

const findAllByEmailAddress = (emailAddress) =>
  SavedEmail.findAll({
    where: { email_address: emailAddress },
    order: [['created_at', 'DESC'], ['saved_at', 'DESC']],
  });

const deleteOlderThan = (date) =>
  SavedEmail.destroy({
    where: {
      saved_at: {
        [Op.lt]: date,
      },
    },
  });

const deleteByIds = (ids) =>
  SavedEmail.destroy({
    where: {
      id: {
        [Op.in]: ids,
      },
    },
  });

const deleteAll = () =>
  SavedEmail.destroy({
    where: {},
    truncate: true,
  });

module.exports = {
  create,
  findAll,
  findById,
  findByMessage,
  findAllByEmailAddress,
  deleteByIds,
  deleteAll,
  deleteOlderThan,
};
