const AppError = require('../utils/app-error');
const { TEMP_EMAIL_TTL_MINUTES, PERSISTENT_MAILBOX_PROVIDERS } = require('../constants/app.constants');
const tempEmailRepository = require('../repositories/temp-email.repository');
const providerManagerService = require('./provider-manager.service');
const historyService = require('./history.service');
const savedEmailService = require('./saved-email.service');

const isPersistentProvider = (provider) => PERSISTENT_MAILBOX_PROVIDERS.includes(provider);

const serializeMailbox = (mailbox, serviceName = null) => ({
  id: mailbox.id,
  address: mailbox.address,
  password: mailbox.password,
  token: mailbox.token,
  account_id: mailbox.account_id,
  created_at: mailbox.created_at,
  expires_at: mailbox.expires_at,
  provider: mailbox.provider,
  service_name: serviceName,
  username: mailbox.username,
  domain: mailbox.domain,
  message_count: mailbox.message_count,
  persistent: isPersistentProvider(mailbox.provider),
});

const shouldAllowProviderFallback = (value) => {
  if (value === undefined || value === null) {
    return true;
  }

  if (typeof value === 'string') {
    return value.trim().toLowerCase() !== 'false';
  }

  return value !== false;
};

const getMailboxById = async (id) => {
  const mailbox = await tempEmailRepository.findById(id);
  if (!mailbox) {
    throw new AppError('Email not found', 404);
  }

  return mailbox;
};

const persistMailboxAccount = async (mailboxAccount, { refreshCreatedAt = false } = {}) => {
  const now = new Date();
  const expiresAt = isPersistentProvider(mailboxAccount.provider)
    ? null
    : new Date(now.getTime() + TEMP_EMAIL_TTL_MINUTES * 60 * 1000);
  const existingMailbox = await tempEmailRepository.findByAddress(mailboxAccount.address);

  if (existingMailbox) {
    existingMailbox.password = mailboxAccount.password;
    existingMailbox.token = mailboxAccount.token;
    existingMailbox.account_id = mailboxAccount.account_id;
    existingMailbox.expires_at = expiresAt;
    existingMailbox.provider = mailboxAccount.provider;
    existingMailbox.username = mailboxAccount.username;
    existingMailbox.domain = mailboxAccount.domain;

    if (refreshCreatedAt) {
      existingMailbox.created_at = now;
    }

    await existingMailbox.save();
    return serializeMailbox(existingMailbox, mailboxAccount.service_name);
  }

  const mailbox = await tempEmailRepository.create({
    address: mailboxAccount.address,
    password: mailboxAccount.password,
    token: mailboxAccount.token,
    account_id: mailboxAccount.account_id,
    created_at: now,
    expires_at: expiresAt,
    provider: mailboxAccount.provider,
    username: mailboxAccount.username,
    domain: mailboxAccount.domain,
  });

  return serializeMailbox(mailbox, mailboxAccount.service_name);
};

const createMailbox = async ({ username, service, domain, allow_provider_fallback: allowProviderFallback }) => {
  const mailboxAccount = await providerManagerService.createMailboxAccount({
    username,
    service,
    domain,
    allowProviderFallback: shouldAllowProviderFallback(allowProviderFallback),
  });
  return persistMailboxAccount(mailboxAccount);
};

const loginMailbox = async ({ address, password, service }) => {
  const mailboxAccount = await providerManagerService.loginMailboxAccount({ address, password, service });
  return persistMailboxAccount(mailboxAccount, { refreshCreatedAt: true });
};

const listMailboxes = () => tempEmailRepository.findAll();

const extendMailbox = async (id) => {
  const mailbox = await getMailboxById(id);

  if (isPersistentProvider(mailbox.provider)) {
    return {
      status: 'persistent',
      expires_at: null,
    };
  }

  const newExpiresAt = new Date(Date.now() + TEMP_EMAIL_TTL_MINUTES * 60 * 1000);

  mailbox.expires_at = newExpiresAt;
  await mailbox.save();

  return {
    status: 'extended',
    expires_at: newExpiresAt.toISOString(),
  };
};

const deleteMailbox = async (id) => {
  const mailbox = await getMailboxById(id);
  await historyService.archiveMailbox(mailbox, new Date());
  await historyService.trimHistory();
  await tempEmailRepository.destroy(mailbox);

  return { status: 'deleted' };
};

const saveMailbox = async (id) => {
  const mailbox = await getMailboxById(id);
  return savedEmailService.createMailboxSnapshot(mailbox);
};

const cleanupExpiredMailboxes = async () => {
  const expiredMailboxes = await tempEmailRepository.findExpired(new Date());

  for (const mailbox of expiredMailboxes) {
    try {
      await historyService.archiveMailbox(mailbox, mailbox.expires_at);
      await tempEmailRepository.destroy(mailbox);
    } catch (error) {
      console.error(`Cleanup failed for ${mailbox.address}: ${error.message}`);
    }
  }

  await historyService.trimHistory();
};

module.exports = {
  createMailbox,
  loginMailbox,
  listMailboxes,
  getMailboxById,
  extendMailbox,
  deleteMailbox,
  saveMailbox,
  cleanupExpiredMailboxes,
};
