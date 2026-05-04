const { Op } = require('sequelize');
const { TempEmail } = require('../models');

const create = (payload) => TempEmail.create(payload);

const findAll = () =>
  TempEmail.findAll({
    order: [['created_at', 'DESC']],
  });

const findById = (id) => TempEmail.findByPk(id);

const findByAddress = (address) =>
  TempEmail.findOne({
    where: { address },
  });

const findExpired = (date) =>
  TempEmail.findAll({
    where: {
      expires_at: {
        [Op.lte]: date,
      },
    },
  });

const destroy = (mailbox) => mailbox.destroy();

module.exports = {
  create,
  findAll,
  findById,
  findByAddress,
  findExpired,
  destroy,
};
