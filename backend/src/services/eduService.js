const { v4: uuidv4 } = require('uuid');

const getDomains = async () => {
  return ['student.university.edu', 'faculty.college.edu'];
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
  // Stateless: Always return the welcome message
  return [{
    id: 'welcome-msg-edu',
    accountId: 'student@university.edu',
    msgid: 'welcome-msg-edu',
    from: {
      address: "admin@university.edu",
      name: "University Admin"
    },
    subject: "Welcome to EduMail",
    intro: "Your educational email is ready.",
    seen: false,
    isDeleted: false,
    hasAttachments: false,
    size: 1024,
    downloadUrl: "",
    createdAt: new Date().toISOString(),
    html: [`<p>Welcome,</p><p>Your .edu email is active.</p>`],
    text: [`Welcome, Your .edu email is active.`]
  }];
};

const getMessageDetail = async (token, messageId) => {
  if (messageId === 'welcome-msg-edu') {
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
