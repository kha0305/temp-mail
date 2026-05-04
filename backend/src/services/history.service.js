const AppError = require('../utils/app-error');
const { HISTORY_RETENTION_HOURS } = require('../constants/app.constants');
const emailHistoryRepository = require('../repositories/email-history.repository');
const { resolveProviderIdentity } = require('../providers/provider-registry');
const savedEmailService = require('./saved-email.service');

const getHistoryRetentionCutoff = () => new Date(Date.now() - HISTORY_RETENTION_HOURS * 60 * 60 * 1000);

const archiveMailbox = async (mailbox, expiredAt = new Date()) =>
  emailHistoryRepository.create({
    address: mailbox.address,
    password: mailbox.password,
    token: mailbox.token,
    account_id: mailbox.account_id,
    provider: mailbox.provider,
    created_at: mailbox.created_at,
    expired_at: expiredAt,
    message_count: mailbox.message_count,
  });

const trimHistory = async () => {
  const cutoffDate = getHistoryRetentionCutoff();
  const [historyDeleted, savedDeleted] = await Promise.all([
    emailHistoryRepository.deleteOlderThan(cutoffDate),
    savedEmailService.trimSavedEmailRetention(cutoffDate),
  ]);

  return {
    status: 'trimmed',
    historyDeleted,
    savedDeleted,
  };
};

const enrichHistoryEntry = async (historyEntry) => {
  const serializedEntry = typeof historyEntry.toJSON === 'function' ? historyEntry.toJSON() : historyEntry;
  const resolvedProvider = await resolveProviderIdentity({
    provider: serializedEntry.provider,
    address: serializedEntry.address,
  });

  return {
    ...serializedEntry,
    provider: resolvedProvider.key,
    service_name: resolvedProvider.label || 'Unknown',
  };
};

const listHistory = async () => {
  const historyEntries = await emailHistoryRepository.findSince(getHistoryRetentionCutoff());
  return Promise.all(historyEntries.map(enrichHistoryEntry));
};

const deleteHistory = async (ids = []) => {
  const count = ids.length > 0
    ? await emailHistoryRepository.deleteByIds(ids)
    : await emailHistoryRepository.deleteAll();

  return { status: 'deleted', count };
};

const getHistoryEntry = async (id) => {
  const historyEntry = await emailHistoryRepository.findById(id);
  if (!historyEntry) {
    throw new AppError('History email not found', 404);
  }

  if (new Date(historyEntry.expired_at) < getHistoryRetentionCutoff()) {
    throw new AppError('History email has expired from archive', 404);
  }

  return enrichHistoryEntry(historyEntry);
};

const mapSavedRecordToHistoryMessage = (savedRecord) => ({
  id: savedRecord.id,
  from: savedRecord.from_name || savedRecord.from_address || 'unknown',
  subject: savedRecord.subject || '(No Subject)',
  createdAt: savedRecord.created_at,
  html: savedRecord.html ? [savedRecord.html] : [],
  text: savedRecord.text,
});

const buildHistoryExport = async (historyEntries) => {
  const services = {};

  for (const historyEntry of historyEntries) {
    const serviceKey = historyEntry.provider || 'unknown';
    const messages = await savedEmailService.listSavedEmailsByAddress(historyEntry.address);
    const exportMessages = messages.map((message) => ({
      id: message.id,
      message_id: message.message_id,
      subject: message.subject || '(No Subject)',
      from_address: message.from_address || '',
      from_name: message.from_name || '',
      created_at: message.created_at,
      saved_at: message.saved_at,
      html: message.html || '',
      text: message.text || '',
    }));

    if (!services[serviceKey]) {
      services[serviceKey] = [];
    }

    services[serviceKey].push({
      history_id: historyEntry.id,
      address: historyEntry.address,
      password: historyEntry.password || '',
      provider: historyEntry.provider || null,
      service_name: historyEntry.service_name || 'Unknown',
      created_at: historyEntry.created_at,
      archived_at: historyEntry.expired_at,
      message_count: exportMessages.length,
      messages: exportMessages,
    });
  }

  return {
    exported_at: new Date().toISOString(),
    retention_hours: HISTORY_RETENTION_HOURS,
    service_count: Object.keys(services).length,
    services,
  };
};

const listHistoryMessages = async (historyId) => {
  const historyEntry = await getHistoryEntry(historyId);
  const savedEmails = await savedEmailService.listSavedEmailsByAddress(historyEntry.address);

  return {
    messages: savedEmails.map(mapSavedRecordToHistoryMessage),
    count: savedEmails.length,
  };
};

const getHistoryMessageDetail = async (historyId, messageId) => {
  const historyEntry = await getHistoryEntry(historyId);
  const savedEmails = await savedEmailService.listSavedEmailsByAddress(historyEntry.address);
  const message = savedEmails.find((item) => String(item.id) === String(messageId));

  if (!message) {
    throw new AppError('Message not found', 404);
  }

  return {
    id: message.id,
    from: message.from_name || message.from_address || 'unknown',
    subject: message.subject || '(No Subject)',
    createdAt: message.created_at,
    html: message.html ? [message.html] : [],
    text: message.text,
  };
};

const exportHistoryArchive = async ({ ids = [], provider = null } = {}) => {
  const historyEntries = await listHistory();
  const filteredEntries = historyEntries.filter((entry) => {
    const matchesIds = ids.length === 0 || ids.includes(String(entry.id));
    const matchesProvider = !provider || provider === 'all' || entry.provider === provider;
    return matchesIds && matchesProvider;
  });

  return buildHistoryExport(filteredEntries);
};

module.exports = {
  archiveMailbox,
  trimHistory,
  listHistory,
  deleteHistory,
  listHistoryMessages,
  getHistoryMessageDetail,
  exportHistoryArchive,
};
