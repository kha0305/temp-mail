const axios = require('axios');

const testProviders = async () => {
  console.log('Testing Email Providers...');

  // 1. Mail.tm
  try {
    const start = Date.now();
    const res = await axios.get('https://api.mail.tm/domains');
    console.log(`✅ Mail.tm: OK (${Date.now() - start}ms) - ${res.data['hydra:member'].length} domains`);
  } catch (e) {
    console.log(`❌ Mail.tm: Failed - ${e.message}`);
  }

  // 2. Mail.gw
  try {
    const start = Date.now();
    const res = await axios.get('https://api.mail.gw/domains');
    console.log(`✅ Mail.gw: OK (${Date.now() - start}ms) - ${res.data['hydra:member'].length} domains`);
  } catch (e) {
    console.log(`❌ Mail.gw: Failed - ${e.message}`);
  }

  // 3. 1secmail
  try {
    const start = Date.now();
    const res = await axios.get('https://www.1secmail.com/api/v1/?action=getDomainList');
    console.log(`✅ 1secmail: OK (${Date.now() - start}ms) - ${res.data.length} domains`);
  } catch (e) {
    console.log(`❌ 1secmail: Failed - ${e.message}`);
  }

  // 4. Guerrilla
  try {
    const start = Date.now();
    const res = await axios.get('https://api.guerrillamail.com/ajax.php?f=get_email_address');
    console.log(`✅ Guerrilla: OK (${Date.now() - start}ms)`);
  } catch (e) {
    console.log(`❌ Guerrilla: Failed - ${e.message}`);
  }
};

testProviders();
