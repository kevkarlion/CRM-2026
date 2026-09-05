// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook, cleanup } from '@testing-library/react';
import { useConversationStatus } from '@/leads/pipeline-board/hooks/useConversationStatus';

vi.mock('@/lib/api-client', () => ({
  api: {
    get: vi.fn(),
  },
}));

import { api } from '@/lib/api-client';

const apiGet = api.get as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  apiGet.mockResolvedValue({ conversations: [] });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('useConversationStatus polling', () => {
  it('polls on its own 5s interval by default', async () => {
    renderHook(() => useConversationStatus([]));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(apiGet).toHaveBeenCalled();
  });

  it('does NOT set up its own timer when pollEnabled=false (external trigger)', async () => {
    renderHook(() => useConversationStatus([], { pollEnabled: false }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60000);
    });
    // Only the initial fetch happened, never the periodic one.
    expect(apiGet).toHaveBeenCalledTimes(1);
  });

  it('exposes refetch for external triggering', async () => {
    const { result } = renderHook(() => useConversationStatus([], { pollEnabled: false }));
    expect(apiGet).toHaveBeenCalledTimes(1);
    await act(async () => {
      await result.current.refetch();
    });
    expect(apiGet).toHaveBeenCalledTimes(2);
  });
});
