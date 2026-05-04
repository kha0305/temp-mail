const axios = require('axios');
const { providerCache, DOMAIN_CACHE_TTL } = require('./provider-state.store');

const BASE_URL = 'https://www.1secmail.com/api/v1';
const PROVIDER_KEY = '1secmail';
const RETRY_MAX_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 1000;
const DOMAIN_RETRY_COOLDOWN_SECONDS = 120;
const DOMAIN_BLOCK_COOLDOWN_SECONDS = 15 * 60;
const DOMAIN_ERROR_LOG_INTERVAL_SECONDS = 300;

const BROWSER_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept: 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  Referer: 'https://www.1secmail.com/',
  Origin: 'https://www.1secmail.com',
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const getDomains = async () => {
  const now = Date.now() / 1000;
  const cached = providerCache[PROVIDER_KEY];

  if (cached.domains.length > 0 && now < cached.expires_at) {
    return cached.domains;
  }

  if (now < (cached.domain_retry_after || 0) && cached.domains.length > 0) {
    return cached.domains;
  }

  const fallbackDomains = [
    '1secmail.com',
    '1secmail.org',
    '1secmail.net',
    'wwjmp.com',
    'esiix.com',
    'xojxe.com',
    'yoggm.com',
  ];

  for (let attempt = 0; attempt < RETRY_MAX_ATTEMPTS; attempt += 1) {
    try {
      const response = await axios.get(`${BASE_URL}/?action=getDomainList`, {
        headers: {
          ...BROWSER_HEADERS,
          'Cache-Control': 'no-cache',
          Pragma: 'no-cache',
        },
        timeout: 10000,
      });

      if (Array.isArray(response.data) && response.data.length > 0) {
        providerCache[PROVIDER_KEY].domains = response.data;
        providerCache[PROVIDER_KEY].expires_at = now + DOMAIN_CACHE_TTL;
        providerCache[PROVIDER_KEY].domain_retry_after = 0;
        return response.data;
      }
    } catch (error) {
      const status = error.response?.status;

      if (status === 403) {
        providerCache[PROVIDER_KEY].domains = fallbackDomains;
        providerCache[PROVIDER_KEY].expires_at = now + DOMAIN_CACHE_TTL;
        providerCache[PROVIDER_KEY].domain_retry_after = now + DOMAIN_BLOCK_COOLDOWN_SECONDS;

        const canLog = now >= (cached.last_domain_error_log_at || 0) + DOMAIN_ERROR_LOG_INTERVAL_SECONDS;
        if (canLog) {
          providerCache[PROVIDER_KEY].last_domain_error_log_at = now;
          console.warn(
            `1secmail domains blocked (HTTP 403). Using fallback domains and retrying in ${DOMAIN_BLOCK_COOLDOWN_SECONDS}s.`,
          );
        }

        return fallbackDomains;
      }

      const isLastAttempt = attempt === RETRY_MAX_ATTEMPTS - 1;
      if (isLastAttempt) {
        const canLog = now >= (cached.last_domain_error_log_at || 0) + DOMAIN_ERROR_LOG_INTERVAL_SECONDS;
        if (canLog) {
          providerCache[PROVIDER_KEY].last_domain_error_log_at = now;
          console.warn(`1secmail domains error after ${RETRY_MAX_ATTEMPTS} attempts: ${error.message}`);
        }
      }

      if (attempt < RETRY_MAX_ATTEMPTS - 1) {
        await sleep(RETRY_BASE_DELAY_MS * Math.pow(2, attempt));
      }
    }
  }

  if (cached.domains.length > 0) {
    return cached.domains;
  }

  providerCache[PROVIDER_KEY].domains = fallbackDomains;
  providerCache[PROVIDER_KEY].expires_at = now + DOMAIN_CACHE_TTL;
  providerCache[PROVIDER_KEY].domain_retry_after = now + DOMAIN_RETRY_COOLDOWN_SECONDS;
  return fallbackDomains;
};

const createAccount = async ({ username, domain }) => {
  const address = `${username}@${domain}`;

  return {
    address,
    password: 'no-password',
    token: address,
    account_id: address,
    username,
    domain,
  };
};

const resolveIdentity = (mailbox) => {
  const address = mailbox.address || mailbox.account_id || mailbox.token;
  const [username = mailbox.username, domain = mailbox.domain] = String(address).split('@');
  return { username, domain };
};

const getMessages = async (mailbox) => {
  const { username, domain } = resolveIdentity(mailbox);

  try {
    const response = await axios.get(
      `${BASE_URL}/?action=getMessages&login=${username}&domain=${domain}`,
      {
        headers: BROWSER_HEADERS,
        timeout: 10000,
      },
    );

    return (response.data || []).map((message) => ({
      id: String(message.id),
      from: {
        address: message.from || 'unknown',
        name: message.from || 'unknown',
      },
      subject: message.subject || 'No Subject',
      createdAt: message.date || new Date().toISOString(),
    }));
  } catch (error) {
    if (error.response && error.response.status === 403) {
      throw new Error('1secmail blocked (HTTP 403)');
    }

    console.error(`1secmail messages error: ${error.message}`);
    return [];
  }
};

const getMessageDetail = async (mailbox, messageId) => {
  const { username, domain } = resolveIdentity(mailbox);

  try {
    const response = await axios.get(
      `${BASE_URL}/?action=readMessage&login=${username}&domain=${domain}&id=${messageId}`,
      {
        headers: BROWSER_HEADERS,
        timeout: 10000,
      },
    );

    const message = response.data;

    return {
      id: String(message.id),
      from: {
        address: message.from || 'unknown',
        name: message.from || 'unknown',
      },
      subject: message.subject || 'No Subject',
      createdAt: message.date || new Date().toISOString(),
      html: message.htmlBody ? [message.htmlBody] : [],
      text: message.textBody ? [message.textBody] : [],
    };
  } catch (error) {
    console.error(`1secmail message detail error: ${error.message}`);
    return null;
  }
};

module.exports = {
  key: PROVIDER_KEY,
  label: '1secmail',
  getDomains,
  createAccount,
  getMessages,
  getMessageDetail,
};
