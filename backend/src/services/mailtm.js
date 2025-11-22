const axios = require('axios');
const { cache, DOMAIN_CACHE_TTL } = require('../utils/cache');

const BASE_URL = 'https://api.mail.tm';

const getDomains = async () => {
  const now = Date.now() / 1000;
  const cached = cache.mailtm;

  if (cached.domains.length > 0 && now < cached.expires_at) {
    console.log(`✅ Using cached Mail.tm domains (TTL: ${Math.floor(cached.expires_at - now)}s)`);
    return cached.domains;
  }

  try {
    const response = await axios.get(`${BASE_URL}/domains`);
    const domains = response.data['hydra:member'] || [];
    
    if (domains.length > 0) {
      const domainList = domains.map(d => d.domain);
      cache.mailtm.domains = domainList;
      cache.mailtm.expires_at = now + DOMAIN_CACHE_TTL;
      console.log(`✅ Cached ${domainList.length} Mail.tm domains`);
      return domainList;
    }
    return [];
  } catch (error) {
    console.error(`❌ Mail.tm domains error: ${error.message}`);
    if (cached.domains.length > 0) {
      console.warn('⚠️ Using expired cache due to API error');
      return cached.domains;
    }
    return [];
  }
};

const createAccount = async (address, password) => {
  try {
    const response = await axios.post(`${BASE_URL}/accounts`, {
      address,
      password
    });
    return response.data;
  } catch (error) {
    if (error.response && error.response.status === 429) {
      console.warn('⚠️ Mail.tm rate limited (429)');
      throw new Error('Mail.tm rate limited');
    }
    throw error;
  }
};

const getToken = async (address, password) => {
  try {
    const response = await axios.post(`${BASE_URL}/token`, {
      address,
      password
    });
    return response.data.token;
  } catch (error) {
    console.error(`Error getting Mail.tm token: ${error.message}`);
    throw error;
  }
};

const getMessages = async (token) => {
  try {
    const response = await axios.get(`${BASE_URL}/messages`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return response.data['hydra:member'] || [];
  } catch (error) {
    if (error.response && error.response.status === 401) {
      // Don't log 401s to console to avoid spam, just throw
      throw new Error('401 Unauthorized');
    }
    console.error(`Error getting Mail.tm messages: ${error.message}`);
    return [];
  }
};

const getMessageDetail = async (token, messageId) => {
  try {
    const response = await axios.get(`${BASE_URL}/messages/${messageId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = response.data;

    // Normalize html and text to always be arrays
    if (data.html) {
      if (Array.isArray(data.html)) {
        // pass
      } else if (typeof data.html === 'string') {
        data.html = data.html ? [data.html] : [];
      } else {
        data.html = [];
      }
    } else {
      data.html = [];
    }

    if (data.text) {
      if (Array.isArray(data.text)) {
        // pass
      } else if (typeof data.text === 'string') {
        data.text = data.text ? [data.text] : [];
      } else {
        data.text = [];
      }
    } else {
      data.text = [];
    }

    return data;
  } catch (error) {
    console.error(`Error getting Mail.tm message detail: ${error.message}`);
    return null;
  }
};

module.exports = {
  getDomains,
  createAccount,
  getToken,
  getMessages,
  getMessageDetail
};
