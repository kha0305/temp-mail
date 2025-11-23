const { v4: uuidv4 } = require('uuid');

const getDomains = async () => {
  return ['vip.custom1.com', 'pro.custom1.com'];
};

const createAccount = async (username, domain) => {
  const address = `${username}@${domain}`;
  const password = 'mock-password';
  const token = uuidv4();
  
  return {
    id: address,
    address: address,
    password: password,
    token: token
  };
};

const getMessages = async (token) => {
  return [{
    id: 'welcome-msg-c1',
    accountId: 'user@custom1.com',
    msgid: 'welcome-msg-c1',
    from: {
      address: "support@custom1.com",
      name: "Custom Service 1"
    },
    subject: "Welcome to Custom Service 1",
    intro: "Thanks for using our service.",
    seen: false,
    isDeleted: false,
    hasAttachments: false,
    size: 1024,
    downloadUrl: "",
    createdAt: new Date().toISOString(),
    html: [`<h1>Welcome!</h1><p>This is a custom API provider 1.</p>`],
    text: [`Welcome! This is a custom API provider 1.`]
  }];
};

const getMessageDetail = async (token, messageId) => {
  if (messageId === 'welcome-msg-c1') {
    return (await getMessages(token))[0];
  }
  return null;
};

module.exports = {
  getDomains,
  createAccount,
  getMessages,
  getMessageDetail
};
