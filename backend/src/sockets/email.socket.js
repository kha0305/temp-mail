const { Server } = require('socket.io');
const messageService = require('../services/message.service');

const SOCKET_POLL_INTERVAL_MS = 5000;

const buildWatchKey = (payload) =>
  JSON.stringify({
    email: payload.email,
    service: payload.service,
    token: payload.token || '',
    account_id: payload.account_id || '',
  });

const buildMessageFingerprint = (messages = []) =>
  messages
    .map((message) => `${message.id}:${message.createdAt || ''}:${message.seen ? '1' : '0'}`)
    .join('|');

const isAuthorizationError = (error) => {
  const message = String(error?.message || '');

  return (
    message.includes('401') ||
    message.includes('403') ||
    message.includes('Unauthorized') ||
    message.includes('Forbidden')
  );
};

const setupEmailSocket = (server, allowedOrigins) => {
  const io = new Server(server, {
    cors: {
      origin: allowedOrigins,
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['polling', 'websocket'],
    allowEIO3: true,
  });

  const mailboxWatchers = new Map();
  const socketSubscriptions = new Map();

  const stopWatcher = (watchKey) => {
    const watcher = mailboxWatchers.get(watchKey);

    if (!watcher) {
      return;
    }

    if (watcher.intervalId) {
      clearInterval(watcher.intervalId);
    }

    for (const socketId of watcher.socketIds) {
      socketSubscriptions.delete(socketId);
      const socket = io.sockets.sockets.get(socketId);
      socket?.leave(watcher.roomName);
    }

    mailboxWatchers.delete(watchKey);
  };

  const removeSocketSubscription = (socketId) => {
    const watchKey = socketSubscriptions.get(socketId);

    if (!watchKey) {
      return;
    }

    const watcher = mailboxWatchers.get(watchKey);
    socketSubscriptions.delete(socketId);

    if (!watcher) {
      return;
    }

    watcher.socketIds.delete(socketId);
    const socket = io.sockets.sockets.get(socketId);
    socket?.leave(watcher.roomName);

    if (watcher.socketIds.size === 0) {
      stopWatcher(watchKey);
    }
  };

  const emitWatcherMessages = async (watchKey, { forceEmit = false, targetSocketId = null } = {}) => {
    const watcher = mailboxWatchers.get(watchKey);

    if (!watcher || watcher.isPolling) {
      return;
    }

    watcher.isPolling = true;

    try {
      const messages = await messageService.getSocketMessages(watcher.payload);
      const nextFingerprint = buildMessageFingerprint(messages);
      const hasChanged = nextFingerprint !== watcher.lastFingerprint;
      const shouldEmitRoom =
        !targetSocketId || (watcher.socketIds.size > 1 && (forceEmit || hasChanged));

      watcher.lastMessages = messages;
      watcher.lastFingerprint = nextFingerprint;

      if (targetSocketId && !shouldEmitRoom) {
        io.to(targetSocketId).emit('messages_update', messages);
      }

      if (!targetSocketId ? forceEmit || hasChanged : shouldEmitRoom) {
        io.to(watcher.roomName).emit('messages_update', messages);
      }
    } catch (error) {
      if (isAuthorizationError(error)) {
        io.to(watcher.roomName).emit('error', { message: 'Session expired or invalid' });
        stopWatcher(watchKey);
        return;
      }

      console.error(`Socket polling error: ${error.message}`);
    } finally {
      const activeWatcher = mailboxWatchers.get(watchKey);

      if (activeWatcher) {
        activeWatcher.isPolling = false;
      }
    }
  };

  const ensureWatcher = (watchKey, payload) => {
    const existingWatcher = mailboxWatchers.get(watchKey);

    if (existingWatcher) {
      return existingWatcher;
    }

    const watcher = {
      payload,
      roomName: `mailbox:${watchKey}`,
      socketIds: new Set(),
      intervalId: null,
      isPolling: false,
      lastFingerprint: null,
      lastMessages: null,
    };

    watcher.intervalId = setInterval(() => {
      emitWatcherMessages(watchKey);
    }, SOCKET_POLL_INTERVAL_MS);

    mailboxWatchers.set(watchKey, watcher);
    return watcher;
  };

  io.on('connection', (socket) => {
    socket.on('watch_email', async (payload) => {
      if (!payload?.email || !payload?.service) {
        socket.emit('error', { message: 'Invalid watch payload' });
        return;
      }

      removeSocketSubscription(socket.id);

      const watchKey = buildWatchKey(payload);
      const watcher = ensureWatcher(watchKey, payload);

      watcher.socketIds.add(socket.id);
      socketSubscriptions.set(socket.id, watchKey);
      socket.join(watcher.roomName);

      if (watcher.lastMessages) {
        socket.emit('messages_update', watcher.lastMessages);
        return;
      }

      await emitWatcherMessages(watchKey, {
        forceEmit: true,
        targetSocketId: socket.id,
      });
    });

    socket.on('disconnect', () => {
      removeSocketSubscription(socket.id);
    });
  });

  return io;
};

module.exports = setupEmailSocket;
