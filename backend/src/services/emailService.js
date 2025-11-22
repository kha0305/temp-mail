const { TempEmail, EmailHistory, SavedEmail } = require('../models');
const mailtm = require('./mailtm');
const onesecmail = require('./onesecmail');
const mailgw = require('./mailgw');
const guerrilla = require('./guerrilla');
const { providerStats } = require('../utils/cache');

const PROVIDER_COOLDOWN_SECONDS = 60;

const isProviderInCooldown = (provider) => {
  const now = Date.now() / 1000;
  const stats = providerStats[provider] || {};
  const cooldownUntil = stats.cooldown_until || 0;

  if (now < cooldownUntil) {
    const remaining = Math.floor(cooldownUntil - now);
    console.warn(`⏸️ ${provider} is in cooldown (remaining: ${remaining}s)`);
    return true;
  }
  return false;
};

const setProviderCooldown = (provider, duration) => {
  const now = Date.now() / 1000;
  if (!providerStats[provider]) providerStats[provider] = {};
  providerStats[provider].cooldown_until = now + duration;
  console.warn(`🔒 ${provider} cooldown set for ${duration}s`);
};

const clearProviderCooldown = (provider) => {
  if (!providerStats[provider]) providerStats[provider] = {};
  providerStats[provider].cooldown_until = 0;
  console.log(`🔓 ${provider} cooldown cleared`);
};

const createEmailWithFailover = async (username, preferredService = 'auto', preferredDomain = null) => {
  if (!username) {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    username = '';
    for (let i = 0; i < 10; i++) {
      username += chars.charAt(Math.floor(Math.random() * chars.length));
    }
  }

  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let password = '';
  for (let i = 0; i < 16; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  let providersToTry = [];
  if (preferredService === 'mailtm') providersToTry = ['mailtm'];
  else if (preferredService === '1secmail') providersToTry = ['1secmail'];
  else if (preferredService === 'mailgw') providersToTry = ['mailgw'];
  else if (preferredService === 'guerrilla') providersToTry = ['guerrilla'];
  else {
    providersToTry = ['mailtm', 'mailgw', '1secmail'];
    // Shuffle
    for (let i = providersToTry.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [providersToTry[i], providersToTry[j]] = [providersToTry[j], providersToTry[i]];
    }
    console.log(`🎲 Random provider order: ${providersToTry}`);
  }

  const errors = [];
  const skippedProviders = [];

  for (const provider of providersToTry) {
    if (isProviderInCooldown(provider)) {
      skippedProviders.push(provider);
      console.log(`⏭️ Skipping ${provider} (in cooldown)`);
      continue;
    }

    try {
      console.log(`🔄 Trying ${provider}...`);

      if (provider === 'mailtm') {
        const domains = await mailtm.getDomains();
        if (!domains.length) continue;
        const domain = (preferredDomain && domains.includes(preferredDomain)) ? preferredDomain : domains[0];
        const address = `${username}@${domain}`;
        const accountData = await mailtm.createAccount(address, password);
        const token = await mailtm.getToken(address, password);

        clearProviderCooldown(provider);
        providerStats[provider].success = (providerStats[provider].success || 0) + 1;
        console.log(`✅ Mail.tm email created: ${address}`);

        return {
          address,
          password,
          token,
          account_id: accountData.id,
          provider: 'mailtm',
          service_name: 'Mail.tm',
          username,
          domain
        };
      } else if (provider === 'mailgw') {
        const domains = await mailgw.getDomains();
        if (!domains.length) continue;
        const domain = (preferredDomain && domains.includes(preferredDomain)) ? preferredDomain : domains[0];
        const address = `${username}@${domain}`;
        const accountData = await mailgw.createAccount(address, password);
        const token = await mailgw.getToken(address, password);

        clearProviderCooldown(provider);
        providerStats[provider].success = (providerStats[provider].success || 0) + 1;
        console.log(`✅ Mail.gw email created: ${address}`);

        return {
          address,
          password,
          token,
          account_id: accountData.id,
          provider: 'mailgw',
          service_name: 'Mail.gw',
          username,
          domain
        };
      } else if (provider === '1secmail') {
        const domains = await onesecmail.getDomains();
        if (!domains.length) continue;
        const domain = (preferredDomain && domains.includes(preferredDomain)) ? preferredDomain : domains[0];
        const accountData = await onesecmail.createAccount(username, domain);

        clearProviderCooldown(provider);
        providerStats[provider].success = (providerStats[provider].success || 0) + 1;
        console.log(`✅ 1secmail email created: ${accountData.address}`);

        return {
          address: accountData.address,
          password: accountData.password,
          token: accountData.token,
          account_id: accountData.account_id,
          provider: '1secmail',
          service_name: '1secmail',
          username,
          domain
        };
      } else if (provider === 'guerrilla') {
        const domains = await guerrilla.getDomains();
        if (!domains.length) continue;
        const domain = (preferredDomain && domains.includes(preferredDomain)) ? preferredDomain : domains[0];
        const accountData = await guerrilla.createAccount(username, domain);

        clearProviderCooldown(provider);
        providerStats[provider].success = (providerStats[provider].success || 0) + 1;
        console.log(`✅ Guerrilla email created: ${accountData.address}`);

        return {
          address: accountData.address,
          password: accountData.password,
          token: accountData.token,
          account_id: accountData.account_id,
          provider: 'guerrilla',
          service_name: 'Guerrilla Mail',
          username,
          domain
        };
      }

    } catch (error) {
      console.error(`❌ ${provider} failed: ${error.message}`);
      providerStats[provider].failures = (providerStats[provider].failures || 0) + 1;
      if (error.message.includes('rate limited') || (error.response && error.response.status === 429)) {
        setProviderCooldown(provider, PROVIDER_COOLDOWN_SECONDS);
        errors.push(`${provider}: rate limited`);
      } else {
        errors.push(`${provider}: ${error.message}`);
      }
    }
  }

  let errorMessage = 'Tất cả dịch vụ email đều không khả dụng';
  const errorParts = [];
  if (skippedProviders.length) errorParts.push(`Providers in cooldown: ${skippedProviders.join(', ')}`);
  if (errors.length) errorParts.push(`Errors: ${errors.join(', ')}`);
  if (errorParts.length) errorMessage += `. ${errorParts.join(' | ')}`;

  console.error(`❌ All providers failed: ${errorMessage}`);
  throw new Error(errorMessage);
};

module.exports = {
  createEmailWithFailover,
  mailtm,
  onesecmail,
  mailgw,
  guerrilla
};
