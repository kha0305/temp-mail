const axios = require('axios');
const { cache, DOMAIN_CACHE_TTL } = require('../utils/cache');

const BASE_URL = 'https://api.mail.gw';

const getDomains = async () => {
  const now = Date.now() / 1000;
  const cached = cache.mailgw;

  if (cached.domains.length > 0 && now < cached.expires_at) {
    console.log(`✅ Using cached mail.gw domains (TTL: ${Math.floor(cached.expires_at - now)}s)`);
    return cached.domains;
  }

  try {
    const response = await axios.get(`${BASE_URL}/domains`, { timeout: 10000 });
    const domains = response.data['hydra:member'] || [];
    
    if (domains.length > 0) {
      const domainList = domains.map(d => d.domain);
      cache.mailgw.domains = domainList;
      cache.mailgw.expires_at = now + DOMAIN_CACHE_TTL;
      console.log(`✅ Cached ${domainList.length} mail.gw domains`);
      return domainList;
    }
    return [];
  } catch (error) {
    console.error(`❌ Mail.gw domains error: ${error.message}`);
    if (cached.domains.length > 0) {
      return cached.domains;
    }
    return [];
  }
};

const createAccount = async (address, password) => {
  try {
    console.log(`📧 Creating Mail.gw account: ${address}`);
    const response = await axios.post(`${BASE_URL}/accounts`, {
      address,
      password
    }, { timeout: 30000 });
    console.log(`✅ Mail.gw account created successfully`);
    return response.data;
  } catch (error) {
    if (error.code === 'ECONNABORTED') {
      console.error(`❌ Mail.gw timeout: ${error.message}`);
      throw new Error('Mail.gw timeout after 30s');
    }
    if (error.response) {
      if (error.response.status === 429) {
        console.warn('⚠️ Mail.gw rate limited (429)');
        throw new Error('Mail.gw rate limited');
      }
      const errorText = JSON.stringify(error.response.data).substring(0, 200);
      console.error(`❌ Mail.gw HTTP error: ${error.response.status} - ${errorText}`);
      throw new Error(`Mail.gw HTTP ${error.response.status}`);
    }
    console.error(`❌ Mail.gw connection error: ${error.message}`);
    throw new Error(`Mail.gw failed: ${error.message}`);
  }
};

const getToken = async (address, password) => {
  try {
    const response = await axios.post(`${BASE_URL}/token`, {
      address,
      password
    }, { timeout: 10000 });
    return response.data.token;
  } catch (error) {
    console.error(`Error getting mail.gw token: ${error.message}`);
    throw error;
  }
};

const getMessages = async (token) => {
  try {
    const response = await axios.get(`${BASE_URL}/messages`, {
      headers: { Authorization: `Bearer ${token}` },
      timeout: 10000
    });
    return response.data['hydra:member'] || [];
  } catch (error) {
    if (error.response && (error.response.status === 401 || error.response.status === 403)) {
      throw new Error(`${error.response.status} Unauthorized`);
    }
    console.error(`Error getting mail.gw messages: ${error.message}`);
    return [];
  }
};

const getMessageDetail = async (token, messageId) => {
  try {
    const response = await axios.get(`${BASE_URL}/messages/${messageId}`, {
      headers: { Authorization: `Bearer ${token}` },
      timeout: 10000
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
    console.error(`Error getting mail.gw message detail: ${error.message}`);
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
