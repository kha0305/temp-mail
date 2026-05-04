import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { BACKEND_URL } from '@/services/temp-mail-api';

function useMailboxSocket({ currentEmail, onMessages, onSocketError }) {
  const [socketStatus, setSocketStatus] = useState('idle');
  const currentEmailRef = useRef(currentEmail);
  const socketRef = useRef(null);
  const handleMessages = useEffectEvent((messages) => onMessages(messages));
  const handleSocketError = useEffectEvent((payload) => onSocketError(payload));

  useEffect(() => {
    currentEmailRef.current = currentEmail;
  }, [currentEmail]);

  useEffect(() => {
    const socket = io(BACKEND_URL, {
      path: '/socket.io/',
      transports: ['websocket'],
      reconnectionAttempts: 5,
      reconnectionDelay: 5000,
      timeout: 10000,
      autoConnect: false,
    });

    const handleConnect = () => {
      setSocketStatus('connected');
    };

    const handleDisconnect = () => {
      const mailbox = currentEmailRef.current;
      setSocketStatus(mailbox && !mailbox.isHistory ? 'polling' : 'idle');
    };

    const handleReconnectAttempt = () => {
      setSocketStatus('connecting');
    };

    const handleConnectError = () => {
      const mailbox = currentEmailRef.current;
      setSocketStatus(mailbox && !mailbox.isHistory ? 'polling' : 'error');
    };

    const handleServerError = (payload) => {
      handleSocketError(payload);
      const mailbox = currentEmailRef.current;
      setSocketStatus(mailbox && !mailbox.isHistory ? 'polling' : 'idle');
    };

    socketRef.current = socket;
    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('connect_error', handleConnectError);
    socket.on('error', handleServerError);
    socket.on('messages_update', handleMessages);
    socket.io.on('reconnect_attempt', handleReconnectAttempt);

    return () => {
      socket.io.off('reconnect_attempt', handleReconnectAttempt);
      socket.disconnect();
    };
  }, []);

  useEffect(() => {
    const socket = socketRef.current;

    if (!socket) {
      return;
    }

    if (!currentEmail || currentEmail.isHistory) {
      socket.disconnect();
      setSocketStatus('idle');
      return;
    }

    const watchPayload = {
      email: currentEmail.address,
      token: currentEmail.token,
      service: currentEmail.service || currentEmail.provider,
      account_id: currentEmail.account_id,
    };

    const watchCurrentEmail = () => {
      socket.emit('watch_email', watchPayload);
    };

    if (!socket.connected) {
      setSocketStatus('connecting');
      socket.once('connect', watchCurrentEmail);
      socket.connect();
    } else {
      watchCurrentEmail();
      setSocketStatus('connected');
    }

    return () => {
      socket.off('connect', watchCurrentEmail);
    };
  }, [
    currentEmail?.id,
    currentEmail?.address,
    currentEmail?.token,
    currentEmail?.service,
    currentEmail?.provider,
    currentEmail?.account_id,
    currentEmail?.isHistory,
  ]);

  return {
    socketStatus,
    setSocketStatus,
  };
}

export default useMailboxSocket;
