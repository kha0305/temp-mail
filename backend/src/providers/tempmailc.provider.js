const axios = require('axios');
const { providerCache, DOMAIN_CACHE_TTL } = require('./provider-state.store');

const BASE_URL = 'https://tempmailc.com/api/v1';
const PROVIDER_KEY = 'tempmailc';
const DEFAULT_TIMEOUT_MS = 10000;
const FALLBACK_DOMAINS = [
  'iopia.org',
  'kvarra.org',
  'aatrox.org',
  'ambes.org',
  'kojoball.email',
  'kortazo.email',
  'shla7.org',
];

const toTimestamp = (value) => {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return new Date().toISOString();
  }

  const milliseconds = numericValue > 10_000_000_000 ? numericValue : numericValue * 1000;
  return new Date(milliseconds).toISOString();
};

const normalizeMessageDetail = (payload) => {
  const data = payload || {};

  const html = Array.isArray(data.html)
    ? data.html
    : typeof data.html === 'string' && data.html
      ? [data.html]
      : typeof data.body_html === 'string' && data.body_html
        ? [data.body_html]
        : [];

  const text = Array.isArray(data.text)
    ? data.text
    : typeof data.text === 'string' && data.text
      ? [data.text]
      : typeof data.body_text === 'string' && data.body_text
        ? [data.body_text]
        : [];

  return {
    id: String(data.id || data.msg_id || ''),
    from: {
      address: data.from || 'unknown',
      name: data.from || 'unknown',
    },
    subject: data.subject || 'No Subject',
    createdAt: toTimestamp(data.ts || data.date || Date.now()),
    html,
    text,
  };
};

const getDomains = async () => {
  const now = Date.now() / 1000;
  const cached = providerCache[PROVIDER_KEY];

  if (cached.domains.length > 0 && now < cached.expires_at) {
    return cached.domains;
  }

  try {
    const response = await axios.get(`${BASE_URL}/domains`, { timeout: DEFAULT_TIMEOUT_MS });
    const domains = Array.isArray(response.data?.domains) ? response.data.domains : [];

    if (domains.length > 0) {
      providerCache[PROVIDER_KEY].domains = domains;
      providerCache[PROVIDER_KEY].expires_at = now + DOMAIN_CACHE_TTL;
      return domains;
    }
  } catch (error) {
    console.error(`TempMailC domains error: ${error.message}`);
  }

  if (cached.domains.length > 0) {
    return cached.domains;
  }

  providerCache[PROVIDER_KEY].domains = FALLBACK_DOMAINS;
  providerCache[PROVIDER_KEY].expires_at = now + DOMAIN_CACHE_TTL;
  return FALLBACK_DOMAINS;
};

const createAccount = async ({ username, domain }) => {
  const domains = await getDomains();
  const resolvedDomain = domain && domains.includes(domain) ? domain : domains[0];
  let address = resolvedDomain ? `${username}@${resolvedDomain}` : null;

  if (!address) {
    const response = await axios.get(`${BASE_URL}/new`, { timeout: DEFAULT_TIMEOUT_MS });
    address = String(response.data?.email || '').trim();
  }

  if (!address) {
    throw new Error('TempMailC failed to generate address');
  }

  try {
    await axios.get(`${BASE_URL}/inbox`, {
      params: { email: address },
      timeout: DEFAULT_TIMEOUT_MS,
    });
  } catch (error) {
    if (error.response && error.response.status === 429) {
      throw new Error('TempMailC rate limited');
    }

    throw new Error(`TempMailC inbox unavailable: ${error.message}`);
  }

  const [resolvedUsername = username, resolvedDomainFromAddress = resolvedDomain || ''] = address.split('@');

  return {
    address,
    password: 'no-password',
    token: address,
    account_id: address,
    username: resolvedUsername,
    domain: resolvedDomainFromAddress,
  };
};

const getMessages = async (mailbox) => {
  try {
    const response = await axios.get(`${BASE_URL}/inbox`, {
      params: { email: mailbox.address },
      timeout: DEFAULT_TIMEOUT_MS,
    });
    const messages = Array.isArray(response.data?.messages) ? response.data.messages : [];

    return messages.map((message) => ({
      id: String(message.id),
      from: {
        address: message.from || 'unknown',
        name: message.from || 'unknown',
      },
      subject: message.subject || 'No Subject',
      createdAt: toTimestamp(message.ts),
    }));
  } catch (error) {
    if (error.response && error.response.status === 429) {
      throw new Error('TempMailC rate limited');
    }

    console.error(`TempMailC messages error: ${error.message}`);
    return [];
  }
};

const getMessageDetail = async (mailbox, messageId) => {
  try {
    const response = await axios.get(`${BASE_URL}/message`, {
      params: {
        email: mailbox.address,
        msg_id: messageId,
      },
      timeout: DEFAULT_TIMEOUT_MS,
    });

    return normalizeMessageDetail({
      ...response.data,
      id: messageId,
    });
  } catch (error) {
    console.error(`TempMailC message detail error: ${error.message}`);
    return null;
  }
};

module.exports = {
  key: PROVIDER_KEY,
  label: 'TempMailC',
  getDomains,
  createAccount,
  getMessages,
  getMessageDetail,
};
