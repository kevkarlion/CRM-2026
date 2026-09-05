// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { WorkReportToast } from '@/app/(dashboard)/components/WorkReportToast';

const pushMock = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
}));

const apiGet = vi.fn();
vi.mock('@/lib/api-client', () => ({
  api: {
    get: (...args: unknown[]) => apiGet(...args),
    patch: vi.fn().mockResolvedValue({}),
  },
}));

beforeEach(() => {
  apiGet.mockReset();
  apiGet.mockResolvedValue({ data: [], unreadCount: 0 });
  vi.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('WorkReportToast hot-path logging', () => {
  it('does not emit per-tick or body-style debug logs on a successful fetch', async () => {
    render(<WorkReportToast isAdmin />);

    await new Promise((r) => setTimeout(r, 0));

    const logCalls = (vi.mocked(console.log).mock.calls as unknown[][]).map((c) =>
      c.join(' '),
    ).join('\n');

    expect(logCalls).not.toContain('[Toast] Polling tick');
    expect(logCalls).not.toContain('Fetching notifications via polling');
    expect(logCalls).not.toContain('Got notifications');
    expect(logCalls).not.toContain('[Toast] New toasts');
    expect(logCalls).not.toContain('[Toast] Polling: adding toast for');
  });
});
