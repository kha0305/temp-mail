const { v4: uuidv4 } = require('uuid');

const PROVIDER_KEY = 'custom1';

const getDomains = async () => ['vip.custom1.com', 'pro.custom1.com'];

const createAccount = async ({ username, domain }) => ({
  address: `${username}@${domain}`,
  password: 'mock-password',
  token: uuidv4(),
  account_id: `${username}@${domain}`,
  username,
  domain,
});

const getMessages = async () => [
  {
    id: 'welcome-msg-c1',
    accountId: 'user@custom1.com',
    msgid: 'welcome-msg-c1',
    from: {
      address: 'support@custom1.com',
      name: 'Custom Service 1',
    },
    subject: 'Welcome to Custom Service 1',
    intro: 'Thanks for using our service.',
    seen: false,
    isDeleted: false,
    hasAttachments: false,
    size: 1024,
    downloadUrl: '',
    createdAt: new Date().toISOString(),
    html: ['<h1>Welcome!</h1><p>This is a custom API provider 1.</p>'],
    text: ['Welcome! This is a custom API provider 1.'],
  },
];

const getMessageDetail = async (mailbox, messageId) => {
  const messages = await getMessages(mailbox);
  return messages.find((message) => message.id === messageId) || null;
};

module.exports = {
  key: PROVIDER_KEY,
  label: 'Custom Service 1',
  getDomains,
  createAccount,
  getMessages,
  getMessageDetail,
};
