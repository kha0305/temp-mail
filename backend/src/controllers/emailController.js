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
    // Use unified service method
    try {
      messages = await emailService.getMessages(email.provider, email.address, email.token);
    } catch (serviceError) {
      console.error(`Service error for ${email.provider}: ${serviceError.message}`);
      
      // If auth error, return 401 to let frontend know session is invalid
      if (serviceError.message.includes('401') || serviceError.message.includes('Unauthorized')) {
        return res.status(401).json({ detail: 'Session expired' });
      }
      
      // For other errors (like 403 Forbidden from 1secmail), return empty list to avoid crashing UI
      // But add a warning in the response
      return res.json({ 
        messages: [], 
        count: email.message_count, 
        warning: `Provider ${email.provider} is currently unavailable` 
      });
    }

    // Update message count
    if (messages.length !== email.message_count) {
      email.message_count = messages.length;
      await email.save();
    }

    // Auto-save messages
    for (const msg of messages) {
      try {
        const exists = await SavedEmail.findOne({
          where: {
            email_address: email.address,
            message_id: msg.id
          }
        });

        if (!exists) {
          let fullMessage = null;
          if (email.provider === 'edu') {
            fullMessage = await emailService.eduService.getMessageDetail(email.token, msg.id);
          } else if (email.provider === 'custom1') {
            fullMessage = await emailService.customService1.getMessageDetail(email.token, msg.id);
          } else if (email.provider === 'custom2') {
            fullMessage = await emailService.customService2.getMessageDetail(email.token, msg.id);
          } else if (email.provider === '1secmail') {
            fullMessage = await emailService.onesecmail.getMessageDetail(email.username, email.domain, msg.id);
          } else if (email.provider === 'guerrilla') {
            fullMessage = await emailService.guerrilla.getMessageDetail(email.token, msg.id);
          } else if (email.provider === 'mailtm') {
            fullMessage = await emailService.mailtm.getMessageDetail(email.token, msg.id);
          } else if (email.provider === 'mailgw') {
            fullMessage = await emailService.mailgw.getMessageDetail(email.token, msg.id);
          }

          if (fullMessage) {
             const html = (fullMessage.html && fullMessage.html.length > 0) ? fullMessage.html[0] : '';
             const text = (fullMessage.text && fullMessage.text.length > 0) ? fullMessage.text[0] : '';

             await SavedEmail.create({
                email_address: email.address,
                message_id: msg.id,
                subject: fullMessage.subject || '',
                from_address: fullMessage.from?.address || '',
                from_name: fullMessage.from?.name || '',
                html: html,
                text: text,
                created_at: fullMessage.createdAt || new Date(),
                saved_at: new Date()
             });
          }
        }
      } catch (saveError) {
        console.error(`Error auto-saving message ${msg.id}:`, saveError);
      }
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
    if (email.provider === 'edu') {
      message = await emailService.eduService.getMessageDetail(email.token, messageId);
    } else if (email.provider === 'custom1') {
      message = await emailService.customService1.getMessageDetail(email.token, messageId);
    } else if (email.provider === 'custom2') {
      message = await emailService.customService2.getMessageDetail(email.token, messageId);
    } else if (email.provider === 'mailtm') {
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

    // Keep only last 5 history items
    const allHistory = await EmailHistory.findAll({
      order: [['expired_at', 'DESC']],
      attributes: ['id']
    });

    if (allHistory.length > 5) {
      const idsToDelete = allHistory.slice(5).map(h => h.id);
      await EmailHistory.destroy({
        where: {
          id: {
            [Op.in]: idsToDelete
          }
        }
      });
    }

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
      limit: 5
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
    if (email.provider === 'edu') {
      message = await emailService.eduService.getMessageDetail(email.token, messageId);
    } else if (email.provider === 'custom1') {
      message = await emailService.customService1.getMessageDetail(email.token, messageId);
    } else if (email.provider === 'custom2') {
      message = await emailService.customService2.getMessageDetail(email.token, messageId);
    } else if (email.provider === '1secmail') {
      message = await emailService.onesecmail.getMessageDetail(email.username, email.domain, messageId);
    } else if (email.provider === 'guerrilla') {
      message = await emailService.guerrilla.getMessageDetail(email.token, messageId);
    } else if (email.provider === 'mailtm') {
      message = await emailService.mailtm.getMessageDetail(email.token, messageId);
    } else if (email.provider === 'mailgw') {
      message = await emailService.mailgw.getMessageDetail(email.token, messageId);
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
    
    if (service === 'edu') {
      domains = await emailService.eduService.getDomains();
    } else if (service === 'custom1') {
      domains = await emailService.customService1.getDomains();
    } else if (service === 'custom2') {
      domains = await emailService.customService2.getDomains();
    } else if (service === '1secmail') {
      domains = await emailService.onesecmail.getDomains();
    } else if (service === 'guerrilla') {
      domains = await emailService.guerrilla.getDomains();
    } else if (service === 'mailtm') {
      domains = await emailService.mailtm.getDomains();
    } else if (service === 'mailgw') {
      domains = await emailService.mailgw.getDomains();
    } else {
      // Auto
      domains = await emailService.customService1.getDomains();
      if (!domains.length) domains = await emailService.customService2.getDomains();
      if (!domains.length) domains = await emailService.eduService.getDomains();
      if (!domains.length) domains = await emailService.mailtm.getDomains();
      if (!domains.length) domains = await emailService.mailgw.getDomains();
      if (!domains.length) domains = await emailService.onesecmail.getDomains();
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
