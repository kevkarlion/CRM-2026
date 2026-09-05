'use client';

import { useMemo } from 'react';
import { useVisiblePolling } from '@/lib/use-visible-polling';

/**
 * usePipelineBoardPolling — single visibility-aware 15s refresh loop for the
 * PipelineBoard page.
 *
 * The audit found 4-5 parallel polling timers on the board (fetchMarks 15s,
 * useConversationStatus 5s, usePendingHandoffs 15s, and a 5s main loop doing
 * refetch + refetchBotClients + refetchCustomers). This hook folds ALL of them
 * into ONE `useVisiblePolling` loop keyed `pipeline:board` at 15s, paused while
 * the tab is hidden. The fetchers are the stable refetch callbacks the page
 * already exposes (pipeline leads, bot clients, customers, follow-up marks,
 * conversation status, pending handoffs), so no network behavior changes — only
 * ONE timer per page instead of five.
 *
 * Optimistic UI on user actions (drag/drop, status change, resolve) is NOT
 * piggybacked here — those call refetch directly and are owned by the actions.
 */

export interface PipelineBoardPollingFetchers {
  refetchPipeline: () => unknown | Promise<unknown>;
  refetchBotClients: () => unknown | Promise<unknown>;
  refetchCustomers: () => unknown | Promise<unknown>;
  fetchMarks: (userEmail?: string) => unknown | Promise<unknown>;
  fetchConversationStatus: () => unknown | Promise<unknown>;
  fetchHandoffs: () => unknown | Promise<unknown>;
}

export function usePipelineBoardPolling(fetchers: PipelineBoardPollingFetchers): {
  refetch: () => Promise<void>;
} {
  // A single combined fetcher runs every tick, firing every background refresh
  // in one pass. Fetchers are memoized so they stay stable across renders.
  const combined = useMemo(() => {
    return async () => {
      await Promise.all([
        Promise.resolve(fetchers.refetchPipeline()),
        Promise.resolve(fetchers.refetchBotClients()),
        Promise.resolve(fetchers.refetchCustomers()),
        Promise.resolve(fetchers.fetchMarks()),
        Promise.resolve(fetchers.fetchConversationStatus()),
        Promise.resolve(fetchers.fetchHandoffs()),
      ]);
    };
  }, [fetchers]);

  const { refetch } = useVisiblePolling({
    key: 'pipeline:board',
    interval: 15_000,
    fetcher: combined,
  });

  return { refetch };
}
