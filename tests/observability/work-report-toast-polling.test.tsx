// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, render, cleanup, screen } from '@testing-library/react';
import { WorkReportToast } from '@/app/(dashboard)/components/WorkReportToast';

const pushMock = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
}));

const apiGet = vi.fn();
const apiPatch = vi.fn();
vi.mock('@/lib/api-client', () => ({
  api: {
    get: (...args: unknown[]) => apiGet(...args),
    patch: (...args: unknown[]) => apiPatch(...args),
  },
}));

const notification = {
  _id: 'n1',
  type: 'work_report_completed',
  title: 'Orden de Trabajo terminada',
  message: 'Técnico completó WO-001',
  data: {
    workOrderId: 'wo1',
    workReportId: 'wr1',
    workOrderNumber: 'WO-001',
    technicianName: 'Carlos',
  },
  createdAt: '2026-09-05T10:00:00.000Z',
};

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

  vi.stubGlobal('EventSource', vi.fn());
  apiGet.mockReset();
  apiPatch.mockReset();
  apiGet.mockResolvedValue({ data: [], unreadCount: 0 });
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('WorkReportToast single visibility-aware polling path', () => {
  it('polls via a single 15s-visible path and renders toasts from notifications', async () => {
    apiGet.mockResolvedValue({ data: [notification], unreadCount: 1 });
    render(<WorkReportToast isAdmin />);

    await advance(3_000);
    expect(apiGet).not.toHaveBeenCalled();

    await advance(12_000);
    expect(apiGet).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Orden de Trabajo terminada').textContent).toBe(
      'Orden de Trabajo terminada',
    );
    expect(screen.getByText(/Carlos/).textContent).toContain('Carlos');

    await advance(15_000);
    expect(apiGet).toHaveBeenCalledTimes(2);
  });

  it('pauses polling entirely while hidden', async () => {
    render(<WorkReportToast isAdmin />);

    await advance(15_000);
    expect(apiGet).toHaveBeenCalledTimes(1);

    setVisibility('hidden');
    await advance(60_000);
    expect(apiGet).toHaveBeenCalledTimes(1);
  });

  it('does not open EventSource nor run the old 3s backup loop', async () => {
    render(<WorkReportToast isAdmin />);
    await advance(3_000);

    expect(apiGet).not.toHaveBeenCalled();
    expect(vi.mocked(EventSource)).not.toHaveBeenCalled();
  });
});