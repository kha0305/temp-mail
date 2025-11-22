const { TempEmail, EmailHistory, SavedEmail } = require('../models');
const emailService = require('../services/emailService');
const { Op } = require('sequelize');

const createEmail = async (req, res) => {
  try {
    const { username, service, domain } = req.body;
    const emailData = await emailService.createEmailWithFailover(username, service, domain);

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 10 * 60 * 1000); // 10 minutes

    const newEmail = await TempEmail.create({
      address: emailData.address,
      password: emailData.password,
      token: emailData.token,
      account_id: emailData.account_id,
      created_at: now,
      expires_at: expiresAt,
      provider: emailData.provider,
      username: emailData.username,
      domain: emailData.domain
    });

    res.json({
      id: newEmail.id,
      address: newEmail.address,
      created_at: newEmail.created_at,
      expires_at: newEmail.expires_at,
      provider: newEmail.provider,
      service_name: emailData.service_name
    });
  } catch (error) {
    res.status(503).json({ detail: error.message });
  }
};

const getEmails = async (req, res) => {
  try {
    const emails = await TempEmail.findAll({
      order: [['created_at', 'DESC']]
    });
    res.json(emails);
  } catch (error) {
    res.status(500).json({ detail: error.message });
  }
};

const getEmail = async (req, res) => {
  try {
    const { id } = req.params;
    const email = await TempEmail.findByPk(id);
    if (!email) {
      return res.status(404).json({ detail: 'Email not found' });
    }
    res.json(email);
  } catch (error) {
    res.status(500).json({ detail: error.message });
  }
};

const getMessages = async (req, res) => {
  try {
    const { id } = req.params;
    const email = await TempEmail.findByPk(id);

    if (!email) {
      return res.status(404).json({ detail: 'Email not found' });
    }

    let messages = [];
    if (email.provider === 'mailtm') {
      messages = await emailService.mailtm.getMessages(email.token);
    } else if (email.provider === '1secmail') {
      messages = await emailService.onesecmail.getMessages(email.username, email.domain);
    } else if (email.provider === 'mailgw') {
      messages = await emailService.mailgw.getMessages(email.token);
    } else if (email.provider === 'guerrilla') {
      messages = await emailService.guerrilla.getMessages(email.token);
    }

    // Update message count
    if (messages.length !== email.message_count) {
      email.message_count = messages.length;
      await email.save();
    }

    res.json({
      messages: messages,
      count: messages.length
    });
  } catch (error) {
    res.status(500).json({ detail: error.message });
  }
};

const getMessageDetail = async (req, res) => {
  try {
    const { id, messageId } = req.params;
    const email = await TempEmail.findByPk(id);

    if (!email) {
      return res.status(404).json({ detail: 'Email not found' });
    }

    let message = null;
    if (email.provider === 'mailtm') {
      message = await emailService.mailtm.getMessageDetail(email.token, messageId);
    } else if (email.provider === '1secmail') {
      message = await emailService.onesecmail.getMessageDetail(email.username, email.domain, messageId);
    } else if (email.provider === 'mailgw') {
      message = await emailService.mailgw.getMessageDetail(email.token, messageId);
    } else if (email.provider === 'guerrilla') {
      message = await emailService.guerrilla.getMessageDetail(email.token, messageId);
    }

    if (!message) {
      return res.status(404).json({ detail: 'Message not found' });
    }

    res.json(message);
  } catch (error) {
    res.status(500).json({ detail: error.message });
  }
};

const extendTime = async (req, res) => {
  try {
    const { id } = req.params;
    const email = await TempEmail.findByPk(id);

    if (!email) {
      return res.status(404).json({ detail: 'Email not found' });
    }

    const now = new Date();
    const newExpiresAt = new Date(now.getTime() + 10 * 60 * 1000); // Reset to 10 mins from now
    
    email.expires_at = newExpiresAt;
    await email.save();

    res.json({
      status: 'extended',
      expires_at: newExpiresAt.toISOString()
    });
  } catch (error) {
    res.status(500).json({ detail: error.message });
  }
};

const deleteEmail = async (req, res) => {
  try {
    const { id } = req.params;
    const email = await TempEmail.findByPk(id);

    if (!email) {
      return res.status(404).json({ detail: 'Email not found' });
    }

    // Move to history
    await EmailHistory.create({
      address: email.address,
      password: email.password,
      token: email.token,
      account_id: email.account_id,
      created_at: email.created_at,
      expired_at: new Date(),
      message_count: email.message_count
    });

    await email.destroy();
    res.json({ status: 'deleted' });
  } catch (error) {
    res.status(500).json({ detail: error.message });
  }
};

const getHistory = async (req, res) => {
  try {
    const history = await EmailHistory.findAll({
      order: [['expired_at', 'DESC']],
      limit: 50
    });
    res.json(history);
  } catch (error) {
    res.status(500).json({ detail: error.message });
  }
};

const deleteHistory = async (req, res) => {
  try {
    const { ids } = req.body;
    if (ids && ids.length > 0) {
      await EmailHistory.destroy({
        where: {
          id: {
            [Op.in]: ids
          }
        }
      });
    } else {
      await EmailHistory.destroy({
        where: {},
        truncate: true
      });
    }
    res.json({ status: 'deleted', count: 0 }); // Count not easily available in destroy with where
  } catch (error) {
    res.status(500).json({ detail: error.message });
  }
};

const getSavedEmails = async (req, res) => {
  try {
    const saved = await SavedEmail.findAll({
      order: [['saved_at', 'DESC']]
    });
    res.json(saved);
  } catch (error) {
    res.status(500).json({ detail: error.message });
  }
};

const getSavedEmailDetail = async (req, res) => {
  try {
    const { id } = req.params;
    const saved = await SavedEmail.findByPk(id);
    if (!saved) {
      return res.status(404).json({ detail: 'Saved email not found' });
    }
    res.json(saved);
  } catch (error) {
    res.status(500).json({ detail: error.message });
  }
};

const saveMessage = async (req, res) => {
  try {
    const { id, messageId } = req.params;
    const email = await TempEmail.findByPk(id);
    if (!email) {
      return res.status(404).json({ detail: 'Email not found' });
    }

    let message = null;
    if (email.provider === 'mailtm') {
      message = await emailService.mailtm.getMessageDetail(email.token, messageId);
    } else if (email.provider === '1secmail') {
      message = await emailService.onesecmail.getMessageDetail(email.username, email.domain, messageId);
    } else if (email.provider === 'mailgw') {
      message = await emailService.mailgw.getMessageDetail(email.token, messageId);
    } else if (email.provider === 'guerrilla') {
      message = await emailService.guerrilla.getMessageDetail(email.token, messageId);
    }

    if (!message) {
      return res.status(404).json({ detail: 'Message not found' });
    }

    const existing = await SavedEmail.findOne({
      where: {
        email_address: email.address,
        message_id: messageId
      }
    });

    if (existing) {
      return res.json({
        status: 'already_saved',
        message: 'Email đã được lưu trước đó',
        id: existing.id
      });
    }

    const html = (message.html && message.html.length > 0) ? message.html[0] : '';
    const text = (message.text && message.text.length > 0) ? message.text[0] : '';
    
    const savedEmail = await SavedEmail.create({
      email_address: email.address,
      message_id: messageId,
      subject: message.subject || '',
      from_address: message.from?.address || '',
      from_name: message.from?.name || '',
      html: html,
      text: text,
      created_at: message.createdAt || new Date(),
      saved_at: new Date()
    });

    res.json({
      status: 'saved',
      message: 'Email đã được lưu thành công',
      id: savedEmail.id
    });
  } catch (error) {
    res.status(500).json({ detail: error.message });
  }
};

const saveEmail = async (req, res) => {
  try {
    const { id } = req.params;
    const email = await TempEmail.findByPk(id);
    if (!email) {
      return res.status(404).json({ detail: 'Email not found' });
    }
    
    res.json({
      status: 'success',
      message: 'Email saved successfully',
      id: email.id,
      address: email.address,
      provider: email.provider,
      saved_at: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ detail: error.message });
  }
};

const deleteSavedEmails = async (req, res) => {
  try {
    const { ids } = req.body;
    if (ids && ids.length > 0) {
      await SavedEmail.destroy({
        where: {
          id: {
            [Op.in]: ids
          }
        }
      });
    } else {
      await SavedEmail.destroy({
        where: {},
        truncate: true
      });
    }
    res.json({ status: 'deleted', count: 0 });
  } catch (error) {
    res.status(500).json({ detail: error.message });
  }
};

const getDomains = async (req, res) => {
  try {
    const { service } = req.query;
    let domains = [];
    
    if (service === 'mailtm') {
      domains = await emailService.mailtm.getDomains();
    } else if (service === '1secmail') {
      domains = await emailService.onesecmail.getDomains();
    } else if (service === 'mailgw') {
      domains = await emailService.mailgw.getDomains();
    } else if (service === 'guerrilla') {
      domains = await emailService.guerrilla.getDomains();
    } else {
      // Auto
      domains = await emailService.mailtm.getDomains();
      if (!domains.length) domains = await emailService.onesecmail.getDomains();
      if (!domains.length) domains = await emailService.mailgw.getDomains();
      if (!domains.length) domains = await emailService.guerrilla.getDomains();
    }
    
    res.json({ domains, service });
  } catch (error) {
    res.status(500).json({ detail: error.message });
  }
};

module.exports = {
  createEmail,
  getEmails,
  getEmail,
  getMessages,
  getMessageDetail,
  extendTime,
  deleteEmail,
  getHistory,
  deleteHistory,
  getSavedEmails,
  getSavedEmailDetail,
  saveMessage,
  saveEmail,
  deleteSavedEmails,
  getDomains
};
