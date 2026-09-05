// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook, cleanup } from '@testing-library/react';
import { useVisiblePolling, chatPollingKey } from '@/lib/use-visible-polling';

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

describe('useVisiblePolling', () => {
  it('polls at the base interval only while visible and focused', async () => {
    const fetcher = vi.fn().mockResolvedValue(undefined);
    renderHook(() => useVisiblePolling({ key: 'base', interval: 10000, fetcher }));

    expect(fetcher).toHaveBeenCalledTimes(0);

    await advance(10000);
    expect(fetcher).toHaveBeenCalledTimes(1);

    await advance(10000);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('pauses completely while hidden and soft-refetches when visible again', async () => {
    const fetcher = vi.fn().mockResolvedValue(undefined);
    renderHook(() => useVisiblePolling({ key: 'hidden', interval: 10000, fetcher }));

    await advance(10000);
    expect(fetcher).toHaveBeenCalledTimes(1);

    setVisibility('hidden');
    await advance(60000);
    expect(fetcher).toHaveBeenCalledTimes(1);

    setVisibility('visible');
    expect(fetcher).toHaveBeenCalledTimes(2);

    await advance(10000);
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it('pauses on window blur and soft-refetches on focus regain', async () => {
    const fetcher = vi.fn().mockResolvedValue(undefined);
    renderHook(() => useVisiblePolling({ key: 'blur', interval: 10000, fetcher }));

    await advance(10000);
    expect(fetcher).toHaveBeenCalledTimes(1);

    setFocused(false);
    await advance(60000);
    expect(fetcher).toHaveBeenCalledTimes(1);

    setFocused(true);
    expect(fetcher).toHaveBeenCalledTimes(2);

    await advance(10000);
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it('refetches immediately on manual refetch regardless of the interval', async () => {
    const fetcher = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useVisiblePolling({ key: 'manual', interval: 10000, fetcher }));

    expect(fetcher).toHaveBeenCalledTimes(0);
    await act(async () => {
      await result.current.refetch();
    });
    expect(fetcher).toHaveBeenCalledTimes(1);

    await act(async () => {
      await result.current.refetch();
    });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('does nothing on manual refetch while hidden', async () => {
    const fetcher = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useVisiblePolling({ key: 'refetchHidden', interval: 10000, fetcher }));

    setVisibility('hidden');
    await act(async () => {
      await result.current.refetch();
    });
    expect(fetcher).toHaveBeenCalledTimes(0);
  });

  it('backs off exponentially after 3 consecutive failures, caps at backoffMax, resets on success', async () => {
    let failuresLeft = 7;
    const fetcher = vi.fn().mockImplementation(async () => {
      if (failuresLeft > 0) {
        failuresLeft -= 1;
        throw new Error('down');
      }
      return undefined;
    });

    renderHook(() =>
      useVisiblePolling({ key: 'backoff', interval: 1000, backoffMax: 3000, fetcher }),
    );

    await advance(1000);
    expect(fetcher).toHaveBeenCalledTimes(1);
    await advance(1000);
    expect(fetcher).toHaveBeenCalledTimes(2);
    await advance(1000);
    expect(fetcher).toHaveBeenCalledTimes(3);

    await advance(2000);
    expect(fetcher).toHaveBeenCalledTimes(4);
    await advance(2000);
    expect(fetcher).toHaveBeenCalledTimes(5);
    await advance(2000);
    expect(fetcher).toHaveBeenCalledTimes(6);

    await advance(3000);
    expect(fetcher).toHaveBeenCalledTimes(7);

    await advance(3000);
    expect(fetcher).toHaveBeenCalledTimes(8);

    await advance(1000);
    expect(fetcher).toHaveBeenCalledTimes(9);
  });

  it('dedupes two mounts with the same key into one single-flight loop', async () => {
    const fetcherA = vi.fn().mockResolvedValue(undefined);
    const fetcherB = vi.fn().mockResolvedValue(undefined);

    const a = renderHook(() => useVisiblePolling({ key: 'same', interval: 10000, fetcher: fetcherA }));
    renderHook(() => useVisiblePolling({ key: 'same', interval: 10000, fetcher: fetcherB }));

    await advance(10000);
    expect(fetcherA.mock.calls.length + fetcherB.mock.calls.length).toBe(1);

    a.unmount();
    await advance(10000);
    expect(fetcherA.mock.calls.length + fetcherB.mock.calls.length).toBe(2);

    cleanup();
    await advance(60000);
    expect(fetcherA.mock.calls.length + fetcherB.mock.calls.length).toBe(2);
  });

  it('skips ticks while a fetch is still in flight (single-flight)', async () => {
    let releaseFetch: ((v: unknown) => void) | null = null;
    const fetcher = vi.fn().mockImplementation(
      () => new Promise((resolve) => {
        releaseFetch = resolve;
      }),
    );

    renderHook(() => useVisiblePolling({ key: 'inflight', interval: 1000, fetcher }));

    await advance(1000);
    expect(fetcher).toHaveBeenCalledTimes(1);

    await advance(5000);
    expect(fetcher).toHaveBeenCalledTimes(1);

    await act(async () => {
      releaseFetch!(undefined);
    });
    await advance(1000);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('stops polling entirely after the last mount unmounts', async () => {
    const fetcher = vi.fn().mockResolvedValue(undefined);
    const a = renderHook(() => useVisiblePolling({ key: 'cleanup', interval: 10000, fetcher }));
    const b = renderHook(() => useVisiblePolling({ key: 'cleanup', interval: 10000, fetcher }));

    await advance(10000);
    expect(fetcher).toHaveBeenCalledTimes(1);

    a.unmount();
    b.unmount();
    await advance(60000);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('runs independent loops for distinct keys', async () => {
    const fetcherA = vi.fn().mockResolvedValue(undefined);
    const fetcherB = vi.fn().mockResolvedValue(undefined);

    renderHook(() => useVisiblePolling({ key: 'kA', interval: 10000, fetcher: fetcherA }));
    renderHook(() => useVisiblePolling({ key: 'kB', interval: 10000, fetcher: fetcherB }));

    await advance(10000);
    expect(fetcherA).toHaveBeenCalledTimes(1);
    expect(fetcherB).toHaveBeenCalledTimes(1);
  });

  it('does not poll while enabled=false and resumes when enabled flips to true', async () => {
    const fetcher = vi.fn().mockResolvedValue(undefined);
    const { rerender } = renderHook(
      ({ enabled }) => useVisiblePolling({ key: 'enabled', interval: 10000, fetcher, enabled }),
      { initialProps: { enabled: false } },
    );

    await advance(30000);
    expect(fetcher).toHaveBeenCalledTimes(0);

    rerender({ enabled: true });
    await advance(10000);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('exposes isLoading and lastUpdatedAt from the polled outcome', async () => {
    const fetcher = vi.fn().mockResolvedValue('payload');
    const { result } = renderHook(() => useVisiblePolling({ key: 'state', interval: 10000, fetcher }));

    expect(result.current.isLoading).toBe(false);
    expect(result.current.lastUpdatedAt).toBeNull();

    await advance(10000);

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(result.current.lastUpdatedAt).not.toBeNull();
    expect(result.current.isLoading).toBe(false);
  });

  it('surfaces the last error from failed polls', async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error('bang'));
    const { result } = renderHook(() => useVisiblePolling({ key: 'error', interval: 10000, fetcher }));

    await advance(10000);

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(result.current.error).toBeInstanceOf(Error);
    expect((result.current.error as Error).message).toBe('bang');
  });
});

describe('chatPollingKey', () => {
  it('derives a per-number dedup key', () => {
    expect(chatPollingKey('+5491122334455')).toBe('chat:+5491122334455');
  });

  it('collapses missing phone numbers to a stable placeholder key', () => {
    expect(chatPollingKey(null)).toBe('chat:__none__');
    expect(chatPollingKey(undefined)).toBe('chat:__none__');
  });
});