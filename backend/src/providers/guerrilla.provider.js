const axios = require('axios');
const crypto = require('crypto');
const { providerCache, DOMAIN_CACHE_TTL } = require('./provider-state.store');

const BASE_URL = 'https://api.guerrillamail.com/ajax.php';
const PROVIDER_KEY = 'guerrilla';

const getDomains = async () => {
  const now = Date.now() / 1000;
  const cached = providerCache[PROVIDER_KEY];

  if (cached.domains.length > 0 && now < cached.expires_at) {
    return cached.domains;
  }

  const defaultDomains = [
    'guerrillamail.com',
    'guerrillamail.net',
    'guerrillamail.org',
    'sharklasers.com',
    'spam4.me',
  ];

  providerCache[PROVIDER_KEY].domains = defaultDomains;
  providerCache[PROVIDER_KEY].expires_at = now + DOMAIN_CACHE_TTL;
  return defaultDomains;
};

const createAccount = async ({ username, domain }) => {
  try {
    const response = await axios.get(
      `${BASE_URL}?f=set_email_user&email_user=${username}&lang=en&site=guerrillamail.com`,
      { timeout: 10000 },
    );

    return {
      address: response.data.email_addr || `${username}@${domain}`,
      password: 'no-password',
      token: response.data.sid_token || '',
      account_id: response.data.sid_token || '',
      username,
      domain,
    };
  } catch (error) {
    console.error(`Guerrilla account error: ${error.message}`);
    const fallbackToken = crypto.randomUUID();

    return {
      address: `${username}@${domain}`,
      password: 'no-password',
      token: fallbackToken,
      account_id: fallbackToken,
      username,
      domain,
    };
  }
};

const getMessages = async (mailbox) => {
  try {
    const response = await axios.get(
      `${BASE_URL}?f=get_email_list&offset=0&sid_token=${mailbox.token}`,
      { timeout: 10000 },
    );

    return (response.data.list || []).map((message) => ({
      id: String(message.mail_id || ''),
      from: {
        address: message.mail_from || 'unknown',
        name: message.mail_from || 'unknown',
      },
      subject: message.mail_subject || 'No Subject',
      createdAt: message.mail_timestamp || new Date().toISOString(),
    }));
  } catch (error) {
    console.error(`Guerrilla messages error: ${error.message}`);
    return [];
  }
};

const getMessageDetail = async (mailbox, messageId) => {
  try {
    const response = await axios.get(
      `${BASE_URL}?f=fetch_email&email_id=${messageId}&sid_token=${mailbox.token}`,
      { timeout: 10000 },
    );

    const body = response.data.mail_body || response.data.mail_excerpt || '';

    return {
      id: String(response.data.mail_id || messageId),
      from: {
        address: response.data.mail_from || 'unknown',
        name: response.data.mail_from || 'unknown',
      },
      subject: response.data.mail_subject || 'No Subject',
      createdAt: response.data.mail_timestamp || new Date().toISOString(),
      html: body ? [body] : [],
      text: body ? [body] : [],
    };
  } catch (error) {
    console.error(`Guerrilla message detail error: ${error.message}`);
    return null;
  }
};

module.exports = {
  key: PROVIDER_KEY,
  label: 'Guerrilla Mail',
  getDomains,
  createAccount,
  getMessages,
  getMessageDetail,
};
