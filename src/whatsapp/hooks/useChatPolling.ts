'use client';

import { useEffect, useRef, useCallback } from 'react';

interface UseChatPollingOptions {
  interval?: number;
  enabled?: boolean;
  onPoll: () => void;
}

export function useChatPolling({
  interval = 5000,
  enabled = true,
  onPoll,
}: UseChatPollingOptions) {
  const onPollRef = useRef(onPoll);
  onPollRef.current = onPoll;

  const isVisible = useRef(true);

  useEffect(() => {
    function handleVisibility() {
      isVisible.current = document.visibilityState === 'visible';
    }

    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const timer = setInterval(() => {
      if (isVisible.current) {
        onPollRef.current();
      }
    }, interval);

    return () => clearInterval(timer);
  }, [interval, enabled]);
}
