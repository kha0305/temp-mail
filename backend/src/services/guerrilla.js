const axios = require('axios');
const { cache, DOMAIN_CACHE_TTL } = require('../utils/cache');
const { v4: uuidv4 } = require('uuid'); // Need to install uuid if not present, or use crypto

const BASE_URL = 'https://api.guerrillamail.com/ajax.php';

const getDomains = async () => {
  const now = Date.now() / 1000;
  const cached = cache.guerrilla;

  if (cached.domains.length > 0 && now < cached.expires_at) {
    console.log(`✅ Using cached Guerrilla domains (TTL: ${Math.floor(cached.expires_at - now)}s)`);
    return cached.domains;
  }

  const defaultDomains = ['guerrillamail.com', 'guerrillamail.net', 'guerrillamail.org', 'sharklasers.com', 'spam4.me'];
  cache.guerrilla.domains = defaultDomains;
  cache.guerrilla.expires_at = now + DOMAIN_CACHE_TTL;
  console.log(`✅ Cached ${defaultDomains.length} Guerrilla domains`);
  return defaultDomains;
};

const createAccount = async (username, domain) => {
  try {
    const response = await axios.get(`${BASE_URL}?f=set_email_user&email_user=${username}&lang=en&site=guerrillamail.com`, { timeout: 10000 });
    const data = response.data;

    const address = data.email_addr || `${username}@${domain}`;
    const sid_token = data.sid_token || '';

    return {
      address,
      password: 'no-password',
      token: sid_token,
      account_id: sid_token
    };
  } catch (error) {
    console.error(`Error creating Guerrilla account: ${error.message}`);
    // Fallback
    const address = `${username}@${domain}`;
    const uuid = require('crypto').randomUUID();
    return {
      address,
      password: 'no-password',
      token: uuid,
      account_id: uuid
    };
  }
};

const getMessages = async (sid_token) => {
  try {
    const response = await axios.get(`${BASE_URL}?f=get_email_list&offset=0&sid_token=${sid_token}`, { timeout: 10000 });
    const data = response.data;
    const messages = data.list || [];

    return messages.map(msg => ({
      id: String(msg.mail_id || ''),
      from: {
        address: msg.mail_from || 'unknown',
        name: msg.mail_from || 'unknown'
      },
      subject: msg.mail_subject || 'No Subject',
      createdAt: msg.mail_timestamp || new Date().toISOString()
    }));
  } catch (error) {
    console.error(`Error getting Guerrilla messages: ${error.message}`);
    return [];
  }
};

const getMessageDetail = async (sid_token, messageId) => {
  try {
    const response = await axios.get(`${BASE_URL}?f=fetch_email&email_id=${messageId}&sid_token=${sid_token}`, { timeout: 10000 });
    const data = response.data;

    let mail_body = data.mail_body || '';
    if (!mail_body) {
      mail_body = data.mail_excerpt || '';
    }

    const html_content = mail_body ? [mail_body] : [];
    const text_content = mail_body ? [mail_body] : [];

    console.log(`📧 Guerrilla message detail - ID: ${messageId}, HTML length: ${mail_body.length}`);

    return {
      id: String(data.mail_id || messageId),
      from: {
        address: data.mail_from || 'unknown',
        name: data.mail_from || 'unknown'
      },
      subject: data.mail_subject || 'No Subject',
      createdAt: data.mail_timestamp || new Date().toISOString(),
      html: html_content,
      text: text_content
    };
  } catch (error) {
    console.error(`❌ Error getting Guerrilla message detail: ${error.message}`);
    return null;
  }
};

module.exports = {
  getDomains,
  createAccount,
  getMessages,
  getMessageDetail
};
