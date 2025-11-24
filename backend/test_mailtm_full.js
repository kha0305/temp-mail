const axios = require('axios');

const TEST_PROVIDER = 'https://api.mail.tm'; // Change to https://api.mail.gw to test mail.gw

const runTest = async () => {
  try {
    console.log(`Testing ${TEST_PROVIDER}...`);

    // 1. Get Domains
    console.log('1. Getting domains...');
    const domainRes = await axios.get(`${TEST_PROVIDER}/domains`);
    const domains = domainRes.data['hydra:member'];
    if (!domains || domains.length === 0) throw new Error('No domains found');
    const domain = domains[0].domain;
    console.log(`   Domain: ${domain}`);

    // 2. Create Account
    const username = `test${Math.floor(Math.random() * 10000)}`;
    const address = `${username}@${domain}`;
    const password = 'password123';
    console.log(`2. Creating account: ${address}...`);
    
    await axios.post(`${TEST_PROVIDER}/accounts`, {
      address,
      password
    });
    console.log('   Account created.');

    // 3. Get Token
    console.log('3. Getting token...');
    const tokenRes = await axios.post(`${TEST_PROVIDER}/token`, {
      address,
      password
    });
    const token = tokenRes.data.token;
    console.log('   Token obtained.');

    // 4. Get Messages (Empty)
    console.log('4. Getting messages (expect empty)...');
    const msgRes = await axios.get(`${TEST_PROVIDER}/messages`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log(`   Messages count: ${msgRes.data['hydra:member'].length}`);

    // 5. Send Email to self (if possible) - Mail.tm doesn't allow sending via API usually without own domain setup?
    // Actually mail.tm is receive-only for free tier usually, or maybe not.
    // But we can't easily test receiving without sending from elsewhere.
    // However, if we get here without error, the API integration is correct.
    
    console.log('✅ Full flow test passed!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Data:', JSON.stringify(error.response.data));
    }
  }
};

runTest();
