// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, render, cleanup, screen } from '@testing-library/react';
import { AttentionToast } from '@/components/follow-up/AttentionToast';

const pushMock = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
}));

const ROLIJA_EMAIL = 'ro.lija@hotmail.com';

const fetchMock = vi.fn();

let focused = true;
let visibility: 'visible' | 'hidden' = 'visible';

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

function targetMark(overrides: Record<string, unknown> = {}) {
  return {
    _id: 'm1',
    assignedTo: ROLIJA_EMAIL,
    markedBy: 'o.other@x.com',
    markedAt: '2026-09-05T10:00:00.000Z',
    target: { _id: 'l1', name: 'Lead Uno' },
    targetType: 'lead',
    ...overrides,
  };
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

  localStorage.clear();
  const payload = btoa(JSON.stringify({ email: ROLIJA_EMAIL }));
  localStorage.setItem('token', `h.${payload}.sig`);
  localStorage.setItem('tenantId', 'ten_1');

  vi.stubGlobal('EventSource', vi.fn());
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockResolvedValue({ ok: true, json: async () => [] });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('AttentionToast visibility-aware polling', () => {
  it('polls once at 15s while visible and renders toasts from the polled marks', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => [targetMark()] });
    render(<AttentionToast />);

    await advance(10_000);
    expect(fetchMock).not.toHaveBeenCalled();

    await advance(5_000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain('/api/follow-up-marks');
    expect(screen.getByText('Lead Uno').textContent).toBe('Lead Uno');
  });

  it('pauses polling entirely while hidden', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => [targetMark()] });
    render(<AttentionToast />);

    await advance(15_000);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    setVisibility('hidden');
    await advance(60_000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not open an EventSource connection', async () => {
    render(<AttentionToast />);
    await advance(15_000);

    expect(vi.mocked(EventSource)).not.toHaveBeenCalled();
  });
});