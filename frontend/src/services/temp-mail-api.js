import axios from 'axios';

const normalizeUrl = (value) => {
  if (!value) {
    return null;
  }

  const trimmedValue = String(value).trim();
  if (!trimmedValue || trimmedValue === 'undefined' || trimmedValue === 'null') {
    return null;
  }

  return trimmedValue.replace(/\/+$/, '');
};

const getDefaultBackendUrl = () => {
  if (typeof window === 'undefined') {
    return 'http://localhost:8001';
  }

  const { protocol, hostname } = window.location;
  const isLocalHost = ['localhost', '127.0.0.1'].includes(hostname);

  if (isLocalHost) {
    return `${protocol}//${hostname}:8001`;
  }

  return `${protocol}//${hostname}`;
};

export const BACKEND_URL = normalizeUrl(process.env.REACT_APP_BACKEND_URL) || getDefaultBackendUrl();
export const API_BASE_URL = `${BACKEND_URL}/api`;

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
});

export const getDomains = async (service) => {
  const response = await apiClient.get('/domains', { params: { service } });
  return response.data;
};

export const getServiceStats = async () => {
  const response = await apiClient.get('/');
  return response.data;
};

export const listMailboxes = async () => {
  const response = await apiClient.get('/emails');
  return response.data;
};

export const createMailbox = async (payload) => {
  const response = await apiClient.post('/emails/create', payload);
  return response.data;
};

export const loginMailbox = async (payload) => {
  const response = await apiClient.post('/emails/login', payload);
  return response.data;
};

export const deleteMailbox = async (mailboxId) => {
  const response = await apiClient.delete(`/emails/${mailboxId}`);
  return response.data;
};

export const extendMailbox = async (mailboxId) => {
  const response = await apiClient.post(`/emails/${mailboxId}/extend-time`);
  return response.data;
};

export const refreshMailboxMessages = async (mailboxId) => {
  const response = await apiClient.post(`/emails/${mailboxId}/refresh`);
  return response.data;
};

export const getMailboxMessageDetail = async (mailboxId, messageId) => {
  const response = await apiClient.get(`/emails/${mailboxId}/messages/${messageId}`);
  return response.data;
};

export const saveMailboxMessage = async (mailboxId, messageId) => {
  const response = await apiClient.post(`/emails/${mailboxId}/messages/${messageId}/save`);
  return response.data;
};

export const saveMailboxSnapshot = async (mailboxId) => {
  const response = await apiClient.post(`/emails/${mailboxId}/save`);
  return response.data;
};

export const listHistoryEmails = async () => {
  const response = await apiClient.get('/emails/history/list');
  return response.data;
};

export const getHistoryMessages = async (historyId) => {
  const response = await apiClient.get(`/emails/history/${historyId}/messages`);
  return response.data;
};

export const getHistoryMessageDetail = async (historyId, messageId) => {
  const response = await apiClient.get(`/emails/history/${historyId}/messages/${messageId}`);
  return response.data;
};

export const deleteHistoryEmails = async (ids) => {
  const response = await apiClient.delete('/emails/history/delete', {
    data: { ids },
  });
  return response.data;
};

export const exportHistoryArchive = async ({ ids = [], provider = 'all' } = {}) => {
  const response = await apiClient.get('/emails/history/export', {
    params: {
      ids: ids.length > 0 ? ids.join(',') : undefined,
      provider: provider && provider !== 'all' ? provider : undefined,
    },
    responseType: 'blob',
  });

  return {
    blob: response.data,
    filename:
      response.headers['content-disposition']?.match(/filename="(.+)"/)?.[1] || 'tempmail-history-export.json',
  };
};

export const listSavedEmails = async () => {
  const response = await apiClient.get('/emails/saved/list');
  return response.data;
};

export const getSavedEmailDetail = async (savedId) => {
  const response = await apiClient.get(`/emails/saved/${savedId}`);
  return response.data;
};

export const deleteSavedEmails = async (ids) => {
  const response = await apiClient.delete('/emails/saved/delete', {
    data: { ids },
  });
  return response.data;
};
