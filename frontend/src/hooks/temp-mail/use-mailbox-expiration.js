import { useEffect, useEffectEvent, useRef, useState } from 'react';

function useMailboxExpiration({ currentEmail, onExpired }) {
  const [timeLeft, setTimeLeft] = useState(0);
  const isCreatingEmailRef = useRef(false);
  const lastEmailIdRef = useRef(null);
  const handleExpired = useEffectEvent(() => onExpired());

  const resetExpirationGuard = () => {
    isCreatingEmailRef.current = false;
  };

  const handleMailboxTick = useEffectEvent(async () => {
    if (!currentEmail || !currentEmail.expires_at || currentEmail.isHistory) {
      setTimeLeft(0);
      return;
    }

    if (lastEmailIdRef.current !== currentEmail.id) {
      isCreatingEmailRef.current = false;
      lastEmailIdRef.current = currentEmail.id;
    }

    const now = new Date();
    const expiresAt = new Date(currentEmail.expires_at);
    const diffSeconds = Math.floor((expiresAt - now) / 1000);

    if (diffSeconds <= 0) {
      setTimeLeft(0);

      if (!isCreatingEmailRef.current) {
        isCreatingEmailRef.current = true;
        const shouldReleaseLock = await handleExpired();

        if (shouldReleaseLock) {
          isCreatingEmailRef.current = false;
        }
      }

      return;
    }

    setTimeLeft(diffSeconds);
  });

  useEffect(() => {
    if (!currentEmail?.expires_at || currentEmail.isHistory) {
      if (!currentEmail) {
        setTimeLeft(0);
      }

      return;
    }

    handleMailboxTick();
    const timerId = setInterval(() => {
      handleMailboxTick();
    }, 1000);

    return () => clearInterval(timerId);
  }, [currentEmail?.id, currentEmail?.expires_at, currentEmail?.isHistory]);

  return {
    timeLeft,
    resetExpirationGuard,
  };
}

export default useMailboxExpiration;
