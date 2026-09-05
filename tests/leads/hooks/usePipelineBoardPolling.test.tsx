// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook, cleanup } from '@testing-library/react';
import { usePipelineBoardPolling } from '@/leads/pipeline-board/hooks/usePipelineBoardPolling';

let focused = true;
let visibility: 'visible' | 'hidden' = 'visible';

function setFocused(next: boolean) {
  focused = next;
  act(() => {
    window.dispatchEvent(new Event(next ? 'focus' : 'blur'));
  });
}

function setVisibility(next: 'visible' | 'hidden') {
  visibility = next;
  act(() => {
    document.dispatchEvent(new Event('visibilitychange'));
  });
}

async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

beforeEach(() => {
  focused = true;
  visibility = 'visible';
  vi.useFakeTimers();
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => visibility,
  });
  vi.spyOn(document, 'hasFocus').mockImplementation(() => focused);
  document.dispatchEvent(new Event('visibilitychange'));
  window.dispatchEvent(new Event('focus'));
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function makeRefetches() {
  return {
    refetchPipeline: vi.fn().mockResolvedValue(undefined),
    refetchBotClients: vi.fn().mockResolvedValue(undefined),
    refetchCustomers: vi.fn().mockResolvedValue(undefined),
    fetchMarks: vi.fn().mockResolvedValue(undefined),
    fetchConversationStatus: vi.fn().mockResolvedValue(undefined),
    fetchHandoffs: vi.fn().mockResolvedValue(undefined),
  };
}

describe('usePipelineBoardPolling', () => {
  it('does NOT hammer on a 5s cadence: no tick at 5s after mount', async () => {
    const refs = makeRefetches();
    renderHook(() => usePipelineBoardPolling(refs));
    await advance(5000);
    for (const fn of [
      refs.refetchPipeline,
      refs.refetchBotClients,
      refs.refetchCustomers,
      refs.fetchMarks,
      refs.fetchConversationStatus,
      refs.fetchHandoffs,
    ]) {
      expect(fn).toHaveBeenCalledTimes(0);
    }
  });

  it('runs ALL fetchers on a single 15s tick while visible', async () => {
    const refs = makeRefetches();
    renderHook(() => usePipelineBoardPolling(refs));
    await advance(15000);
    for (const fn of [
      refs.refetchPipeline,
      refs.refetchBotClients,
      refs.refetchCustomers,
      refs.fetchMarks,
      refs.fetchConversationStatus,
      refs.fetchHandoffs,
    ]) {
      expect(fn).toHaveBeenCalledTimes(1);
    }
  });

  it('pauses entirely while hidden (no 15s tick)', async () => {
    const refs = makeRefetches();
    renderHook(() => usePipelineBoardPolling(refs));
    setVisibility('hidden');
    await advance(15000);
    for (const fn of [
      refs.refetchPipeline,
      refs.refetchBotClients,
      refs.refetchCustomers,
      refs.fetchMarks,
      refs.fetchConversationStatus,
      refs.fetchHandoffs,
    ]) {
      expect(fn).toHaveBeenCalledTimes(0);
    }
  });

  it('dedupes: two mounts share ONE loop (no duplicate timers)', async () => {
    const refsA = makeRefetches();
    const refsB = makeRefetches();
    const { unmount: unmountA } = renderHook(() => usePipelineBoardPolling(refsA));
    const { unmount: unmountB } = renderHook(() => usePipelineBoardPolling(refsB));
    await advance(15000);
    // Last-mounted fetcher drives the shared loop → refsA's fetcher is
    // superseded (0 calls), refsB's runs exactly once for the single tick.
    // If there were two independent timers, refsA would get its own tick too.
    expect(refsA.refetchPipeline).toHaveBeenCalledTimes(0);
    expect(refsB.refetchPipeline).toHaveBeenCalledTimes(1);
    unmountA();
    unmountB();
  });

  it('exposes manual refetch', async () => {
    const refs = makeRefetches();
    const { result } = renderHook(() => usePipelineBoardPolling(refs));
    await act(async () => {
      await result.current.refetch();
    });
    for (const fn of [
      refs.refetchPipeline,
      refs.refetchBotClients,
      refs.refetchCustomers,
      refs.fetchMarks,
      refs.fetchConversationStatus,
      refs.fetchHandoffs,
    ]) {
      expect(fn).toHaveBeenCalledTimes(1); // one manual combined pass
    }
  });
});
