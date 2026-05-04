const AppError = require('../utils/app-error');
const mailboxService = require('./mailbox.service');
const providerManagerService = require('./provider-manager.service');
const savedEmailService = require('./saved-email.service');

const PROVIDER_WARNING_THROTTLE_MS = 5 * 60 * 1000;
const providerWarningCache = new Map();

const shouldEmitProviderWarning = ({ mailboxId, provider, message }) => {
  const now = Date.now();
  const cacheKey = `${mailboxId}:${provider}:${message}`;
  const lastWarningAt = providerWarningCache.get(cacheKey) || 0;

  if (now - lastWarningAt < PROVIDER_WARNING_THROTTLE_MS) {
    return false;
  }

  providerWarningCache.set(cacheKey, now);
  return true;
};

const getMailboxMessages = async (id) => {
  const mailbox = await mailboxService.getMailboxById(id);
  let messages = [];

  try {
    messages = await providerManagerService.getMessagesForMailbox(mailbox);
  } catch (error) {
    if (error.message.includes('401') || error.message.includes('Unauthorized')) {
      throw new AppError('Session expired', 401);
    }

    const canEmitWarning = shouldEmitProviderWarning({
      mailboxId: mailbox.id,
      provider: mailbox.provider,
      message: error.message,
    });
    const warning = `Provider ${mailbox.provider} is currently unavailable`;

    if (canEmitWarning) {
      console.warn(`${warning}: ${error.message}`);
    }

    return canEmitWarning ? {
      messages: [],
      count: mailbox.message_count,
      warning,
    } : {
      messages: [],
      count: mailbox.message_count,
    };
  }

  if (messages.length !== mailbox.message_count) {
    mailbox.message_count = messages.length;
    await mailbox.save();
  }

  await savedEmailService.autoSaveMessages({
    mailbox,
    messages,
    fetchMessageDetail: (messageId) =>
      providerManagerService.getMessageDetailForMailbox(mailbox, messageId),
  });

  return {
    messages,
    count: messages.length,
  };
};

const getMailboxMessageDetail = async (id, messageId) => {
  const mailbox = await mailboxService.getMailboxById(id);
  const message = await providerManagerService.getMessageDetailForMailbox(mailbox, messageId);

  if (!message) {
    throw new AppError('Message not found', 404);
  }

  return message;
};

const saveMailboxMessage = async (id, messageId) => {
  const mailbox = await mailboxService.getMailboxById(id);
  const message = await providerManagerService.getMessageDetailForMailbox(mailbox, messageId);

  if (!message) {
    throw new AppError('Message not found', 404);
  }

  const { record: savedEmail, created } = await savedEmailService.saveMessageSnapshot({
    mailbox,
    messageId,
    messageDetail: message,
  });

  return {
    status: created ? 'saved' : 'already_saved',
    message: created ? 'Email đã được lưu thành công' : 'Email đã được lưu trước đó',
    id: savedEmail.id,
  };
};

const getSocketMessages = (payload) => providerManagerService.getMessagesForSocket(payload);

module.exports = {
  getMailboxMessages,
  getMailboxMessageDetail,
  saveMailboxMessage,
  getSocketMessages,
};
