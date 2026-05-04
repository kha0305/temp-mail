const AppError = require('../utils/app-error');
const savedEmailRepository = require('../repositories/saved-email.repository');

const normalizeHtml = (value) => {
  if (Array.isArray(value)) {
    return value[0] || '';
  }

  return value || '';
};

const normalizeText = (value) => {
  if (Array.isArray(value)) {
    return value[0] || '';
  }

  return value || '';
};

const buildSavedPayload = ({ emailAddress, messageId, messageDetail, savedAt = new Date() }) => ({
  email_address: emailAddress,
  message_id: messageId,
  subject: messageDetail.subject || '',
  from_address: messageDetail.from?.address || messageDetail.from_address || '',
  from_name: messageDetail.from?.name || messageDetail.from_name || '',
  html: normalizeHtml(messageDetail.html),
  text: normalizeText(messageDetail.text),
  created_at: messageDetail.createdAt || messageDetail.created_at || new Date(),
  saved_at: savedAt,
});

const saveMessageSnapshot = async ({ mailbox, messageId, messageDetail }) => {
  const existing = await savedEmailRepository.findByMessage(mailbox.address, messageId);
  if (existing) {
    return { record: existing, created: false };
  }

  const createdRecord = await savedEmailRepository.create(
    buildSavedPayload({
      emailAddress: mailbox.address,
      messageId,
      messageDetail,
    }),
  );

  return { record: createdRecord, created: true };
};

const autoSaveMessages = async ({ mailbox, messages, fetchMessageDetail }) => {
  for (const message of messages) {
    try {
      const existing = await savedEmailRepository.findByMessage(mailbox.address, message.id);
      if (existing) {
        continue;
      }

      const messageDetail = await fetchMessageDetail(message.id);
      if (!messageDetail) {
        continue;
      }

      await saveMessageSnapshot({
        mailbox,
        messageId: message.id,
        messageDetail,
      });
    } catch (error) {
      console.error(`Auto-save message failed for ${message.id}: ${error.message}`);
    }
  }
};

const createMailboxSnapshot = async (mailbox) => {
  const snapshotMessageId = `mailbox:${mailbox.id}`;
  const existing = await savedEmailRepository.findByMessage(mailbox.address, snapshotMessageId);
  if (existing) {
    return { record: existing, created: false };
  }

  const messageDetail = {
    subject: `Saved mailbox: ${mailbox.address}`,
    from_address: mailbox.provider,
    from_name: 'Temp Mail',
    html: `<div><h2>Saved mailbox</h2><p><b>Address:</b> ${mailbox.address}</p><p><b>Provider:</b> ${mailbox.provider}</p><p><b>Created:</b> ${mailbox.created_at}</p><p><b>Expires:</b> ${mailbox.expires_at}</p></div>`,
    text: `Saved mailbox\nAddress: ${mailbox.address}\nProvider: ${mailbox.provider}`,
    created_at: mailbox.created_at,
  };

  const createdRecord = await savedEmailRepository.create(
    buildSavedPayload({
      emailAddress: mailbox.address,
      messageId: snapshotMessageId,
      messageDetail,
    }),
  );

  return { record: createdRecord, created: true };
};

const listSavedEmails = () => savedEmailRepository.findAll();

const getSavedEmailDetail = async (id) => {
  const savedEmail = await savedEmailRepository.findById(id);
  if (!savedEmail) {
    throw new AppError('Saved email not found', 404);
  }

  return savedEmail;
};

const deleteSavedEmails = async (ids = []) => {
  const count = ids.length > 0
    ? await savedEmailRepository.deleteByIds(ids)
    : await savedEmailRepository.deleteAll();

  return { status: 'deleted', count };
};

const listSavedEmailsByAddress = (emailAddress) => savedEmailRepository.findAllByEmailAddress(emailAddress);

const trimSavedEmailRetention = (cutoffDate) => savedEmailRepository.deleteOlderThan(cutoffDate);

module.exports = {
  saveMessageSnapshot,
  autoSaveMessages,
  createMailboxSnapshot,
  listSavedEmails,
  getSavedEmailDetail,
  deleteSavedEmails,
  listSavedEmailsByAddress,
  trimSavedEmailRetention,
};
