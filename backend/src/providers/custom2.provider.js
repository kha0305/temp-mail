const { v4: uuidv4 } = require('uuid');

const PROVIDER_KEY = 'custom2';

const getDomains = async () => ['secure.custom2.com', 'fast.custom2.com'];

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
    id: 'welcome-msg-c2',
    accountId: 'user@custom2.com',
    msgid: 'welcome-msg-c2',
    from: {
      address: 'bot@custom2.com',
      name: 'Custom Service 2',
    },
    subject: 'Welcome to Custom Service 2',
    intro: 'Another custom provider.',
    seen: false,
    isDeleted: false,
    hasAttachments: false,
    size: 1024,
    downloadUrl: '',
    createdAt: new Date().toISOString(),
    html: ['<h1>Hello!</h1><p>This is a custom API provider 2.</p>'],
    text: ['Hello! This is a custom API provider 2.'],
  },
];

const getMessageDetail = async (mailbox, messageId) => {
  const messages = await getMessages(mailbox);
  return messages.find((message) => message.id === messageId) || null;
};

module.exports = {
  key: PROVIDER_KEY,
  label: 'Custom Service 2',
  getDomains,
  createAccount,
  getMessages,
  getMessageDetail,
};
