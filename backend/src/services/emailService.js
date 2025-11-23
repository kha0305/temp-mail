const { TempEmail, EmailHistory, SavedEmail } = require('../models');
const onesecmail = require('./onesecmail');
const guerrilla = require('./guerrilla');
const eduService = require('./eduService');
const customService1 = require('./customService1');
const customService2 = require('./customService2');
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
  if (preferredService === 'edu') providersToTry = ['edu'];
  else if (preferredService === 'custom1') providersToTry = ['custom1'];
  else if (preferredService === 'custom2') providersToTry = ['custom2'];
  else if (preferredService === '1secmail') providersToTry = ['1secmail'];
  else if (preferredService === 'guerrilla') providersToTry = ['guerrilla'];
  else {
    // Prioritize Custom services and Edu
    providersToTry = ['custom1', 'custom2', 'edu', 'guerrilla'];
    console.log(`👉 Auto-selecting stable providers: ${providersToTry.join(', ')}`);
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

      if (provider === 'edu') {
        const domains = await eduService.getDomains();
        if (!domains.length) continue;
        const domain = (preferredDomain && domains.includes(preferredDomain)) ? preferredDomain : domains[0];
        const accountData = await eduService.createAccount(username, domain);

        clearProviderCooldown(provider);
        providerStats[provider].success = (providerStats[provider].success || 0) + 1;
        console.log(`✅ Edu email created: ${accountData.address}`);

        return {
          address: accountData.address,
          password: accountData.password,
          token: accountData.token,
          account_id: accountData.id,
          provider: 'edu',
          service_name: 'Edu Mail',
          username,
          domain
        };
      } else if (provider === 'custom1') {
        const domains = await customService1.getDomains();
        if (!domains.length) continue;
        const domain = (preferredDomain && domains.includes(preferredDomain)) ? preferredDomain : domains[0];
        const accountData = await customService1.createAccount(username, domain);

        clearProviderCooldown(provider);
        providerStats[provider].success = (providerStats[provider].success || 0) + 1;
        console.log(`✅ Custom1 email created: ${accountData.address}`);

        return {
          address: accountData.address,
          password: accountData.password,
          token: accountData.token,
          account_id: accountData.id,
          provider: 'custom1',
          service_name: 'Custom Service 1',
          username,
          domain
        };
      } else if (provider === 'custom2') {
        const domains = await customService2.getDomains();
        if (!domains.length) continue;
        const domain = (preferredDomain && domains.includes(preferredDomain)) ? preferredDomain : domains[0];
        const accountData = await customService2.createAccount(username, domain);

        clearProviderCooldown(provider);
        providerStats[provider].success = (providerStats[provider].success || 0) + 1;
        console.log(`✅ Custom2 email created: ${accountData.address}`);

        return {
          address: accountData.address,
          password: accountData.password,
          token: accountData.token,
          account_id: accountData.id,
          provider: 'custom2',
          service_name: 'Custom Service 2',
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

const getMessages = async (provider, accountId, token) => {
  if (provider === 'edu') {
    return await eduService.getMessages(token);
  } else if (provider === 'custom1') {
    return await customService1.getMessages(token);
  } else if (provider === 'custom2') {
    return await customService2.getMessages(token);
  } else if (provider === '1secmail') {
    // 1secmail uses accountId as "user@domain"
    const [user, domain] = accountId.split('@');
    return await onesecmail.getMessages(user, domain);
  } else if (provider === 'guerrilla') {
    return await guerrilla.getMessages(token);
  }
  throw new Error(`Unknown provider: ${provider}`);
};

module.exports = {
  createEmailWithFailover,
  getMessages,
  onesecmail,
  guerrilla,
  eduService,
  customService1,
  customService2
};
