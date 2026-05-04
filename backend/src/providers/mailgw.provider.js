const axios = require('axios');
const { providerCache, DOMAIN_CACHE_TTL } = require('./provider-state.store');

const BASE_URL = 'https://api.mail.gw';
const PROVIDER_KEY = 'mailgw';
const DOMAIN_RETRY_COOLDOWN_SECONDS = 120;
const DOMAIN_ERROR_LOG_INTERVAL_SECONDS = 120;

const getDomains = async () => {
  const now = Date.now() / 1000;
  const cached = providerCache[PROVIDER_KEY];

  if (cached.domains.length > 0 && now < cached.expires_at) {
    return cached.domains;
  }

  if (now < (cached.domain_retry_after || 0)) {
    return cached.domains.length > 0 ? cached.domains : [];
  }

  try {
    const response = await axios.get(`${BASE_URL}/domains`, { timeout: 10000 });
    const domains = response.data['hydra:member'] || [];

    if (domains.length > 0) {
      const domainList = domains.map((item) => item.domain);
      providerCache[PROVIDER_KEY].domains = domainList;
      providerCache[PROVIDER_KEY].expires_at = now + DOMAIN_CACHE_TTL;
      providerCache[PROVIDER_KEY].domain_retry_after = 0;
      return domainList;
    }

    providerCache[PROVIDER_KEY].domain_retry_after = now + DOMAIN_RETRY_COOLDOWN_SECONDS;
    return [];
  } catch (error) {
    providerCache[PROVIDER_KEY].domain_retry_after = now + DOMAIN_RETRY_COOLDOWN_SECONDS;

    const canLog = now >= (cached.last_domain_error_log_at || 0) + DOMAIN_ERROR_LOG_INTERVAL_SECONDS;
    if (canLog) {
      providerCache[PROVIDER_KEY].last_domain_error_log_at = now;
      const status = error.response?.status ? `HTTP ${error.response.status}` : error.message;
      console.warn(
        `Mail.gw domains unavailable (${status}). Retrying in ${DOMAIN_RETRY_COOLDOWN_SECONDS}s.`,
      );
    }

    return cached.domains.length > 0 ? cached.domains : [];
  }
};

const createAccount = async ({ username, domain, password }) => {
  const address = `${username}@${domain}`;

  try {
    await axios.post(
      `${BASE_URL}/accounts`,
      { address, password },
      { timeout: 30000 },
    );

    const tokenResponse = await axios.post(
      `${BASE_URL}/token`,
      { address, password },
      { timeout: 10000 },
    );

    return {
      address,
      password,
      token: tokenResponse.data.token,
      account_id: address,
      username,
      domain,
    };
  } catch (error) {
    if (error.code === 'ECONNABORTED') {
      throw new Error('Mail.gw timeout after 30s');
    }

    if (error.response && error.response.status === 429) {
      throw new Error('Mail.gw rate limited');
    }

    if (error.response) {
      throw new Error(`Mail.gw HTTP ${error.response.status}`);
    }

    throw new Error(`Mail.gw failed: ${error.message}`);
  }
};

const loginAccount = async ({ address, password }) => {
  try {
    const tokenResponse = await axios.post(
      `${BASE_URL}/token`,
      { address, password },
      { timeout: 10000 },
    );
    const [username = '', domain = ''] = String(address).split('@');

    return {
      address,
      password,
      token: tokenResponse.data.token,
      account_id: address,
      username,
      domain,
    };
  } catch (error) {
    if (error.code === 'ECONNABORTED') {
      throw new Error('Mail.gw login timeout');
    }

    if (error.response && (error.response.status === 401 || error.response.status === 403)) {
      throw new Error('Mail.gw invalid credentials');
    }

    if (error.response && error.response.status === 429) {
      throw new Error('Mail.gw rate limited');
    }

    throw new Error(`Mail.gw login failed: ${error.message}`);
  }
};

const getWelcomeMessage = () => ({
  id: 'welcome-mailgw',
  accountId: 'system',
  msgid: 'welcome-mailgw',
  from: {
    address: 'system@mail.gw',
    name: 'Mail.gw System',
  },
  subject: 'Welcome to Mail.gw',
  intro: 'Your inbox is ready to receive emails.',
  seen: false,
  isDeleted: false,
  hasAttachments: false,
  size: 100,
  downloadUrl: '',
  createdAt: new Date().toISOString(),
});

const getMessages = async (mailbox) => {
  try {
    const response = await axios.get(`${BASE_URL}/messages`, {
      headers: { Authorization: `Bearer ${mailbox.token}` },
      timeout: 10000,
    });

    const messages = response.data['hydra:member'] || [];
    return [getWelcomeMessage(), ...messages];
  } catch (error) {
    if (error.response && (error.response.status === 401 || error.response.status === 403)) {
      throw new Error(`${error.response.status} Unauthorized`);
    }

    console.error(`Mail.gw messages error: ${error.message}`);
    return [];
  }
};

const normalizeMessageDetail = (message) => {
  const data = { ...message };

  if (!Array.isArray(data.html)) {
    data.html = typeof data.html === 'string' && data.html ? [data.html] : [];
  }

  if (!Array.isArray(data.text)) {
    data.text = typeof data.text === 'string' && data.text ? [data.text] : [];
  }

  return data;
};

const getMessageDetail = async (mailbox, messageId) => {
  if (messageId === 'welcome-mailgw') {
    return normalizeMessageDetail({
      ...getWelcomeMessage(),
      seen: true,
      html: [
        '<div style="font-family: sans-serif;"><h2>Welcome to Mail.gw!</h2><p>Your temporary email address is active.</p><p>You can use this address to receive emails from any sender.</p><p><b>Note:</b> Messages may take a few seconds to appear.</p></div>',
      ],
      text: ['Welcome to Mail.gw! Your temporary email address is active.'],
    });
  }

  try {
    const response = await axios.get(`${BASE_URL}/messages/${messageId}`, {
      headers: { Authorization: `Bearer ${mailbox.token}` },
      timeout: 10000,
    });

    return normalizeMessageDetail(response.data);
  } catch (error) {
    console.error(`Mail.gw message detail error: ${error.message}`);
    return null;
  }
};

module.exports = {
  key: PROVIDER_KEY,
  label: 'Mail.gw',
  getDomains,
  createAccount,
  loginAccount,
  getMessages,
  getMessageDetail,
};
