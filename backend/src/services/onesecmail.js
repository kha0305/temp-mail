const axios = require('axios');
const { cache, DOMAIN_CACHE_TTL } = require('../utils/cache');

const BASE_URL = 'https://www.1secmail.com/api/v1';
const RETRY_MAX_ATTEMPTS = 3;
const RETRY_BASE_DELAY = 1000;

const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  'Referer': 'https://www.1secmail.com/',
  'Origin': 'https://www.1secmail.com'
};

const getDomains = async () => {
  const now = Date.now() / 1000;
  const cached = cache['1secmail'];

  if (cached.domains.length > 0 && now < cached.expires_at) {
    console.log(`✅ Using cached 1secmail domains (TTL: ${Math.floor(cached.expires_at - now)}s)`);
    return cached.domains;
  }

  const FALLBACK_DOMAINS = [
    '1secmail.com', '1secmail.org', '1secmail.net',
    'wwjmp.com', 'esiix.com', 'xojxe.com', 'yoggm.com'
  ];

  for (let attempt = 0; attempt < RETRY_MAX_ATTEMPTS; attempt++) {
    try {
      const response = await axios.get(`${BASE_URL}/?action=getDomainList`, {
        headers: {
          ...BROWSER_HEADERS,
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        },
        timeout: 10000
      });
      
      const domains = response.data;
      if (Array.isArray(domains) && domains.length > 0) {
        cache['1secmail'].domains = domains;
        cache['1secmail'].expires_at = now + DOMAIN_CACHE_TTL;
        console.log(`✅ Cached ${domains.length} 1secmail domains from API`);
        return domains;
      }
    } catch (error) {
      console.error(`❌ 1secmail API error (attempt ${attempt + 1}): ${error.message}`);
      if (attempt < RETRY_MAX_ATTEMPTS - 1) {
        await new Promise(resolve => setTimeout(resolve, RETRY_BASE_DELAY * Math.pow(2, attempt)));
      }
    }
  }

  if (cached.domains.length > 0) {
    console.warn('⚠️ Using expired cache due to API errors');
    return cached.domains;
  }

  console.warn(`⚠️ 1secmail API unavailable, using ${FALLBACK_DOMAINS.length} fallback domains`);
  cache['1secmail'].domains = FALLBACK_DOMAINS;
  cache['1secmail'].expires_at = now + DOMAIN_CACHE_TTL;
  return FALLBACK_DOMAINS;
};

const createAccount = async (username, domain) => {
  const address = `${username}@${domain}`;
  return {
    address,
    password: 'no-password',
    token: address,
    account_id: address
  };
};

const getMessages = async (username, domain) => {
  try {
    const response = await axios.get(`${BASE_URL}/?action=getMessages&login=${username}&domain=${domain}`, {
      headers: BROWSER_HEADERS,
      timeout: 10000
    });
    
    const messages = response.data;
    return messages.map(msg => ({
      id: String(msg.id),
      from: {
        address: msg.from || 'unknown',
        name: msg.from || 'unknown'
      },
      subject: msg.subject || 'No Subject',
      createdAt: msg.date || new Date().toISOString()
    }));
  } catch (error) {
    if (error.response && error.response.status === 403) {
      throw new Error('403 Forbidden');
    }
    console.error(`Error getting 1secmail messages: ${error.message}`);
    return [];
  }
};

const getMessageDetail = async (username, domain, messageId) => {
  try {
    const response = await axios.get(`${BASE_URL}/?action=readMessage&login=${username}&domain=${domain}&id=${messageId}`, {
      headers: BROWSER_HEADERS,
      timeout: 10000
    });
    
    const msg = response.data;
    return {
      id: String(msg.id),
      from: {
        address: msg.from || 'unknown',
        name: msg.from || 'unknown'
      },
      subject: msg.subject || 'No Subject',
      createdAt: msg.date || new Date().toISOString(),
      html: msg.htmlBody ? [msg.htmlBody] : [],
      text: msg.textBody ? [msg.textBody] : []
    };
  } catch (error) {
    console.error(`Error getting 1secmail message detail: ${error.message}`);
    return null;
  }
};

module.exports = {
  getDomains,
  createAccount,
  getMessages,
  getMessageDetail
};
