const AppError = require('../utils/app-error');
const { PROVIDER_COOLDOWN_SECONDS } = require('../constants/app.constants');
const { providerStats } = require('../providers/provider-state.store');
const { getProvider, listProviders, listProviderCatalog } = require('../providers/provider-registry');

const AUTO_PROVIDER_ORDER = ['edu', 'mailtm', 'tempmailc', 'mailgw', '1secmail', 'guerrilla'];

const generateRandomString = (characters, length) => {
  let result = '';

  for (let index = 0; index < length; index += 1) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }

  return result;
};

const generateUsername = () => generateRandomString('abcdefghijklmnopqrstuvwxyz0123456789', 10);

const generatePassword = () =>
  generateRandomString('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', 16);

const isProviderInCooldown = (providerKey) => {
  const now = Date.now() / 1000;
  const stats = providerStats[providerKey] || {};
  return now < (stats.cooldown_until || 0);
};

const setProviderCooldown = (providerKey, durationSeconds) => {
  if (!providerStats[providerKey]) {
    providerStats[providerKey] = { success: 0, failures: 0, cooldown_until: 0 };
  }

  providerStats[providerKey].cooldown_until = Date.now() / 1000 + durationSeconds;
};

const clearProviderCooldown = (providerKey) => {
  if (!providerStats[providerKey]) {
    providerStats[providerKey] = { success: 0, failures: 0, cooldown_until: 0 };
  }

  providerStats[providerKey].cooldown_until = 0;
};

const incrementProviderMetric = (providerKey, metric) => {
  if (!providerStats[providerKey]) {
    providerStats[providerKey] = { success: 0, failures: 0, cooldown_until: 0 };
  }

  providerStats[providerKey][metric] = (providerStats[providerKey][metric] || 0) + 1;
};

const resolveProvidersToTry = (
  preferredService = 'auto',
  { includeFallbackProviders = true } = {},
) => {
  if (preferredService && preferredService !== 'auto') {
    if (!includeFallbackProviders) {
      return [preferredService];
    }

    return Array.from(new Set([preferredService, ...AUTO_PROVIDER_ORDER]));
  }

  return AUTO_PROVIDER_ORDER;
};

const getProviderStatus = () => {
  const now = Date.now() / 1000;
  const stats = {};

  for (const provider of listProviders()) {
    const data = providerStats[provider.key] || { success: 0, failures: 0, cooldown_until: 0 };
    const cooldownUntil = data.cooldown_until || 0;
    const total = (data.success || 0) + (data.failures || 0);

    stats[provider.key] = {
      ...data,
      label: provider.label,
      status: now < cooldownUntil ? `cooldown (${Math.floor(cooldownUntil - now)}s remaining)` : 'active',
      success_rate: total > 0 ? `${((data.success || 0) / total * 100).toFixed(1)}%` : 'N/A',
    };
  }

  return stats;
};

const getAvailableDomains = async (service = 'auto') => {
  const providersToTry = resolveProvidersToTry(service, {
    includeFallbackProviders: !service || service === 'auto',
  });
  let domains = [];

  for (const providerKey of providersToTry) {
    const provider = getProvider(providerKey);
    if (!provider) {
      continue;
    }

    domains = await provider.getDomains();
    if (domains.length > 0) {
      return { service: providerKey, domains };
    }
  }

  return { service, domains: [] };
};

const createMailboxAccount = async ({
  username,
  service = 'auto',
  domain = null,
  allowProviderFallback = true,
}) => {
  const resolvedUsername = username || generateUsername();
  const password = generatePassword();
  const isPreferredProviderRequest = Boolean(service && service !== 'auto');
  const providersToTry = resolveProvidersToTry(service, {
    includeFallbackProviders: !isPreferredProviderRequest || allowProviderFallback,
  });
  const errors = [];
  const skippedProviders = [];

  for (const providerKey of providersToTry) {
    const provider = getProvider(providerKey);
    if (!provider) {
      errors.push(`${providerKey}: provider not configured`);
      continue;
    }

    if (isProviderInCooldown(providerKey)) {
      skippedProviders.push(providerKey);
      continue;
    }

    try {
      const domains = await provider.getDomains();
      if (!domains.length) {
        errors.push(`${providerKey}: no domains available`);
        continue;
      }

      const resolvedDomain = domain && domains.includes(domain) ? domain : domains[0];
      const account = await provider.createAccount({
        username: resolvedUsername,
        domain: resolvedDomain,
        password,
      });

      clearProviderCooldown(providerKey);
      incrementProviderMetric(providerKey, 'success');

      return {
        ...account,
        provider: providerKey,
        service_name: provider.label,
      };
    } catch (error) {
      incrementProviderMetric(providerKey, 'failures');

      if (error.message.includes('rate limited')) {
        setProviderCooldown(providerKey, PROVIDER_COOLDOWN_SECONDS);
        errors.push(`${providerKey}: rate limited`);
        continue;
      }

      errors.push(`${providerKey}: ${error.message}`);
    }
  }

  const details = [];
  if (skippedProviders.length > 0) {
    details.push(`Providers in cooldown: ${skippedProviders.join(', ')}`);
  }
  if (errors.length > 0) {
    details.push(`Errors: ${errors.join(', ')}`);
  }

  const baseMessage = isPreferredProviderRequest && allowProviderFallback
    ? `Provider ưu tiên "${service}" không khả dụng và không thể fallback sang provider khác`
    : isPreferredProviderRequest
      ? `Provider "${service}" không khả dụng`
      : 'Tất cả dịch vụ email đều không khả dụng';

  throw new AppError(`${baseMessage}${details.length > 0 ? `. ${details.join(' | ')}` : ''}`, 503);
};

const loginMailboxAccount = async ({ address, password, service }) => {
  if (!address || !password) {
    throw new AppError('Email address and password are required', 400);
  }

  if (!service || service === 'auto') {
    throw new AppError('Please choose a provider to login', 400);
  }

  const provider = getProvider(service);
  if (!provider) {
    throw new AppError(`Unknown provider: ${service}`, 400);
  }

  if (typeof provider.loginAccount !== 'function') {
    throw new AppError(`Provider ${provider.label} does not support account login`, 400);
  }

  try {
    const account = await provider.loginAccount({ address, password });
    clearProviderCooldown(service);
    incrementProviderMetric(service, 'success');

    return {
      ...account,
      provider: service,
      service_name: provider.label,
    };
  } catch (error) {
    incrementProviderMetric(service, 'failures');

    if (error.message.includes('rate limited')) {
      setProviderCooldown(service, PROVIDER_COOLDOWN_SECONDS);
    }

    throw new AppError(error.message, error.message.includes('invalid credentials') ? 401 : 400);
  }
};

const getProviderByMailbox = (mailbox) => {
  const provider = getProvider(mailbox.provider);

  if (!provider) {
    throw new AppError(`Unknown provider: ${mailbox.provider}`, 500);
  }

  return provider;
};

const getMessagesForMailbox = (mailbox) => getProviderByMailbox(mailbox).getMessages(mailbox);

const getMessageDetailForMailbox = (mailbox, messageId) =>
  getProviderByMailbox(mailbox).getMessageDetail(mailbox, messageId);

const getMessagesForSocket = async (payload) => {
  const mailbox = {
    provider: payload.service,
    address: payload.email,
    token: payload.token,
    account_id: payload.account_id || payload.email,
  };

  return getMessagesForMailbox(mailbox);
};

module.exports = {
  getAvailableDomains,
  createMailboxAccount,
  loginMailboxAccount,
  getProviderStatus,
  getMessagesForMailbox,
  getMessageDetailForMailbox,
  getMessagesForSocket,
  listProviderCatalog,
};
