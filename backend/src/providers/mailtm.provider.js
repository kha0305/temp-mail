const axios = require('axios');
const { providerCache, DOMAIN_CACHE_TTL } = require('./provider-state.store');

const BASE_URL = 'https://api.mail.tm';
const PROVIDER_KEY = 'mailtm';

const getDomains = async () => {
  const now = Date.now() / 1000;
  const cached = providerCache[PROVIDER_KEY];

  if (cached.domains.length > 0 && now < cached.expires_at) {
    return cached.domains;
  }

  try {
    const response = await axios.get(`${BASE_URL}/domains`);
    const domains = response.data['hydra:member'] || [];

    if (domains.length > 0) {
      const domainList = domains.map((item) => item.domain);
      providerCache[PROVIDER_KEY].domains = domainList;
      providerCache[PROVIDER_KEY].expires_at = now + DOMAIN_CACHE_TTL;
      return domainList;
    }

    return [];
  } catch (error) {
    console.error(`Mail.tm domains error: ${error.message}`);
    return cached.domains.length > 0 ? cached.domains : [];
  }
};

const createAccount = async ({ username, domain, password }) => {
  const address = `${username}@${domain}`;

  try {
    await axios.post(`${BASE_URL}/accounts`, { address, password });
    const tokenResponse = await axios.post(`${BASE_URL}/token`, { address, password });

    return {
      address,
      password,
      token: tokenResponse.data.token,
      account_id: address,
      username,
      domain,
    };
  } catch (error) {
    if (error.response && error.response.status === 429) {
      throw new Error('Mail.tm rate limited');
    }

    throw error;
  }
};

const loginAccount = async ({ address, password }) => {
  try {
    const tokenResponse = await axios.post(`${BASE_URL}/token`, { address, password });
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
    if (error.response && error.response.status === 401) {
      throw new Error('Mail.tm invalid credentials');
    }

    if (error.response && error.response.status === 429) {
      throw new Error('Mail.tm rate limited');
    }

    throw new Error(`Mail.tm login failed: ${error.message}`);
  }
};

const getWelcomeMessage = () => ({
  id: 'welcome-mailtm',
  accountId: 'system',
  msgid: 'welcome-mailtm',
  from: {
    address: 'system@mail.tm',
    name: 'Mail.tm System',
  },
  subject: 'Welcome to Mail.tm',
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
    });

    const messages = response.data['hydra:member'] || [];
    return [getWelcomeMessage(), ...messages];
  } catch (error) {
    if (error.response && error.response.status === 401) {
      throw new Error('401 Unauthorized');
    }

    console.error(`Mail.tm messages error: ${error.message}`);
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
  if (messageId === 'welcome-mailtm') {
    return normalizeMessageDetail({
      ...getWelcomeMessage(),
      seen: true,
      html: [
        '<div style="font-family: sans-serif;"><h2>Welcome to Mail.tm!</h2><p>Your temporary email address is active.</p><p>You can use this address to receive emails from any sender.</p><p><b>Note:</b> Messages may take a few seconds to appear.</p></div>',
      ],
      text: ['Welcome to Mail.tm! Your temporary email address is active.'],
    });
  }

  try {
    const response = await axios.get(`${BASE_URL}/messages/${messageId}`, {
      headers: { Authorization: `Bearer ${mailbox.token}` },
    });

    return normalizeMessageDetail(response.data);
  } catch (error) {
    console.error(`Mail.tm message detail error: ${error.message}`);
    return null;
  }
};

module.exports = {
  key: PROVIDER_KEY,
  label: 'Mail.tm',
  getDomains,
  createAccount,
  loginAccount,
  getMessages,
  getMessageDetail,
};
