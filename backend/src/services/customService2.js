const { v4: uuidv4 } = require('uuid');

const getDomains = async () => {
  return ['secure.custom2.com', 'fast.custom2.com'];
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
    id: 'welcome-msg-c2',
    accountId: 'user@custom2.com',
    msgid: 'welcome-msg-c2',
    from: {
      address: "bot@custom2.com",
      name: "Custom Service 2"
    },
    subject: "Welcome to Custom Service 2",
    intro: "Another custom provider.",
    seen: false,
    isDeleted: false,
    hasAttachments: false,
    size: 1024,
    downloadUrl: "",
    createdAt: new Date().toISOString(),
    html: [`<h1>Hello!</h1><p>This is a custom API provider 2.</p>`],
    text: [`Hello! This is a custom API provider 2.`]
  }];
};

const getMessageDetail = async (token, messageId) => {
  if (messageId === 'welcome-msg-c2') {
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
