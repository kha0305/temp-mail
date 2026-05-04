export const dedupeById = (items = []) => {
  const seenIds = new Set();

  return items.filter((item) => {
    if (!item || seenIds.has(item.id)) {
      return false;
    }

    seenIds.add(item.id);
    return true;
  });
};

export const formatTimeLeft = (seconds) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export const isValidMailboxPassword = (value) => {
  const normalizedValue = String(value || '').trim();

  return Boolean(normalizedValue) && !['no-password', 'mock-password', 'null', 'undefined'].includes(normalizedValue);
};

export const getMessageSender = (message) => {
  if (!message) {
    return '';
  }

  return message.from?.name || message.from?.address || message.from || 'Unknown';
};

export const getMessageSenderAddress = (message) => {
  if (!message) {
    return '';
  }

  return message.from?.address || message.from?.name || message.from || 'Unknown';
};

const normalizeMessageContent = (value) => {
  if (Array.isArray(value)) {
    return value.filter(Boolean).join('\n');
  }

  return value || '';
};

const stripHtmlTags = (value) =>
  String(value || '')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export const getMessageHtmlContent = (message) => normalizeMessageContent(message?.html);

export const getMessageTextContent = (message) => normalizeMessageContent(message?.text);

export const getMessageAttachmentCount = (message) => {
  if (Array.isArray(message?.attachments)) {
    return message.attachments.length;
  }

  return message?.hasAttachments ? 1 : 0;
};

export const getMessagePreview = (message) => {
  const candidates = [
    message?.intro,
    getMessageTextContent(message),
    stripHtmlTags(getMessageHtmlContent(message)),
  ];

  const preview = candidates.find((item) => item && String(item).trim());

  if (!preview) {
    return 'Mở email để xem nội dung chi tiết.';
  }

  return String(preview).replace(/\s+/g, ' ').trim().slice(0, 140);
};

export const getMessageInitial = (message) => {
  const sender = getMessageSender(message);
  return (sender || '?').trim().charAt(0).toUpperCase() || '?';
};

export const formatMessageTimestamp = (value) => {
  if (!value) {
    return '--:--';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '--:--';
  }

  const now = new Date();
  const isSameDay = date.toDateString() === now.toDateString();

  if (isSameDay) {
    return date.toLocaleTimeString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  return `${date.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
  })} ${date.toLocaleTimeString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
  })}`;
};

export const formatMessageDateTime = (value) => {
  if (!value) {
    return 'Không rõ thời gian';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Không rõ thời gian';
  }

  return date.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};
