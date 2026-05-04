const { Op } = require('sequelize');
const { EmailHistory } = require('../models');

const create = (payload) => EmailHistory.create(payload);

const findRecent = () =>
  EmailHistory.findAll({
    order: [['expired_at', 'DESC']],
  });

const findAllIds = () =>
  EmailHistory.findAll({
    order: [['expired_at', 'DESC']],
    attributes: ['id'],
  });

const findSince = (date) =>
  EmailHistory.findAll({
    where: {
      expired_at: {
        [Op.gte]: date,
      },
    },
    order: [['provider', 'ASC'], ['expired_at', 'DESC']],
  });

const findById = (id) => EmailHistory.findByPk(id);

const deleteByIds = (ids) =>
  EmailHistory.destroy({
    where: {
      id: {
        [Op.in]: ids,
      },
    },
  });

const deleteAll = () =>
  EmailHistory.destroy({
    where: {},
    truncate: true,
  });

const deleteOlderThan = (date) =>
  EmailHistory.destroy({
    where: {
      expired_at: {
        [Op.lt]: date,
      },
    },
  });

module.exports = {
  create,
  findRecent,
  findSince,
  findAllIds,
  findById,
  deleteByIds,
  deleteAll,
  deleteOlderThan,
};
